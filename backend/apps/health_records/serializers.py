from rest_framework import serializers
from .models import HealthRecord


class HealthRecordSerializer(serializers.ModelSerializer):
    child_name = serializers.CharField(source='child.full_name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.full_name', read_only=True, allow_null=True)
    nutrition_status_display = serializers.CharField(source='get_nutrition_status_display', read_only=True)
    zone_name = serializers.CharField(source='zone.name', read_only=True, allow_null=True)

    class Meta:
        model = HealthRecord
        fields = [
            'id', 'child', 'child_name',
            'measurement_date', 'recorded_by', 'recorded_by_name',
            'zone', 'zone_name',
            # Raw measurements
            'weight_kg', 'height_cm', 'muac_cm', 'oedema',
            'head_circumference_cm',
            # Vital signs
            'temperature_c', 'respiratory_rate', 'heart_rate', 'spo2',
            # Symptoms
            'symptom_flags',
            # Computed z-scores
            'weight_for_height_z', 'height_for_age_z', 'weight_for_age_z', 'bmi_z',
            # Classification
            'nutrition_status', 'nutrition_status_display',
            # Risk assessment (ML)
            'risk_level', 'risk_factors', 'model_version',
            # Legacy ML fields
            'ml_predicted_status', 'ml_confidence', 'ml_risk_flags',
            # Metadata
            'data_source', 'notes', 'created_at',
        ]
        read_only_fields = [
            'id', 'zone',
            'weight_for_height_z', 'height_for_age_z', 'weight_for_age_z', 'bmi_z',
            'nutrition_status', 'risk_level', 'risk_factors', 'model_version',
            'ml_predicted_status', 'ml_confidence', 'ml_risk_flags',
            'created_at',
        ]
