"""
Celery tasks for DHIS2 integration.
"""
import logging
from datetime import timedelta

from celery import shared_task
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)

LAST_SYNC_CACHE_KEY = 'dhis2_last_sync_summary'


@shared_task(name='apps.integrations.tasks.dhis2_daily_sync', bind=True, max_retries=2)
def dhis2_daily_sync(self):
    """
    Daily bidirectional DHIS2 sync — scheduled via Celery Beat at 02:00 Kigali.
    Syncs records updated in the last 25 hours (1-hour overlap for safety).
    """
    from apps.integrations.dhis2 import batch_sync, is_configured

    if not is_configured():
        logger.info('dhis2_daily_sync: DHIS2 not configured — skipping')
        return {'status': 'skipped', 'reason': 'not configured'}

    since = timezone.now() - timedelta(hours=25)
    try:
        summary = batch_sync(since=since)
        cache.set(LAST_SYNC_CACHE_KEY, summary, timeout=86_400)
        logger.info('dhis2_daily_sync complete: %s', summary)
        return summary
    except Exception as exc:
        logger.error('dhis2_daily_sync failed: %s', exc)
        raise self.retry(exc=exc, countdown=300)


@shared_task(name='apps.integrations.tasks.dhis2_push_child', bind=True, max_retries=3)
def dhis2_push_child(self, child_id: str):
    """
    Real-time task: push a single child to DHIS2 after registration.
    Retries up to 3× with 60-second back-off.
    """
    from apps.children.models import Child
    from apps.integrations.dhis2 import push_child_registration, is_configured

    if not is_configured():
        return {'status': 'skipped'}

    try:
        child = Child.objects.get(id=child_id)
    except Child.DoesNotExist:
        logger.warning('dhis2_push_child: child %s not found', child_id)
        return {'status': 'not_found'}

    if child.dhis2_uid:
        return {'status': 'already_synced', 'dhis2_uid': child.dhis2_uid}

    result = push_child_registration(child)
    if result['status'] == 'ok' and result.get('dhis2_uid'):
        Child.objects.filter(pk=child.pk).update(dhis2_uid=result['dhis2_uid'])
    elif result['status'] == 'error':
        raise self.retry(exc=Exception(result['detail']), countdown=60)

    return result


@shared_task(name='apps.integrations.tasks.dhis2_push_high_risk', bind=True, max_retries=3)
def dhis2_push_high_risk(self, health_record_id: str):
    """
    Real-time task: push a HIGH-risk HealthRecord event to DHIS2.
    Triggered after ML classification produces a HIGH result.
    """
    from apps.health_records.models import HealthRecord
    from apps.integrations.dhis2 import is_configured, push_vaccination_record

    if not is_configured():
        return {'status': 'skipped'}

    try:
        record = HealthRecord.objects.select_related('child').get(id=health_record_id)
    except HealthRecord.DoesNotExist:
        logger.warning('dhis2_push_high_risk: record %s not found', health_record_id)
        return {'status': 'not_found'}

    if record.risk_level != 'HIGH':
        return {'status': 'not_high_risk', 'risk_level': record.risk_level}

    # Ensure the child exists in DHIS2 first
    child = record.child
    if not child.dhis2_uid:
        dhis2_push_child.apply_async(args=[str(child.id)], countdown=0)

    # Push associated unsynced vaccination records for this child
    from apps.vaccinations.models import VaccinationRecord
    from apps.integrations.dhis2 import push_vaccination_record as _push_vax

    pushed = 0
    for vr in VaccinationRecord.objects.filter(
        child=child,
        status='ADMINISTERED',
        dhis2_event_uid__isnull=True,
    ).select_related('vaccine')[:20]:
        result = _push_vax(vr)
        if result['status'] == 'ok' and result.get('event_uid'):
            VaccinationRecord.objects.filter(pk=vr.pk).update(dhis2_event_uid=result['event_uid'])
            pushed += 1

    logger.info(
        'dhis2_push_high_risk: child=%s record=%s pushed_vax=%d',
        child.registration_number, health_record_id, pushed,
    )
    return {'status': 'ok', 'pushed_vaccinations': pushed}
