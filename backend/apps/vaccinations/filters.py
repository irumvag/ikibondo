import django_filters
from .models import Vaccine, VaccinationRecord


class VaccineFilter(django_filters.FilterSet):
    class Meta:
        model = Vaccine
        fields = ['is_active']


class VaccinationRecordFilter(django_filters.FilterSet):
    camp = django_filters.UUIDFilter(field_name='child__camp__id')
    zone = django_filters.UUIDFilter(field_name='child__zone__id')

    class Meta:
        model = VaccinationRecord
        fields = ['child', 'status', 'vaccine', 'dropout_risk_tier', 'camp', 'zone']
