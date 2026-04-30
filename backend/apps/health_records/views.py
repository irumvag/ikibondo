import logging
from django.utils import timezone
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from apps.core.responses import success_response, created_response, error_response
from .models import HealthRecord
from .serializers import HealthRecordSerializer

logger = logging.getLogger(__name__)


class HealthRecordViewSet(viewsets.ModelViewSet):
    queryset = HealthRecord.objects.select_related('child', 'recorded_by', 'zone').all()
    serializer_class = HealthRecordSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['child', 'nutrition_status', 'measurement_date', 'risk_level', 'zone']
    ordering_fields = ['measurement_date', 'created_at']
    http_method_names = ['get', 'post', 'head', 'options']  # Records are immutable once saved

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record = serializer.save(recorded_by=request.user)

        # Run ML prediction synchronously so the response includes risk_level + risk_factors
        self._run_prediction(record)

        # If HIGH risk — trigger async notifications
        if record.risk_level == 'HIGH':
            try:
                from apps.notifications.tasks import notify_high_risk
                notify_high_risk.delay(str(record.id))
            except Exception as e:
                logger.warning('Failed to enqueue notify_high_risk for record %s: %s', record.id, e)

        return created_response(
            data=HealthRecordSerializer(record).data,
            message='Health record saved with risk assessment.',
        )

    def _run_prediction(self, record):
        """Build feature vector, call prediction service, persist results on record."""
        try:
            from apps.ml_engine.features import build_feature_vector
            from apps.ml_engine.prediction_service import PredictionService

            features = build_feature_vector(record)
            if features is None:
                return

            result = PredictionService.predict(features)
            if result is None:
                # Model not loaded yet — keep risk_level null, schedule async fallback
                try:
                    from apps.health_records.tasks import run_malnutrition_prediction
                    run_malnutrition_prediction.delay(str(record.id))
                except Exception:
                    pass
                return

            record.risk_level = result['risk_level']
            record.risk_factors = result.get('top_factors', [])
            record.model_version = result.get('model_version', '')
            record.save(update_fields=['risk_level', 'risk_factors', 'model_version', 'updated_at'])
        except Exception as e:
            logger.warning('Prediction failed for record %s: %s', record.id, e)

    @action(detail=False, methods=['get'], url_path='zone-summary')
    def zone_summary(self, request):
        """GET /api/v1/health-records/zone-summary/?zone=<id>"""
        zone_id = request.query_params.get('zone')
        if not zone_id:
            return error_response('zone query param required.', 'VALIDATION_ERROR')
        dist = {'LOW': 0, 'MEDIUM': 0, 'HIGH': 0, 'UNKNOWN': 0}
        records = HealthRecord.objects.filter(zone_id=zone_id, is_active=True)
        for r in records:
            dist[r.risk_level or 'UNKNOWN'] = dist.get(r.risk_level or 'UNKNOWN', 0) + 1
        return success_response(data={'zone_id': zone_id, 'risk_distribution': dist, 'total': records.count()})


# ── Growth chart endpoint (standalone function-based view) ─────────────────────

from rest_framework.decorators import api_view, permission_classes
from apps.children.models import Child


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def growth_data_view(request, child_id):
    """
    GET /api/v1/growth-data/<child_id>/
    Returns measurement time-series + WHO percentile bands (p3/p15/p50/p85/p97).
    """
    try:
        child = Child.objects.get(id=child_id)
    except Child.DoesNotExist:
        return error_response('Child not found.', 'NOT_FOUND', status_code=404)

    records = HealthRecord.objects.filter(
        child=child, is_active=True
    ).order_by('measurement_date')

    measurements = []
    for r in records:
        measurements.append({
            'date': str(r.measurement_date),
            'age_months': child.age_months,
            'weight_kg': float(r.weight_kg) if r.weight_kg else None,
            'height_cm': float(r.height_cm) if r.height_cm else None,
            'waz': float(r.weight_for_age_z) if r.weight_for_age_z is not None else None,
            'haz': float(r.height_for_age_z) if r.height_for_age_z is not None else None,
            'whz': float(r.weight_for_height_z) if r.weight_for_height_z is not None else None,
        })

    who_percentiles = _build_who_percentile_bands(child.sex)

    return success_response(data={
        'child_id': str(child_id),
        'child_name': child.full_name,
        'measurements': measurements,
        'who_percentiles': who_percentiles,
    })


def _build_who_percentile_bands(sex: str) -> dict:
    """Return WHO weight-for-age and height-for-age percentile bands for 0–72 months."""
    from apps.health_records.who_zscore import (
        _HAZ_LMS_MALE, _HAZ_LMS_FEMALE, _lms_zscore, _interpolate_lms
    )
    import math

    def z_to_x(age, z_score, table, is_height=True):
        """Invert LMS z-score to raw measurement at a given z."""
        try:
            L, M, S = _interpolate_lms(table, age)
            if L == 0:
                return round(M * math.exp(z_score * S), 1)
            return round(M * ((1 + L * S * z_score) ** (1 / L)), 1)
        except Exception:
            return None

    haz_table = _HAZ_LMS_MALE if sex == 'M' else _HAZ_LMS_FEMALE

    ages = list(range(0, 73, 3))  # 0,3,6,...,72 months
    percentile_z = {'p3': -1.88, 'p15': -1.04, 'p50': 0.0, 'p85': 1.04, 'p97': 1.88}

    height_bands = {p: [] for p in percentile_z}
    weight_bands = {p: [] for p in percentile_z}

    for age in ages:
        for label, z in percentile_z.items():
            h = z_to_x(age, z, haz_table, is_height=True)
            height_bands[label].append({'age_months': age, 'value': h})
            # Approximate weight from height using rough scaling
            w = round(z_to_x(age, z, haz_table, is_height=True) * 0.138, 1) if h else None
            weight_bands[label].append({'age_months': age, 'value': w})

    return {
        'weight_for_age': weight_bands,
        'height_for_age': height_bands,
    }
