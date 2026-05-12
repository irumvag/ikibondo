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
from .models import SyncOperation


def _json_safe(data):
    """Round-trip through DjangoJSONEncoder to coerce UUIDs, Decimals, dates, etc."""
    return json.loads(json.dumps(data, cls=DjangoJSONEncoder))


def _process_create_visit(payload, user):
    from apps.health_records.serializers import HealthRecordSerializer
    serializer = HealthRecordSerializer(data=payload)
    serializer.is_valid(raise_exception=True)
    record = serializer.save(recorded_by=user)
    return HealthRecordSerializer(record).data


def _process_register_child(payload, user):
    from apps.children.serializers import ChildCreateSerializer
    serializer = ChildCreateSerializer(data=payload)
    serializer.is_valid(raise_exception=True)
    child = serializer.save(registered_by=user)
    from apps.children.serializers import ChildSerializer
    return ChildSerializer(child).data


def _process_administer_vaccine(payload, user):
    from apps.vaccinations.models import VaccinationRecord, DoseStatus
    from apps.vaccinations.serializers import VaccinationRecordSerializer
    record_id = payload.get('record_id')
    if not record_id:
        raise ValueError('record_id is required for administer_vaccine.')
    try:
        record = VaccinationRecord.objects.get(pk=record_id)
    except VaccinationRecord.DoesNotExist:
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


_HANDLERS = {
    SyncOperation.OP_CREATE_VISIT: _process_create_visit,
    SyncOperation.OP_REGISTER_CHILD: _process_register_child,
    SyncOperation.OP_ADMINISTER_VACCINE: _process_administer_vaccine,
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
    except Exception as exc:  # noqa: BLE001
        err_msg = str(exc)
        # Detect conflict (unique constraint, duplicate) vs generic error
        status = 'conflict' if 'unique' in err_msg.lower() or 'already' in err_msg.lower() else 'error'
        SyncOperation.objects.create(
            client_id=client_id, user=user, op=op_name,
            status=status, response_data={'error': err_msg},
        )
        return {'id': str(client_id), 'status': status, 'error': err_msg}


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

    results = [_process_one(op, request.user) for op in operations]
    return Response({'success': True, 'results': results})
