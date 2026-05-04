from django.utils import timezone
from rest_framework import serializers
from .models import Vaccine, VaccinationRecord


class VaccineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vaccine
        fields = ['id', 'name', 'short_code', 'dose_number', 'recommended_age_weeks', 'is_active']


class VaccinationRecordSerializer(serializers.ModelSerializer):
    vaccine_name = serializers.CharField(source='vaccine.name', read_only=True)
    vaccine_code = serializers.CharField(source='vaccine.short_code', read_only=True)
    dose_number = serializers.IntegerField(source='vaccine.dose_number', read_only=True)
    child_name = serializers.CharField(source='child.full_name', read_only=True)
    administered_by_name = serializers.CharField(source='administered_by.full_name', read_only=True, allow_null=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = VaccinationRecord
        fields = [
            'id', 'child', 'child_name', 'vaccine', 'vaccine_name', 'vaccine_code', 'dose_number',
            'scheduled_date', 'administered_date', 'administered_by', 'administered_by_name',
            'status', 'batch_number',
            'dropout_probability', 'dropout_risk_tier',
            'is_overdue', 'notes', 'created_at',
        ]
        read_only_fields = ['id', 'dropout_probability', 'dropout_risk_tier', 'created_at']
        extra_kwargs = {
            'child': {'required': True},
            'vaccine': {'required': True},
            'scheduled_date': {'required': True},
        }


class AdministerSerializer(serializers.Serializer):
    administered_date = serializers.DateField(default=timezone.localdate)
    batch_number = serializers.CharField(required=False, allow_blank=True, default='')
    notes = serializers.CharField(required=False, allow_blank=True, default='')
