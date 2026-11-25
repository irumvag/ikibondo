"""
Offline batch sync endpoint for CHWs.

CHWs working in low-connectivity areas queue operations in IndexedDB and
submit them in a single batch when connectivity returns. Each operation
carries a client-generated UUID for idempotency: replaying the same UUID
returns the stored result without re-processing.
"""
import json
import uuid as uuid_mod
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import UserRole
from apps.core.scoping import can_access_child
from .models import SyncOperation

# Upper bound on operations per request so one call cannot monopolise a worker
MAX_BATCH_OPS = 200


class SyncPermissionError(Exception):
    """Raised by a handler when the user may not perform the operation."""

from drf_spectacular.utils import extend_schema
from drf_spectacular.openapi import OpenApiTypes


def _json_safe(data):
    """Round-trip through DjangoJSONEncoder to coerce UUIDs, Decimals, dates, etc."""
    return json.loads(json.dumps(data, cls=DjangoJSONEncoder))


def _process_create_visit(payload, user):
    from apps.health_records.serializers import HealthRecordSerializer
    from apps.health_records.views import run_risk_prediction
    if user.role not in (UserRole.CHW, UserRole.NURSE):
        raise SyncPermissionError('Only CHWs and nurses can record measurements.')
    serializer = HealthRecordSerializer(data=payload)
    serializer.is_valid(raise_exception=True)
    if not can_access_child(user, serializer.validated_data['child']):
        raise SyncPermissionError('Child not found.')
    record = serializer.save(recorded_by=user)
    run_risk_prediction(record)
    return HealthRecordSerializer(record).data


def _process_register_child(payload, user):
    from apps.children.serializers import ChildCreateSerializer
    # Mirror ChildViewSet.create: CHWs and parents may not register children
    if user.role not in (UserRole.NURSE, UserRole.SUPERVISOR, UserRole.ADMIN):
        raise SyncPermissionError('Only nurses and supervisors can register children.')
    serializer = ChildCreateSerializer(data=payload)
    serializer.is_valid(raise_exception=True)
    child = serializer.save(registered_by=user)
    from apps.vaccinations.schedule import generate_schedule_for_child
    generate_schedule_for_child(child)
    from apps.children.serializers import ChildSerializer
    return ChildSerializer(child).data


def _process_administer_vaccine(payload, user):
    from apps.vaccinations.models import VaccinationRecord, DoseStatus
    from apps.vaccinations.serializers import VaccinationRecordSerializer
    if user.role not in (UserRole.NURSE, UserRole.SUPERVISOR, UserRole.ADMIN):
        raise SyncPermissionError('Only nurses and above may administer vaccines.')
    record_id = payload.get('record_id')
    if not record_id:
        raise ValueError('record_id is required for administer_vaccine.')
    try:
        record = VaccinationRecord.objects.select_related('child').get(pk=record_id, is_active=True)
    except VaccinationRecord.DoesNotExist:
        raise ValueError(f'VaccinationRecord {record_id} not found.')
    if not can_access_child(user, record.child):
        raise ValueError(f'VaccinationRecord {record_id} not found.')
    if record.status == DoseStatus.DONE:
        raise ValueError('This dose has already been administered.')
    from django.utils import timezone
    record.status = DoseStatus.DONE
    record.administered_by = user
    record.administered_date = payload.get('administered_date') or timezone.now().date()
    if payload.get('batch_number'):
        record.batch_number = payload['batch_number']
    if payload.get('notes'):
        record.notes = payload['notes']
    record.save()
    return VaccinationRecordSerializer(record).data


