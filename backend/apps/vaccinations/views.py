from django.utils import timezone
from rest_framework import viewsets, filters, serializers as drf_serializers
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend

from apps.core.responses import success_response, error_response
from apps.accounts.permissions import IsCampStaff
from apps.accounts.models import UserRole
from .models import VaccinationRecord, Vaccine, DoseStatus
from .serializers import VaccinationRecordSerializer, VaccineSerializer


class _AdministerSerializer(drf_serializers.Serializer):
    administered_date = drf_serializers.DateField(default=timezone.now().date)
    batch_number = drf_serializers.CharField(required=False, allow_blank=True, default='')
    notes = drf_serializers.CharField(required=False, allow_blank=True, default='')


class VaccineViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only master list of all vaccines in the Rwanda EPI schedule."""
    queryset = Vaccine.objects.filter(is_active=True)
    serializer_class = VaccineSerializer


class VaccinationRecordViewSet(viewsets.ModelViewSet):
    queryset = VaccinationRecord.objects.select_related('child', 'vaccine', 'administered_by').all()
    serializer_class = VaccinationRecordSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['child', 'status', 'vaccine', 'dropout_risk_tier']
    ordering_fields = ['scheduled_date', 'created_at']
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def perform_update(self, serializer):
        """When marking a dose DONE, record administered_by and date."""
        instance = serializer.save()
        if instance.status == 'DONE' and not instance.administered_by:
            instance.administered_by = self.request.user
            if not instance.administered_date:
                instance.administered_date = timezone.now().date()
            instance.save(update_fields=['administered_by', 'administered_date', 'updated_at'])

    @action(detail=True, methods=['post'], url_path='administer')
    def administer(self, request, pk=None):
        """POST /api/v1/vaccinations/<id>/administer/ — mark a dose as administered."""
        user = request.user
        allowed_roles = (UserRole.CHW, UserRole.NURSE, UserRole.SUPERVISOR, UserRole.ADMIN)
        if user.role not in allowed_roles:
            return error_response('Not authorised to administer vaccines.', 'FORBIDDEN', status_code=403)

        record = self.get_object()

        if record.status == DoseStatus.DONE:
            return error_response('This dose has already been administered.', 'ALREADY_DONE', status_code=400)

        # CHW scope check: must be assigned to the child's zone
        if user.role == UserRole.CHW:
            child_zone = getattr(record.child, 'zone', None)
            if child_zone is not None:
                from apps.camps.models import CHWZoneAssignment
                assigned = CHWZoneAssignment.objects.filter(
                    chw_user=user, zone=child_zone, status='active'
                ).exists()
                if not assigned:
                    return error_response(
                        'You are not assigned to this child\'s zone.',
                        'FORBIDDEN', status_code=403,
                    )

        s = _AdministerSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data

        record.status = DoseStatus.DONE
        record.administered_by = user
        record.administered_date = data['administered_date']
        if data.get('batch_number'):
            record.batch_number = data['batch_number']
        if data.get('notes'):
            record.notes = data['notes']
        record.save(update_fields=[
            'status', 'administered_by', 'administered_date',
            'batch_number', 'notes', 'updated_at',
        ])

        return success_response(
            data=VaccinationRecordSerializer(record).data,
            message='Dose administered successfully.',
        )
