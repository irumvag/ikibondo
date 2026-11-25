from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from apps.core.responses import success_response, created_response, error_response
from apps.accounts.models import UserRole
from .models import Referral, ReferralStatus
from .serializers import ReferralSerializer
from apps.core.scoping import scope_children, can_access_child


class ReferralViewSet(viewsets.ModelViewSet):
    """
    Scoping:
      CHW/NURSE  — can create referrals for children in their caseload; see own.
      SUPERVISOR/ADMIN — see all in their camp.
      PARENT — read-only: own children's referrals.
    """
    serializer_class = ReferralSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['child__full_name', 'child__registration_number', 'target_facility']
    ordering_fields = ['referred_at', 'status']
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Referral.objects.none()
        user = self.request.user
        qs = Referral.objects.select_related('child', 'referring_user')
        if user.role == UserRole.CHW:
            qs = qs.filter(referring_user=user)
        else:
            qs = scope_children(qs, user, prefix='child__')
        return qs.order_by('-referred_at')

    def create(self, request, *args, **kwargs):
        if request.user.role == UserRole.PARENT:
            return error_response('Parents cannot create referrals.', 'FORBIDDEN', status_code=403)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not can_access_child(request.user, serializer.validated_data['child']):
            return error_response('Child not found.', 'NOT_FOUND', status_code=404)
        referral = serializer.save(referring_user=request.user)
        return created_response(
            data=ReferralSerializer(referral).data,
            message='Referral created.',
        )

    def update(self, request, *args, **kwargs):
        if request.user.role == UserRole.PARENT:
            return error_response('Parents cannot edit referrals.', 'FORBIDDEN', status_code=403)
        return super().update(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='complete')
    def complete(self, request, pk=None):
        """POST /referrals/<id>/complete/ — mark referral completed with outcome."""
        if request.user.role not in (UserRole.NURSE, UserRole.SUPERVISOR, UserRole.ADMIN):
            return error_response('Only nurses and above may complete referrals.', 'FORBIDDEN', status_code=403)
        referral = self.get_object()
        if referral.status == ReferralStatus.COMPLETED:
            return error_response('Already completed.', 'INVALID_STATE')
        referral.status = ReferralStatus.COMPLETED
        referral.outcome = request.data.get('outcome', '')
        referral.completed_at = timezone.now()
        referral.save(update_fields=['status', 'outcome', 'completed_at', 'updated_at'])
        return success_response(
            data=ReferralSerializer(referral).data,
            message='Referral marked complete.',
        )