def _process_record_attendance(payload, user):
    """Offline clinic-session mode: one child's attendance (and dose) at a session."""
    from apps.core.scoping import scope_camp
    from apps.vaccinations.models import ClinicSession, ClinicSessionStatus
    from apps.vaccinations.views import record_session_attendance
    if user.role not in (UserRole.NURSE, UserRole.SUPERVISOR, UserRole.ADMIN):
        raise SyncPermissionError('Only nurses and above may record attendance.')
    session = scope_camp(ClinicSession.objects.all(), user).filter(pk=payload.get('session')).first()
    if session is None:
        raise ValueError('Clinic session not found.')
    if session.status == ClinicSessionStatus.CLOSED:
        raise ValueError('This session was closed before the record arrived.')
    status = payload.get('status', 'DONE')
    if status not in ('DONE', 'MISSED', 'SKIPPED'):
        raise ValueError('status must be DONE, MISSED or SKIPPED.')
    if not record_session_attendance(session, payload.get('child'), status, payload.get('batch_number', ''), user):
        raise ValueError('Child is not registered in this session\'s camp.')
    return {'session': str(session.id), 'child': str(payload.get('child')), 'status': status}


_HANDLERS = {
    SyncOperation.OP_CREATE_VISIT: _process_create_visit,
    SyncOperation.OP_REGISTER_CHILD: _process_register_child,
    SyncOperation.OP_ADMINISTER_VACCINE: _process_administer_vaccine,
    SyncOperation.OP_RECORD_ATTENDANCE: _process_record_attendance,
}


def _process_one(op_item, user):
    """Process a single operation dict; returns a result dict."""
    client_id_raw = op_item.get('id')
    op_name = op_item.get('op', '')
    payload = op_item.get('payload', {})

    # Validate client_id
    try:
        client_id = uuid_mod.UUID(str(client_id_raw))
    except (TypeError, ValueError):
        return {
            'id': str(client_id_raw),
            'status': 'error',
            'error': 'id must be a valid UUID.',
        }

    # Idempotency: return stored result if already processed
    existing = SyncOperation.objects.filter(client_id=client_id).first()
    if existing and existing.user_id != user.id:
        # Never echo another user's stored result
        return {'id': str(client_id), 'status': 'error', 'error': 'Operation id already used.'}
    if existing:
        result = {'id': str(client_id), 'status': existing.status}
        if existing.response_data:
            result['data'] = existing.response_data
        return result

    # Unknown operation
    handler = _HANDLERS.get(op_name)
    if handler is None:
        SyncOperation.objects.create(
            client_id=client_id, user=user, op=op_name,
            status='error', response_data={'error': f'Unknown op: {op_name}'},
        )
        return {'id': str(client_id), 'status': 'error', 'error': f'Unknown op: {op_name}'}

    # Process in its own savepoint so one failure doesn't roll back others
    try:
        with transaction.atomic():
            data = handler(payload, user)
        safe_data = _json_safe(data)
        SyncOperation.objects.create(
            client_id=client_id, user=user, op=op_name,
            status='ok', response_data=safe_data,
        )
        return {'id': str(client_id), 'status': 'ok', 'data': safe_data}
    except SyncPermissionError as exc:
        SyncOperation.objects.create(
            client_id=client_id, user=user, op=op_name,
            status='forbidden', response_data={'error': str(exc)},
        )
        return {'id': str(client_id), 'status': 'forbidden', 'error': str(exc)}
    except Exception as exc:  # noqa: BLE001
        err_msg = str(exc)
        # Detect conflict (unique constraint, duplicate) vs generic error
        status = 'conflict' if 'unique' in err_msg.lower() or 'already' in err_msg.lower() else 'error'
        SyncOperation.objects.create(
            client_id=client_id, user=user, op=op_name,
            status=status, response_data={'error': err_msg},
        )
        return {'id': str(client_id), 'status': status, 'error': err_msg}


@extend_schema(exclude=True)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def batch_sync_view(request):
    """
    POST /api/v1/sync/batch/

    Body: { operations: [{ id, op, payload }] }
    Response: { results: [{ id, status, data?, error? }] }

    Each operation runs in its own transaction. A failed op does not
    block subsequent ones. Same client UUID on retry returns stored result.
    """
    if request.user.role not in (
        UserRole.CHW, UserRole.NURSE, UserRole.SUPERVISOR, UserRole.ADMIN
    ):
        return Response(
            {'success': False, 'error': 'Only CHW and above may use batch sync.'},
            status=403,
        )

    operations = request.data.get('operations')
    if not isinstance(operations, list):
        return Response(
            {'success': False, 'error': '"operations" must be a list.'},
            status=400,
        )
    if len(operations) > MAX_BATCH_OPS:
        return Response(
            {'success': False, 'error': f'At most {MAX_BATCH_OPS} operations per batch.'},
            status=400,
        )

    results = [_process_one(op, request.user) for op in operations]
    return Response({'success': True, 'results': results})


