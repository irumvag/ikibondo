from rest_framework import serializers
from .models import MLPredictionLog


class MLPredictionLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = MLPredictionLog
        fields = ['id', 'model_name', 'model_version', 'predicted_label',
                  'confidence', 'output_data', 'created_at']
        read_only_fields = fields


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
