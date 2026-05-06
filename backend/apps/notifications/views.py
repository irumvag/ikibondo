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
        broadcast = serializer.save(created_by=request.user, sent_at=timezone.now())

        # Fan out to recipients
        from apps.accounts.models import CustomUser
        recipients = self._resolve_recipients(broadcast, request.user)
        from apps.notifications.tasks import send_push, send_sms
        from .models import NotificationChannel

        for user in recipients:
            delivery = BroadcastDelivery.objects.create(
                broadcast=broadcast,
                recipient=user,
                status=NotificationStatus.PENDING,
            )
            # Also create a Notification row so it appears in the notification feed
            notif = Notification.objects.create(
                recipient=user,
                notification_type='ZONE_SUMMARY',  # reuse closest type
                channel=broadcast.channel,
                message=broadcast.body,
                status=NotificationStatus.PENDING,
            )
            if broadcast.channel == NotificationChannel.SMS:
                send_sms.delay(str(notif.id))
            else:
                send_push.delay(str(notif.id))

            delivery.status = NotificationStatus.SENT
            delivery.sent_at = timezone.now()
            delivery.save(update_fields=['status', 'sent_at', 'updated_at'])

        return created_response(
            data=BroadcastSerializer(broadcast).data,
            message=f'Broadcast sent to {len(recipients)} recipient(s).',
        )

    def _resolve_recipients(self, broadcast, requesting_user):
        from apps.accounts.models import CustomUser
        qs = CustomUser.objects.filter(is_active=True)
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
            return list(qs.filter(role=broadcast.scope_id).exclude(id=requesting_user.id))
        return []