# ── Pull: download what changed since the last sync ───────────────────────────

PULL_LIMIT = 2000


def _delta(qs, since, serializer_cls):
    """Rows changed after `since`, split into live rows and soft-deleted ids."""
    if since is not None:
        qs = qs.filter(updated_at__gt=since)
    qs = qs.order_by('updated_at')
    rows = list(qs[:PULL_LIMIT + 1])
    truncated = len(rows) > PULL_LIMIT
    rows = rows[:PULL_LIMIT]
    live = [r for r in rows if r.is_active]
    return {
        'items': _json_safe(serializer_cls(live, many=True).data),
        'deleted': [str(r.id) for r in rows if not r.is_active],
        'truncated': truncated,
    }


@extend_schema(exclude=True)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pull_sync_view(request):
    """
    GET /api/v1/sync/pull/?since=<ISO-8601 timestamp>

    Returns everything in the caller's scope that changed after `since` (or everything,
    on first sync). Store `server_time` and send it as `since` next time. Soft-deleted
    rows come back as ids under `deleted`. When a type is `truncated`, call again with
    the same `since` after applying the batch to get the rest.
    """
    from django.utils import timezone
    from datetime import timezone as dt_timezone
    from django.utils.dateparse import parse_datetime
    from apps.core.scoping import scope_children, scope_camp
    from apps.children.models import Child, Guardian
    from apps.children.serializers import ChildSerializer, GuardianSerializer
    from apps.health_records.models import HealthRecord
    from apps.health_records.serializers import HealthRecordSerializer
    from apps.vaccinations.models import VaccinationRecord, ClinicSession
    from apps.vaccinations.serializers import VaccinationRecordSerializer, ClinicSessionSerializer

    since = None
    raw = request.query_params.get('since')
    if raw:
        since = parse_datetime(raw)
        if since is None:
            return Response({'success': False, 'error': 'since must be an ISO-8601 timestamp.'}, status=400)
        if timezone.is_naive(since):
            since = timezone.make_aware(since, dt_timezone.utc)

    # Taken before querying so nothing changed mid-request is skipped next time
    server_time = timezone.now()
    user = request.user

    # Include inactive rows so deletions reach the device; scoping is identical to the REST API
    children = scope_children(Child.objects.all(), user).select_related('camp', 'zone', 'guardian', 'registered_by')
    child_ids = scope_children(Child.objects.all(), user).values('id')
    guardians = Guardian.objects.filter(children__id__in=child_ids).distinct().select_related('user', 'assigned_chw')
    records = scope_children(HealthRecord.objects.all(), user, prefix='child__').select_related('child', 'recorded_by', 'zone')
    vaccinations = scope_children(VaccinationRecord.objects.all(), user, prefix='child__').select_related(
        'child', 'child__zone', 'child__guardian', 'vaccine', 'administered_by')

    data = {
        'server_time': server_time.isoformat(),
        'children': _delta(children, since, ChildSerializer),
        'guardians': _delta(guardians, since, GuardianSerializer),
        'health_records': _delta(records, since, HealthRecordSerializer),
        'vaccinations': _delta(vaccinations, since, VaccinationRecordSerializer),
    }
    # Parents don't run clinic sessions
    if user.role != UserRole.PARENT:
        sessions = scope_camp(ClinicSession.objects.all(), user).select_related('camp', 'vaccine', 'opened_by')
        data['clinic_sessions'] = _delta(sessions, since, ClinicSessionSerializer)
    return Response({'success': True, 'data': data})
