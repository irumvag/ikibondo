"""
New risk prediction endpoints (SRS v2.0):
  POST /api/v1/ml/predict/  — accepts 25 features, returns risk + SHAP explanation
  GET  /api/v1/ml/model-info/ — model version, metrics, retrained date
"""
import json
import logging
from pathlib import Path
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from apps.core.responses import success_response, error_response

logger = logging.getLogger(__name__)
_SAVED_MODELS_DIR = Path(__file__).resolve().parent / 'saved_models'


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def predict_risk(request):
    """
    POST /api/v1/ml/predict/
    Body: dict of feature values (all 25 features)
    Returns: {risk_level, confidence, top_factors, model_version}
    """
    from apps.ml_engine.prediction_service import PredictionService
    features = request.data
    if not isinstance(features, dict) or not features:
        return error_response('Request body must be a JSON object of feature values.', 'VALIDATION_ERROR')

    result = PredictionService.predict(features)
    if result is None:
        return error_response(
            'Risk model not loaded. Run: python -m apps.ml_engine.training.train_model',
            'MODEL_NOT_READY', status_code=503
        )
    return success_response(data=result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def model_info(request):
    """GET /api/v1/ml/model-info/"""
    from apps.ml_engine.prediction_service import PredictionService
    meta_path = _SAVED_MODELS_DIR / 'model_metadata.json'
    metadata = {}
    if meta_path.exists():
        try:
            with open(meta_path) as f:
                metadata = json.load(f)
        except Exception:
            pass
    return success_response(data={
        'model_loaded': PredictionService.is_loaded,
        'version': metadata.get('version', 'unknown'),
        'trained_at': metadata.get('trained_at'),
        'macro_f1': metadata.get('macro_f1'),
        'high_recall': metadata.get('high_recall'),
        'n_features': 25,
    })
