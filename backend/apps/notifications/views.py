from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from apps.core.responses import success_response, created_response, error_response
from apps.accounts.models import UserRole
from .models import Notification, Broadcast, BroadcastDelivery, BroadcastScope, NotificationStatus
from .serializers import NotificationSerializer, BroadcastSerializer


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        """Each user only sees their own notifications."""
        if getattr(self, 'swagger_fake_view', False):
            return Notification.objects.none()
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=True, methods=['patch'], url_path='read')
    def mark_read(self, request, pk=None):
        """PATCH /api/v1/notifications/<id>/read/ — mark a notification as read."""
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return success_response(message='Marked as read.')

    @action(detail=False, methods=['patch'], url_path='read-all')
    def mark_all_read(self, request):
        """PATCH /api/v1/notifications/read-all/ — mark all unread as read."""
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return success_response(message='All notifications marked as read.')

    @action(detail=True, methods=['delete'], url_path='dismiss')
    def dismiss(self, request, pk=None):
        """DELETE /api/v1/notifications/<id>/dismiss/ — delete a notification."""
        notification = self.get_object()
        notification.delete()
        return success_response(message='Notification dismissed.')


class BroadcastViewSet(viewsets.ModelViewSet):
    """
    Supervisor/Admin: create + list broadcasts.
    GET /api/v1/broadcasts/ — list own broadcasts (supervisor) or all (admin).
    POST /api/v1/broadcasts/ — create + fan out immediately.
    """
    serializer_class = BroadcastSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_at']
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Broadcast.objects.none()
        user = self.request.user
        qs = Broadcast.objects.select_related('created_by')
        if user.role == UserRole.SUPERVISOR:
            qs = qs.filter(created_by=user)
        elif user.role != UserRole.ADMIN:
            return qs.none()
        return qs.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        if request.user.role not in (UserRole.SUPERVISOR, UserRole.ADMIN):
            return error_response('Only supervisors and admins can broadcast.', 'FORBIDDEN', status_code=403)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Security: only ADMINs may use GLOBAL scope — supervisors are camp-scoped only
        if serializer.validated_data.get('scope_type') == BroadcastScope.GLOBAL and request.user.role != UserRole.ADMIN:
            return error_response('Only admins can send global broadcasts.', 'FORBIDDEN', status_code=403)

        # Supervisors may only address their own camp, or a zone inside it
        if request.user.role == UserRole.SUPERVISOR:
            scope_type = serializer.validated_data.get('scope_type')
            scope_id = serializer.validated_data.get('scope_id')
            if not request.user.camp_id:
                return error_response('Your account has no camp assigned.', 'FORBIDDEN', status_code=403)
            if scope_type == BroadcastScope.CAMP and str(scope_id) != str(request.user.camp_id):
                return error_response('You can only broadcast to your own camp.', 'FORBIDDEN', status_code=403)
            if scope_type == BroadcastScope.ZONE:
                from apps.camps.models import CampZone
                if not CampZone.objects.filter(id=scope_id, camp_id=request.user.camp_id).exists():
                    return error_response('You can only broadcast to zones in your own camp.', 'FORBIDDEN', status_code=403)

        broadcast = serializer.save(created_by=request.user, sent_at=timezone.now())

        # Fan out to recipients
        from .models import NotificationChannel
        recipients = self._resolve_recipients(broadcast, request.user)

        from apps.notifications.tasks import send_push, send_sms

        sent_count = 0
        for recipient_user in recipients:
            delivery = BroadcastDelivery.objects.create(
                broadcast=broadcast,
                recipient=recipient_user,
                status=NotificationStatus.PENDING,
            )
            # Create a Notification row so it appears in each recipient's in-app feed
            notif = Notification.objects.create(
                recipient=recipient_user,
                notification_type='BROADCAST',
                channel=broadcast.channel,
                message=broadcast.body,
                status=NotificationStatus.PENDING,
            )
            try:
                if broadcast.channel == NotificationChannel.SMS:
                    send_sms.delay(str(notif.id))
                else:
                    send_push.delay(str(notif.id))
                delivery.status = NotificationStatus.SENT
                delivery.sent_at = timezone.now()
                delivery.save(update_fields=['status', 'sent_at', 'updated_at'])
                sent_count += 1
            except Exception:
                # Celery not running — deliver synchronously
                try:
                    if broadcast.channel == NotificationChannel.SMS:
                        send_sms(str(notif.id))
                    else:
                        send_push(str(notif.id))
                    delivery.status = NotificationStatus.SENT
                except Exception:
                    delivery.status = NotificationStatus.FAILED
                delivery.sent_at = timezone.now()
                delivery.save(update_fields=['status', 'sent_at', 'updated_at'])
                sent_count += 1

        return created_response(
            data=BroadcastSerializer(broadcast).data,
            message=f'Broadcast sent to {sent_count} recipient(s).',
        )

    def _resolve_recipients(self, broadcast, requesting_user):
        from apps.accounts.models import CustomUser
        qs = CustomUser.objects.filter(is_active=True)
        # Defence in depth: whatever the scope, a supervisor's message never leaves their camp
        if requesting_user.role != UserRole.ADMIN:
            qs = qs.filter(camp_id=requesting_user.camp_id)
        if broadcast.scope_type == BroadcastScope.GLOBAL:
            return list(qs.exclude(id=requesting_user.id)[:500])
        if broadcast.scope_type == BroadcastScope.CAMP and broadcast.scope_id:
            return list(qs.filter(camp_id=broadcast.scope_id).exclude(id=requesting_user.id))
        if broadcast.scope_type == BroadcastScope.ZONE and broadcast.scope_id:
            from apps.camps.models import CHWZoneAssignment, ZoneCoordinatorAssignment
            chw_ids = CHWZoneAssignment.objects.filter(zone_id=broadcast.scope_id, status='active').values_list('chw_user_id', flat=True)
            coord_ids = ZoneCoordinatorAssignment.objects.filter(zone_id=broadcast.scope_id, status='active').values_list('user_id', flat=True)
            ids = set(chw_ids) | set(coord_ids)
            return list(qs.filter(id__in=ids).exclude(id=requesting_user.id))
        if broadcast.scope_type == BroadcastScope.ROLE and broadcast.scope_id:
            return list(qs.with_role(broadcast.scope_id).exclude(id=requesting_user.id))
        return []


