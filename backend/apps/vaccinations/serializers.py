from django.utils import timezone
from rest_framework import serializers
from .models import Vaccine, VaccinationRecord, ClinicSession, ClinicSessionAttendance


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
    zone_name = serializers.SerializerMethodField()
    guardian_name = serializers.SerializerMethodField()
    guardian_phone = serializers.SerializerMethodField()

    def get_zone_name(self, obj):
        try:
            zone = obj.child.zone
            return zone.name if zone else None
        except Exception:
            return None

    def get_guardian_name(self, obj):
        try:
            # Child has a direct guardian FK
            g = obj.child.guardian
            return g.full_name if g else None
        except Exception:
            return None

    def get_guardian_phone(self, obj):
        try:
            g = obj.child.guardian
            return g.phone_number if g else None
        except Exception:
            return None

    class Meta:
        model = VaccinationRecord
        fields = [
            'id', 'child', 'child_name', 'zone_name', 'guardian_name', 'guardian_phone',
            'vaccine', 'vaccine_name', 'vaccine_code', 'dose_number',
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


class ClinicSessionAttendanceSerializer(serializers.ModelSerializer):
    child_name = serializers.CharField(source='child.full_name', read_only=True)

    class Meta:
        model = ClinicSessionAttendance
        fields = ['id', 'child', 'child_name', 'status', 'batch_number', 'vaccination_record']
        read_only_fields = ['id', 'child_name', 'vaccination_record']


class ClinicSessionSerializer(serializers.ModelSerializer):
    vaccine_name = serializers.CharField(source='vaccine.name', read_only=True)
    camp_name = serializers.CharField(source='camp.name', read_only=True)
    opened_by_name = serializers.CharField(source='opened_by.full_name', read_only=True, allow_null=True)
    attendances = ClinicSessionAttendanceSerializer(many=True, read_only=True)
    attendance_count = serializers.SerializerMethodField()

    class Meta:
        model = ClinicSession
        fields = [
            'id', 'camp', 'camp_name', 'vaccine', 'vaccine_name',
            'session_date', 'opened_by', 'opened_by_name',
            'status', 'notes', 'created_at',
            'attendances', 'attendance_count',
        ]
        read_only_fields = ['id', 'camp', 'camp_name', 'opened_by', 'opened_by_name', 'created_at', 'attendance_count']

    def get_attendance_count(self, obj):
        return obj.attendances.count()
