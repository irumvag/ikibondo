import django_filters
from django.utils import timezone
from .models import Vaccine, VaccinationRecord


class VaccineFilter(django_filters.FilterSet):
    class Meta:
        model = Vaccine
        fields = ['is_active']


class VaccinationRecordFilter(django_filters.FilterSet):
    camp           = django_filters.UUIDFilter(field_name='child__camp__id')
    child__camp    = django_filters.UUIDFilter(field_name='child__camp__id')
    zone           = django_filters.UUIDFilter(field_name='child__zone__id')
    scheduled_date = django_filters.DateFilter(field_name='scheduled_date')
    is_overdue     = django_filters.BooleanFilter(method='filter_is_overdue')

    def filter_is_overdue(self, queryset, name, value):
        today = timezone.now().date()
        if value:
            return queryset.filter(scheduled_date__lt=today, status='SCHEDULED')
        return queryset.exclude(scheduled_date__lt=today, status='SCHEDULED')

    class Meta:
        model = VaccinationRecord
        fields = ['child', 'status', 'vaccine', 'dropout_risk_tier', 'camp', 'child__camp', 'zone', 'scheduled_date', 'is_overdue']
