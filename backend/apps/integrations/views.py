"""
DHIS2 integration endpoints.

POST /api/v1/integrations/dhis2/sync/   — manual trigger (admin only)
GET  /api/v1/integrations/dhis2/status/ — connection info + last sync stats
"""
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
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
    problems = dhis2_module.configuration_problems()
    last_sync = cache.get(LAST_SYNC_CACHE_KEY)
    return success_response(data={
        'configured': not problems,
        'problems': problems,
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
            'DHIS2 is not ready: ' + ' '.join(dhis2_module.configuration_problems()),
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
    """GET /api/v1/integrations/dhis2/conflicts/ — records that failed to reach DHIS2 and are still unresolved."""
    from apps.integrations.models import DHIS2SyncFailure
    failures = DHIS2SyncFailure.objects.filter(resolved_at__isnull=True)
    results = [
        {
            'id': str(f.id),
            'object_type': f.object_type,
            'object_id': str(f.object_id),
            'label': f.label,
            'error': f.error,
            'attempts': f.attempts,
            'last_attempt_at': f.last_attempt_at.isoformat(),
        }
        for f in failures[:200]
    ]
    return success_response(data={'count': failures.count(), 'results': results})


@extend_schema(exclude=True)
@api_view(['POST'])
@permission_classes([IsAdminUser])
def dhis2_conflict_retry_view(request, conflict_id):
    """POST /api/v1/integrations/dhis2/conflicts/<id>/retry/ — push that one record again now."""
    from apps.integrations.models import DHIS2SyncFailure

    failure = DHIS2SyncFailure.objects.filter(id=conflict_id, resolved_at__isnull=True).first()
    if failure is None:
        return error_response('No open sync failure with that id.', 'NOT_FOUND', status_code=404)
    if not dhis2_module.is_configured():
        return error_response('DHIS2 is not ready: ' + ' '.join(dhis2_module.configuration_problems()),
                              'NOT_CONFIGURED', status_code=503)

    if failure.object_type == DHIS2SyncFailure.OBJECT_CHILD:
        from apps.children.models import Child
        obj = Child.objects.filter(pk=failure.object_id).first()
        push = dhis2_module.push_child_registration
        uid_field, uid_key = 'dhis2_uid', 'dhis2_uid'
    else:
        from apps.vaccinations.models import VaccinationRecord
        obj = VaccinationRecord.objects.select_related('child', 'vaccine').filter(pk=failure.object_id).first()
        push = dhis2_module.push_vaccination_record
        uid_field, uid_key = 'dhis2_event_uid', 'event_uid'

    if obj is None:
        # The record was deleted locally; nothing left to send
        failure.resolved_at = timezone.now()
        failure.save(update_fields=['resolved_at'])
        return success_response(message='The record no longer exists; the failure was closed.')

    result = push(obj)
    dhis2_module.record_push_result(failure.object_type, obj, failure.label, result)
    if result['status'] == 'ok':
        if result.get(uid_key):
            type(obj).objects.filter(pk=obj.pk).update(**{uid_field: result[uid_key]})
        return success_response(message='Sent to DHIS2.')
    return error_response(f'DHIS2 rejected it again: {result["detail"]}', 'DHIS2_ERROR', status_code=502)
