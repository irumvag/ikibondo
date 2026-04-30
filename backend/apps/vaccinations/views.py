from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend

from apps.core.responses import success_response
from apps.accounts.permissions import IsCampStaff
from .models import VaccinationRecord, Vaccine
from .serializers import VaccinationRecordSerializer, VaccineSerializer


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
            from django.utils import timezone
            if not instance.administered_date:
                instance.administered_date = timezone.now().date()
            instance.save(update_fields=['administered_by', 'administered_date', 'updated_at'])
