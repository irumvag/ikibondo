"""
DHIS2 Web API v2 integration — bidirectional sync for child registrations
and immunisation records.

Push (Ikibondo → DHIS2):
  - New child registration  → POST /api/tracker/trackedEntities
  - Vaccination record      → POST /api/tracker/events

Pull (DHIS2 → Ikibondo):
  - Query TrackedEntityInstances updated since a given date
  - Upsert local VaccinationRecord rows

Credentials (never committed — loaded from env):
  DHIS2_URL       e.g. https://play.im.dhis2.org/40.6.2
  DHIS2_USERNAME
  DHIS2_PASSWORD

If any credential is missing the module logs a warning and all functions
are no-ops that return gracefully — the app continues to work offline.
"""
import logging
from datetime import datetime, date
from typing import Any

import requests
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

# ── credentials ───────────────────────────────────────────────────────────────

def _creds():
    """Return (base_url, username, password) or None if unconfigured."""
    url  = getattr(settings, 'DHIS2_URL', '') or ''
    user = getattr(settings, 'DHIS2_USERNAME', '') or ''
    pw   = getattr(settings, 'DHIS2_PASSWORD', '') or ''
    if url and user and pw:
        return url.rstrip('/'), user, pw
    return None


def _session(base_url, username, password):
    s = requests.Session()
    s.auth = (username, password)
    s.headers.update({'Content-Type': 'application/json', 'Accept': 'application/json'})
    return s


def is_configured():
    return _creds() is not None


# ── DHIS2 attribute / program UIDs ────────────────────────────────────────────
# These are placeholder UIDs — replace with the real UIDs from the DHIS2 instance
# metadata once credentials are provisioned.  They are isolated here so nothing
# else in the codebase needs to change.

PROGRAM_UID       = getattr(settings, 'DHIS2_PROGRAM_UID',    'ikibondoEPI01')
TE_TYPE_UID       = getattr(settings, 'DHIS2_TE_TYPE_UID',    'ikibondoChild')
ATTR_REG_NUMBER   = getattr(settings, 'DHIS2_ATTR_REG_NUMBER', 'ikibondoRegNr')
ATTR_FULL_NAME    = getattr(settings, 'DHIS2_ATTR_FULL_NAME',  'ikibondoName')
ATTR_DOB          = getattr(settings, 'DHIS2_ATTR_DOB',        'ikibondoDOB')
ATTR_SEX          = getattr(settings, 'DHIS2_ATTR_SEX',        'ikibondoSex')
ATTR_CAMP         = getattr(settings, 'DHIS2_ATTR_CAMP',       'ikibondoCamp')
DATA_ELEM_VACCINE = getattr(settings, 'DHIS2_DE_VACCINE',      'ikibondoVaccine')
DATA_ELEM_STATUS  = getattr(settings, 'DHIS2_DE_VAX_STATUS',   'ikibondoVaxStat')
DATA_ELEM_BATCH   = getattr(settings, 'DHIS2_DE_BATCH',        'ikibondoBatch')
ORG_UNIT_UID      = getattr(settings, 'DHIS2_ORG_UNIT_UID',   'ikibondoOU01')

TIMEOUT = 30  # seconds per HTTP request


# ── push helpers ──────────────────────────────────────────────────────────────

def _child_to_tei(child):
    """Map a Child model instance to a DHIS2 TrackedEntity payload."""
    return {
        'trackedEntityType': TE_TYPE_UID,
        'orgUnit': ORG_UNIT_UID,
        'attributes': [
            {'attribute': ATTR_REG_NUMBER, 'value': child.registration_number},
            {'attribute': ATTR_FULL_NAME,  'value': child.full_name},
            {'attribute': ATTR_DOB,        'value': str(child.date_of_birth)},
            {'attribute': ATTR_SEX,        'value': child.sex},
            {'attribute': ATTR_CAMP,       'value': child.camp.name if child.camp_id else ''},
        ],
    }


