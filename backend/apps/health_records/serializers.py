from rest_framework import serializers
from .models import HealthRecord, ClinicalNote


class HealthRecordSerializer(serializers.ModelSerializer):
    child_name = serializers.CharField(source='child.full_name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.full_name', read_only=True, allow_null=True)
    nutrition_status_display = serializers.CharField(source='get_nutrition_status_display', read_only=True)
    zone_name = serializers.CharField(source='zone.name', read_only=True, allow_null=True)
    # data_source has a model default of 'manual'; make it optional on input
    data_source = serializers.ChoiceField(
        choices=[('manual', 'Manual'), ('iot', 'IoT/BLE Device')],
        default='manual',
        required=False,
    )

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
            'id', 'recorded_by', 'zone',
            'weight_for_height_z', 'height_for_age_z', 'weight_for_age_z', 'bmi_z',
            'nutrition_status', 'risk_level', 'risk_factors', 'model_version',
            'ml_predicted_status', 'ml_confidence', 'ml_risk_flags',
            'created_at',
        ]


class ClinicalNoteSerializer(serializers.ModelSerializer):
    author_name       = serializers.CharField(source='author.full_name', read_only=True, allow_null=True)
    author_role       = serializers.CharField(source='author.role',      read_only=True, allow_null=True)
    note_type_display = serializers.CharField(source='get_note_type_display', read_only=True)

    class Meta:
        model  = ClinicalNote
        fields = [
            'id',
            'author', 'author_name', 'author_role',
            'health_record', 'child',
            'note_type', 'note_type_display',
            'content', 'is_pinned',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id',
            'author', 'author_name', 'author_role',
            'note_type_display',
            # Targets are injected by the view, never from request body
            'health_record', 'child',
            'created_at', 'updated_at',
        ]
