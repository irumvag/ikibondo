"""
DHIS2 integration status and conflict endpoints.
Actual sync is a no-op until DHIS2 credentials are provisioned.
"""
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminUser
from apps.core.responses import success_response, error_response


@api_view(['GET'])
@permission_classes([IsAdminUser])
def dhis2_status_view(request):
    """GET /api/v1/integrations/dhis2/status/ — returns connection config & conflict count."""
    base_url = getattr(settings, 'DHIS2_BASE_URL', None) or None
    configured = bool(base_url and getattr(settings, 'DHIS2_USERNAME', None))
    return success_response(data={
        'configured': configured,
        'base_url': base_url,
        'last_sync': None,  # TODO: persist last_sync timestamp when sync is wired
        'pending_conflicts': 0,  # DHIS2SyncConflict model deferred to Phase 7
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def dhis2_conflicts_view(request):
    """GET /api/v1/integrations/dhis2/conflicts/ — stub; returns empty list until model exists."""
    return success_response(data={'count': 0, 'results': []})


@api_view(['POST'])
@permission_classes([IsAdminUser])
def dhis2_conflict_retry_view(request, conflict_id):
    """POST /api/v1/integrations/dhis2/conflicts/<id>/retry/ — stub."""
    return error_response(
        'DHIS2 sync not yet implemented. Awaiting credentials.',
        'NOT_IMPLEMENTED',
        status_code=501,
    )