def push_child_registration(child):
    """
    Push a newly registered child to DHIS2 as a TrackedEntityInstance.
    Returns {'status': 'ok'|'skipped'|'error', 'dhis2_uid': str|None, 'detail': str}.
    """
    creds = _creds()
    if not creds:
        logger.info('DHIS2 not configured — skipping child push for %s', child.registration_number)
        return {'status': 'skipped', 'dhis2_uid': None, 'detail': 'DHIS2 not configured'}

    base_url, username, password = creds
    s = _session(base_url, username, password)
    payload = {'trackedEntities': [_child_to_tei(child)]}

    try:
        resp = s.post(
            f'{base_url}/api/tracker',
            json=payload,
            params={'async': 'false'},
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        body = resp.json()
        te_report = (
            body.get('bundleReport', {})
                .get('typeReportMap', {})
                .get('TRACKED_ENTITY', {})
        )
        created = te_report.get('stats', {}).get('created', 0)
        uid = None
        obj_reports = te_report.get('objectReports', [])
        if obj_reports:
            uid = obj_reports[0].get('uid')
        logger.info(
            'DHIS2 child push: %s created=%s uid=%s',
            child.registration_number, created, uid,
        )
        return {'status': 'ok', 'dhis2_uid': uid, 'detail': f'created={created}'}
    except requests.RequestException as exc:
        logger.error('DHIS2 child push failed for %s: %s', child.registration_number, exc)
        return {'status': 'error', 'dhis2_uid': None, 'detail': str(exc)}


def push_vaccination_record(vax_record):
    """
    Push a VaccinationRecord to DHIS2 as a tracker Event.
    Returns {'status': 'ok'|'skipped'|'error', 'event_uid': str|None, 'detail': str}.
    """
    creds = _creds()
    if not creds:
        return {'status': 'skipped', 'event_uid': None, 'detail': 'DHIS2 not configured'}

    base_url, username, password = creds
    s = _session(base_url, username, password)

    vaccine = vax_record.vaccine
    event_date = (
        str(vax_record.administered_at.date())
        if vax_record.administered_at
        else str(date.today())
    )

    payload = {
        'events': [{
            'program':    PROGRAM_UID,
            'orgUnit':    ORG_UNIT_UID,
            'status':     'COMPLETED',
            'occurredAt': event_date,
            'dataValues': [
                {'dataElement': DATA_ELEM_VACCINE, 'value': vaccine.name},
                {'dataElement': DATA_ELEM_STATUS,  'value': vax_record.status},
                {'dataElement': DATA_ELEM_BATCH,   'value': vax_record.batch_number or ''},
            ],
        }],
    }

    try:
        resp = s.post(
            f'{base_url}/api/tracker',
            json=payload,
            params={'async': 'false'},
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        body = resp.json()
        events = (
            body.get('bundleReport', {})
                .get('typeReportMap', {})
                .get('EVENT', {})
                .get('objectReports', [])
        )
        uid = events[0].get('uid') if events else None
        logger.info(
            'DHIS2 vaccination push: child=%s vaccine=%s uid=%s',
            vax_record.child.registration_number, vaccine.name, uid,
        )
        return {'status': 'ok', 'event_uid': uid, 'detail': 'pushed'}
    except requests.RequestException as exc:
        logger.error('DHIS2 vaccination push failed: %s', exc)
        return {'status': 'error', 'event_uid': None, 'detail': str(exc)}


# ── pull helpers ──────────────────────────────────────────────────────────────

def pull_from_dhis2(since=None):
    """
    Pull TrackedEntityInstances updated since `since` (datetime) from DHIS2.
    Returns a list of raw TEI dicts from the DHIS2 response.
    """
    creds = _creds()
    if not creds:
        logger.info('DHIS2 not configured — pull skipped')
        return []

    base_url, username, password = creds
    s = _session(base_url, username, password)

    params = {
        'program': PROGRAM_UID,
        'orgUnit': ORG_UNIT_UID,
        'ouMode': 'DESCENDANTS',
        'fields': 'trackedEntity,attributes,enrollments[events[*]]',
        'pageSize': 500,
    }
    if since:
        params['lastUpdatedStartDate'] = since.strftime('%Y-%m-%d')

    try:
        resp = s.get(
            f'{base_url}/api/tracker/trackedEntities',
            params=params,
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        teis = resp.json().get('instances', [])
        logger.info(
            'DHIS2 pull: %d tracked entities returned (since=%s)',
            len(teis), since,
        )
        return teis
    except requests.RequestException as exc:
        logger.error('DHIS2 pull failed: %s', exc)
        return []


def _upsert_vaccination_from_tei(tei):
    """
    Given a raw DHIS2 TEI dict, upsert local VaccinationRecord rows.
    Returns the count of records created.
    """
    from apps.children.models import Child
    from apps.vaccinations.models import Vaccine, VaccinationRecord

    attrs = {a['attribute']: a.get('value', '') for a in tei.get('attributes', [])}
    reg_number = attrs.get(ATTR_REG_NUMBER)
    if not reg_number:
        return 0

    try:
        child = Child.objects.get(registration_number=reg_number)
    except Child.DoesNotExist:
        logger.debug('DHIS2 pull: unknown reg_number %s — skipping', reg_number)
        return 0

    count = 0
    for enrollment in tei.get('enrollments', []):
        for event in enrollment.get('events', []):
            de_map = {dv['dataElement']: dv.get('value', '') for dv in event.get('dataValues', [])}
            vaccine_name = de_map.get(DATA_ELEM_VACCINE)
            status       = de_map.get(DATA_ELEM_STATUS, 'ADMINISTERED')
            batch        = de_map.get(DATA_ELEM_BATCH, '')
            occurred_at  = event.get('occurredAt')

            if not vaccine_name:
                continue

            vaccine, _ = Vaccine.objects.get_or_create(
                name=vaccine_name,
                defaults={'dose_number': 1, 'recommended_age_weeks': 0},
            )
            administered_at = None
            if occurred_at:
                try:
                    dt = datetime.strptime(occurred_at[:10], '%Y-%m-%d')
                    administered_at = timezone.make_aware(dt)
                except ValueError:
                    pass

            _, created = VaccinationRecord.objects.update_or_create(
                child=child,
                vaccine=vaccine,
                defaults={
                    'status': status,
                    'batch_number': batch,
                    'administered_at': administered_at,
                    'source': 'DHIS2',
                },
            )
            if created:
                count += 1

    return count


# ── batch sync ────────────────────────────────────────────────────────────────

def batch_sync(since=None):
    """
    Full bidirectional batch sync.
      1. Pull TEIs from DHIS2 → upsert local vaccination records.
      2. Push all local children without a dhis2_uid (up to 200 per run).
      3. Push administered vaccinations without a dhis2_event_uid (up to 500).

    `since` is an optional datetime; pass None for a full sync.
    Returns a summary dict: {pulled, upserted, pushed_children, pushed_vaccinations, errors, synced_at}.
    """
    summary = {
        'pulled': 0,
        'upserted': 0,
        'pushed_children': 0,
        'pushed_vaccinations': 0,
        'errors': [],
        'synced_at': timezone.now().isoformat(),
    }

    if not is_configured():
        summary['errors'].append('DHIS2 not configured — sync skipped')
        logger.warning('batch_sync: DHIS2 credentials not set, skipping')
        return summary

    # 1. Pull ─────────────────────────────────────────────────────────────────
    teis = pull_from_dhis2(since=since)
    summary['pulled'] = len(teis)
    for tei in teis:
        try:
            summary['upserted'] += _upsert_vaccination_from_tei(tei)
        except Exception as exc:
            logger.error('DHIS2 upsert error: %s', exc)
            summary['errors'].append(f'upsert: {exc}')

    # 2. Push unsynced children ────────────────────────────────────────────────
    from apps.children.models import Child

    unsynced = Child.objects.filter(
        is_active=True,
        deletion_requested_at__isnull=True,
        dhis2_uid__isnull=True,
    ).select_related('camp')[:200]

    for child in unsynced:
        result = push_child_registration(child)
        if result['status'] == 'ok':
            if result.get('dhis2_uid'):
                Child.objects.filter(pk=child.pk).update(dhis2_uid=result['dhis2_uid'])
            summary['pushed_children'] += 1
        elif result['status'] == 'error':
            summary['errors'].append(f'child {child.registration_number}: {result["detail"]}')

    # 3. Push unsynced vaccination records ────────────────────────────────────
    from apps.vaccinations.models import VaccinationRecord

    vax_qs = VaccinationRecord.objects.filter(
        status='ADMINISTERED',
        dhis2_event_uid__isnull=True,
    ).select_related('child', 'vaccine')
    if since:
        vax_qs = vax_qs.filter(administered_at__gte=since)

    for vr in vax_qs[:500]:
        result = push_vaccination_record(vr)
        if result['status'] == 'ok':
            if result.get('event_uid'):
                VaccinationRecord.objects.filter(pk=vr.pk).update(dhis2_event_uid=result['event_uid'])
            summary['pushed_vaccinations'] += 1
        elif result['status'] == 'error':
            summary['errors'].append(f'vax {vr.id}: {result["detail"]}')

    logger.info('DHIS2 batch_sync complete: %s', summary)
    return summary
