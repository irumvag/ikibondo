"""
DHIS2 integration endpoints.

POST /api/v1/integrations/dhis2/sync/   — manual trigger (admin only)
GET  /api/v1/integrations/dhis2/status/ — connection info + last sync stats
"""
from django.conf import settings
from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes

from apps.accounts.permissions import IsAdminUser
from apps.core.responses import success_response, error_response
from apps.integrations import dhis2 as dhis2_module
from drf_spectacular.utils import extend_schema
from drf_spectacular.openapi import OpenApiTypes

LAST_SYNC_CACHE_KEY = 'dhis2_last_sync_summary'


@extend_schema(exclude=True)
@api_view(['GET'])
@permission_classes([IsAdminUser])
def dhis2_status_view(request):
    """GET /api/v1/integrations/dhis2/status/ — connection config + last sync stats."""
    configured = dhis2_module.is_configured()
    last_sync = cache.get(LAST_SYNC_CACHE_KEY)
    return success_response(data={
        'configured': configured,
        'dhis2_url': getattr(settings, 'DHIS2_URL', None) or None,
        'last_sync': last_sync,
    })


@extend_schema(exclude=True)
@api_view(['POST'])
@permission_classes([IsAdminUser])
def dhis2_sync_view(request):
    """
    POST /api/v1/integrations/dhis2/sync/
    Manually trigger a bidirectional DHIS2 batch sync (runs synchronously in the request).
    For large datasets use the daily Celery Beat job instead.
    Accepts optional JSON body: {"since": "2024-01-01"} to limit the sync window.
    """
    if not dhis2_module.is_configured():
        return error_response(
            'DHIS2 credentials are not configured. '
            'Set DHIS2_URL, DHIS2_USERNAME, and DHIS2_PASSWORD environment variables.',
            'NOT_CONFIGURED',
            status_code=503,
        )

    since = None
    since_str = (request.data or {}).get('since')
    if since_str:
        from datetime import datetime
        try:
            since = datetime.strptime(since_str, '%Y-%m-%d')
        except ValueError:
            return error_response(
                'Invalid date format for "since". Use YYYY-MM-DD.',
                'VALIDATION_ERROR',
                status_code=400,
            )

    summary = dhis2_module.batch_sync(since=since)
    # Cache the result for the status endpoint
    cache.set(LAST_SYNC_CACHE_KEY, summary, timeout=86_400)  # 24 h

    return success_response(data=summary)


@extend_schema(exclude=True)
@api_view(['GET'])
@permission_classes([IsAdminUser])
def dhis2_conflicts_view(request):
    """GET /api/v1/integrations/dhis2/conflicts/ — stub; returns empty list."""
    return success_response(data={'count': 0, 'results': []})


@extend_schema(exclude=True)
@api_view(['POST'])
@permission_classes([IsAdminUser])
def dhis2_conflict_retry_view(request, conflict_id):
    """POST /api/v1/integrations/dhis2/conflicts/<id>/retry/ — stub."""
    return error_response(
        'Conflict retry not yet implemented.',
        'NOT_IMPLEMENTED',
        status_code=501,
    )
