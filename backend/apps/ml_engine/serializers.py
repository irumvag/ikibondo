from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from .models import MLPredictionLog, MLModelVersion


class MLPredictionLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = MLPredictionLog
        fields = ['id', 'model_name', 'model_version', 'predicted_label',
                  'confidence', 'output_data', 'created_at']
        read_only_fields = fields


class MLModelVersionSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = MLModelVersion
        fields = [
            'id', 'model_name', 'version', 'file_path', 'f1_score', 'recall',
            'precision', 'deployed', 'notes', 'uploaded_by', 'uploaded_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'deployed', 'uploaded_by', 'created_at']

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_uploaded_by_name(self, obj):
        return obj.uploaded_by.full_name if obj.uploaded_by else None


class MalnutritionPredictSerializer(serializers.Serializer):
    child_id = serializers.UUIDField()
    age_months = serializers.IntegerField(min_value=0, max_value=60)
    sex = serializers.ChoiceField(choices=['M', 'F'])
    weight_kg = serializers.FloatField(min_value=1.0, max_value=30.0)
    height_cm = serializers.FloatField(min_value=40.0, max_value=130.0)
    muac_cm = serializers.FloatField(min_value=5.0, max_value=30.0, required=False)


class GrowthPredictSerializer(serializers.Serializer):
    child_id = serializers.UUIDField()


class VaccinationDropoutSerializer(serializers.Serializer):
    child_id = serializers.UUIDField()
    vaccine_id = serializers.UUIDField()
