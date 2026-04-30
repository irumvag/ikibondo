"""
ML inference endpoints — Phase 3 full implementation.

Every prediction:
  1. Validates input with a DRF serializer
  2. Calls the in-memory model via ModelLoader
  3. Writes an MLPredictionLog row for audit + retraining
  4. Returns the standard API envelope
"""
import logging
import pandas as pd
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.core.responses import success_response, error_response
from .loader import ModelLoader
from .serializers import (
    MalnutritionPredictSerializer,
    GrowthPredictSerializer,
    VaccinationDropoutSerializer,
)

logger = logging.getLogger(__name__)


def _log_prediction(child_id, model_name, input_data, output_data, label, confidence):
    """Write an MLPredictionLog row. Fails silently so prediction is never blocked."""
    try:
        from .models import MLPredictionLog
        from apps.children.models import Child
        child = Child.objects.get(id=child_id)
        MLPredictionLog.objects.create(
            child=child,
            model_name=model_name,
            model_version='v1',
            input_data=input_data,
            output_data=output_data,
            predicted_label=label,
            confidence=round(confidence, 3),
        )
    except Exception as e:
        logger.warning('MLPredictionLog write failed: %s', e)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def predict_malnutrition(request):
    """
    POST /api/v1/ml/predict/malnutrition/
    Body: {child_id, age_months, sex, weight_kg, height_cm, muac_cm (optional)}
    Returns predicted nutrition status (SAM/MAM/NORMAL) with confidence + per-class proba.
    """
    serializer = MalnutritionPredictSerializer(data=request.data)
    if not serializer.is_valid():
        return error_response(str(serializer.errors), 'VALIDATION_ERROR')

    model = ModelLoader.get('malnutrition')
    if model is None:
        return error_response(
            'Malnutrition model not loaded. Run ml/scripts/train_malnutrition_simple.py first.',
            'MODEL_NOT_READY', status_code=503
        )

    data = serializer.validated_data
    input_features = {
        'age_months':      data['age_months'],
        'sex_binary':      1 if data['sex'] == 'M' else 0,
        'camp_id':         0,
        'weight_kg':       data['weight_kg'],
        'height_cm':       data['height_cm'],
        'muac_cm':         data.get('muac_cm', 0.0) or 0.0,
        'oedema':          0,
        'whz':             _approx_whz(data['weight_kg'], data['height_cm']),
        'haz':             0.0,
        'age_group':       _age_group(data['age_months']),
        'wasting':         0,
        'severe_wasting':  0,
        'muac_low':        1 if (data.get('muac_cm') or 15) < 12.5 else 0,
        'muac_critical':   1 if (data.get('muac_cm') or 15) < 11.5 else 0,
    }
    whz = input_features['whz']
    input_features['wasting']        = 1 if whz < -2 else 0
    input_features['severe_wasting'] = 1 if whz < -3 else 0

    try:
        X           = pd.DataFrame([input_features])
        prediction  = str(model.predict(X)[0])
        proba_arr   = model.predict_proba(X)[0]
        classes     = model.classes_
        confidence  = float(max(proba_arr))
        proba_dict  = {str(c): round(float(p), 3) for c, p in zip(classes, proba_arr)}

        # Feature importance: show which inputs drove this prediction
        feature_importance = _compute_feature_importance(input_features, model, X)

        output_data = {
            'predicted_status': prediction,
            'confidence':       round(confidence, 3),
            'probabilities':    proba_dict,
            'feature_importance': feature_importance,
        }
        _log_prediction(
            child_id=data['child_id'], model_name='malnutrition',
            input_data=input_features, output_data=output_data,
            label=prediction, confidence=confidence,
        )
        return success_response(data=output_data)

    except Exception as e:
        logger.exception('Malnutrition prediction error: %s', e)
        return error_response('Prediction failed.', 'PREDICTION_ERROR', status_code=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def predict_growth(request):
    """
    POST /api/v1/ml/predict/growth/
    Body: {child_id}
    Fetches child's last measurements and returns WHZ trend + risk flag.
    Falls back to linear extrapolation when LSTM model is not loaded.
    """
    serializer = GrowthPredictSerializer(data=request.data)
    if not serializer.is_valid():
        return error_response(str(serializer.errors), 'VALIDATION_ERROR')

    child_id = serializer.validated_data['child_id']

    try:
        from apps.children.models import Child
        from apps.health_records.models import HealthRecord
        child   = Child.objects.get(id=child_id)
        records = list(HealthRecord.objects.filter(child=child).order_by('measurement_date')[:8])
    except Child.DoesNotExist:
        return error_response('Child not found.', 'NOT_FOUND', status_code=404)

    if len(records) < 2:
        return error_response(
            f'Need at least 2 measurements for growth prediction. Found {len(records)}.',
            'INSUFFICIENT_DATA', status_code=422
        )

    model = ModelLoader.get('growth')

    # Linear extrapolation fallback (works with or without LSTM model)
    whz_values = [float(r.weight_for_height_z) for r in records if r.weight_for_height_z]
    if len(whz_values) >= 2:
        recent_trend = whz_values[-1] - whz_values[-2]
        pred_30 = round(whz_values[-1] + recent_trend * 1.0, 2)
        pred_60 = round(whz_values[-1] + recent_trend * 2.0, 2)
        pred_90 = round(whz_values[-1] + recent_trend * 3.0, 2)
        risk_flag = bool(recent_trend < -0.3 or pred_90 < -2.0)
    else:
        pred_30 = pred_60 = pred_90 = 0.0
        risk_flag = False

    # Use ML model if available; otherwise keep linear extrapolation result
    ml_method = 'linear_extrapolation'
    ml_confidence = 0.7
    if model is not None:
        try:
            import numpy as np
            # Build feature sequence: last 3 measurements (pad if fewer)
            seq = [[r.child.age_months, 1 if r.child.sex == 'M' else 0,
                    float(r.weight_kg), float(r.height_cm),
                    float(r.weight_for_height_z or 0)] for r in records[-3:]]
            while len(seq) < 3:
                seq.insert(0, seq[0])

            # Check if it's the lightweight NN (flattened input) or Keras LSTM (3D input)
            if hasattr(model, 'predict_proba'):
                # Lightweight NN: expects flattened (1, 15) input
                X_flat = np.array(seq, dtype=np.float64).flatten().reshape(1, -1)
                proba = model.predict_proba(X_flat)[0]
                risk_prob = float(proba[1])
                risk_flag = risk_prob > 0.5
                ml_confidence = max(float(proba[0]), float(proba[1]))
                ml_method = 'neural_network'
            else:
                # Keras LSTM: expects (1, 3, 5) input
                X_seq = np.array([seq], dtype=np.float32)
                prob = float(model.predict(X_seq)[0][0])
                risk_flag = prob > 0.5
                ml_confidence = 0.85
                ml_method = 'lstm'
        except Exception as e:
            logger.warning('ML growth inference failed, using linear extrapolation: %s', e)

    output_data = {
        'child_id':            str(child_id),
        'measurements_used':   len(records),
        'latest_whz':          float(records[-1].weight_for_height_z or 0),
        'predicted_whz_30d':   pred_30,
        'predicted_whz_60d':   pred_60,
        'predicted_whz_90d':   pred_90,
        'risk_flag':           risk_flag,
        'method':              ml_method,
    }
    _log_prediction(
        child_id=child_id, model_name='growth',
        input_data={'child_id': str(child_id), 'measurements': len(records)},
        output_data=output_data,
        label='risk' if risk_flag else 'stable',
        confidence=ml_confidence,
    )
    return success_response(data=output_data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def predict_vaccination_dropout(request):
    """
    POST /api/v1/ml/predict/vaccination/
    Body: {child_id, vaccine_id}
    Returns dropout probability and risk tier (LOW/MEDIUM/HIGH).
    """
    serializer = VaccinationDropoutSerializer(data=request.data)
    if not serializer.is_valid():
        return error_response(str(serializer.errors), 'VALIDATION_ERROR')

    model = ModelLoader.get('vaccination')
    if model is None:
        return error_response(
            'Vaccination model not loaded. Run ml/scripts/train_vaccination_simple.py first.',
            'MODEL_NOT_READY', status_code=503
        )

    child_id   = serializer.validated_data['child_id']
    vaccine_id = serializer.validated_data['vaccine_id']

    try:
        from apps.children.models import Child
        from apps.vaccinations.models import VaccinationRecord, DoseStatus
        child = Child.objects.get(id=child_id)
    except Child.DoesNotExist:
        return error_response('Child not found.', 'NOT_FOUND', status_code=404)

    missed_count = child.vaccinations.filter(status=DoseStatus.MISSED).count()

    input_features = {
        'age_months':            child.age_months,
        'previous_missed_doses': missed_count,
        'distance_km':           3.5,
        'guardian_age':          28,
        'num_siblings':          2,
        'nutrition_status':      _nutrition_code(child),
        'days_since_last_visit': _days_since_last_visit(child),
    }

    try:
        X         = pd.DataFrame([input_features])
        proba_arr = model.predict_proba(X)[0]
        # Resolve 'missed' column index — works for both old (int) and new (str) classes
        classes   = list(model.classes_)
        missed_idx = classes.index('missed') if 'missed' in classes else 1
        proba      = float(proba_arr[missed_idx])
        tier       = 'HIGH' if proba > 0.65 else ('MEDIUM' if proba > 0.35 else 'LOW')
        output_data = {
            'child_id':            str(child_id),
            'vaccine_id':          str(vaccine_id),
            'dropout_probability': round(proba, 3),
            'risk_tier':           tier,
        }
        _log_prediction(
            child_id=child_id, model_name='vaccination',
            input_data=input_features, output_data=output_data,
            label=tier, confidence=abs(proba - 0.5) * 2,
        )
        # Persist to VaccinationRecord
        try:
            from apps.vaccinations.models import VaccinationRecord, DoseStatus
            record = child.vaccinations.filter(
                vaccine_id=vaccine_id, status=DoseStatus.SCHEDULED
            ).first()
            if record:
                record.dropout_probability = round(proba, 3)
                record.dropout_risk_tier   = tier
                record.save(update_fields=['dropout_probability', 'dropout_risk_tier', 'updated_at'])
        except Exception:
            pass
        return success_response(data=output_data)

    except Exception as e:
        logger.exception('Vaccination dropout prediction error: %s', e)
        return error_response('Prediction failed.', 'PREDICTION_ERROR', status_code=500)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _compute_feature_importance(input_features, model, X):
    """
    Compute per-feature contribution to this specific prediction.
    Uses simple perturbation-based importance: for each feature, zero it out
    and measure the change in predicted confidence.
    """
    try:
        base_proba = model.predict_proba(X)[0]
        base_conf = float(max(base_proba))
        importance = {}

        for feat_name, feat_val in input_features.items():
            if feat_val == 0:
                # Skip already-zero features (no contribution to measure)
                importance[feat_name] = 0.0
                continue
            perturbed = X.copy()
            perturbed[feat_name] = 0
            new_proba = model.predict_proba(perturbed)[0]
            new_conf = float(max(new_proba))
            # Higher drop = more important
            importance[feat_name] = round(abs(base_conf - new_conf), 3)

        # Sort by importance descending, return top contributors
        sorted_imp = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))
        return sorted_imp
    except Exception:
        return {}


def _approx_whz(weight_kg, height_cm):
    weight_median = max(0.1, (height_cm - 45) * 0.18 + 2.2)
    return round((weight_kg - weight_median) / (weight_median * 0.09), 2)


def _age_group(age_months):
    if age_months <= 6:  return 0
    if age_months <= 12: return 1
    if age_months <= 24: return 2
    if age_months <= 36: return 3
    return 4


def _days_since_last_visit(child):
    from django.utils import timezone
    last = child.health_records.order_by('-measurement_date').first()
    if not last:
        return 999
    return (timezone.now().date() - last.measurement_date).days


def _nutrition_code(child):
    last = child.health_records.order_by('-measurement_date').first()
    if not last:
        return 0
    return {'NORMAL': 0, 'MAM': 1, 'SAM': 2}.get(last.nutrition_status, 0)