# ── Push device registration (mobile app) ────────────────────────────────────

from rest_framework.decorators import api_view, permission_classes  # noqa: E402
from drf_spectacular.utils import extend_schema  # noqa: E402


@extend_schema(exclude=True)
@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def devices_view(request):
    """
    POST   /api/v1/notifications/devices/  {"token": "...", "platform": "ios|android|web", "app_version": "1.0.0"}
           Register (or re-claim) this device for the signed-in user. Call after every sign-in and token refresh.
    DELETE /api/v1/notifications/devices/  {"token": "..."}
           Stop pushing to this device. Call on sign-out.
    """
    from .models import DeviceToken, DevicePlatform

    token = (request.data.get('token') or '').strip()
    if not token or len(token) > 512:
        return error_response('A device token is required.', 'VALIDATION_ERROR')

    if request.method == 'DELETE':
        # Only the owner can unregister, so one user can't silence another's alerts
        DeviceToken.objects.filter(token=token, user=request.user).delete()
        return success_response(message='Device removed.')

    platform = request.data.get('platform', '')
    if platform not in DevicePlatform.values:
        return error_response(f'platform must be one of: {", ".join(DevicePlatform.values)}.', 'VALIDATION_ERROR')

    # A token identifies one app install; whoever signed in there last owns it
    device, created = DeviceToken.objects.update_or_create(
        token=token,
        defaults={
            'user': request.user,
            'platform': platform,
            'app_version': (request.data.get('app_version') or '')[:32],
        },
    )
    return (created_response if created else success_response)(
        data={'id': str(device.id), 'platform': device.platform},
        message='Device registered.',
    )
