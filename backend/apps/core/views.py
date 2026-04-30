from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """GET /api/v1/health/ — system status."""
    from django.db import connection
    db_ok = True
    try:
        connection.ensure_connection()
    except Exception:
        db_ok = False

    from apps.ml_engine.prediction_service import PredictionService
    ml_status = 'loaded' if PredictionService.is_loaded else 'not_loaded'

    return Response({
        'status': 'ok',
        'database': 'connected' if db_ok else 'error',
        'ml_model': ml_status,
        'version': '2.0',
    })
