import uuid
import pytest
from datetime import date
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory, AdminUserFactory
from apps.accounts.models import UserRole
from apps.camps.tests.factories import CampFactory
from apps.children.tests.factories import ChildFactory, GuardianFactory
from apps.health_records.tests.factories import HealthRecordFactory
from apps.vaccinations.models import DoseStatus
from apps.vaccinations.tests.factories import VaccineFactory, VaccinationRecordFactory
from apps.core.models import SyncOperation

BATCH_URL = '/api/v1/sync/batch/'


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def camp(db):
    return CampFactory()


@pytest.fixture
def chw(db, camp):
    return UserFactory(role=UserRole.CHW, camp=camp)


@pytest.fixture
def child(db, camp, chw):
    child = ChildFactory(camp=camp)
    child.guardian.assigned_chw = chw
    child.guardian.save(update_fields=['assigned_chw'])
    return child


@pytest.fixture
def nurse(db, camp):
    return UserFactory(role=UserRole.NURSE, camp=camp)


def _op(op_name, payload, client_id=None):
    return {'id': str(client_id or uuid.uuid4()), 'op': op_name, 'payload': payload}


class TestBatchSyncAuth:
    def test_requires_auth(self, client, db):
        res = client.post(BATCH_URL, {'operations': []}, format='json')
        assert res.status_code == 401

    def test_parent_blocked(self, db, client):
        parent = UserFactory(role=UserRole.PARENT)
        client.force_authenticate(parent)
        res = client.post(BATCH_URL, {'operations': []}, format='json')
        assert res.status_code == 403

    def test_chw_allowed(self, client, chw):
        client.force_authenticate(chw)
        res = client.post(BATCH_URL, {'operations': []}, format='json')
        assert res.status_code == 200

    def test_operations_must_be_list(self, client, chw):
        client.force_authenticate(chw)
        res = client.post(BATCH_URL, {'operations': 'not-a-list'}, format='json')
        assert res.status_code == 400


class TestCreateVisitOp:
    def test_creates_health_record(self, client, chw, child):
        client.force_authenticate(chw)
        payload = {
            'child': str(child.id),
            'measurement_date': str(date.today()),
            'weight_kg': '8.5',
            'height_cm': '72.0',
        }
        res = client.post(BATCH_URL, {'operations': [_op('create_visit', payload)]}, format='json')
        assert res.status_code == 200
        result = res.json()['results'][0]
        assert result['status'] == 'ok'
        assert 'data' in result

    def test_invalid_payload_returns_error(self, client, chw, child):
        client.force_authenticate(chw)
        payload = {'child': str(child.id)}  # missing required fields
        res = client.post(BATCH_URL, {'operations': [_op('create_visit', payload)]}, format='json')
        result = res.json()['results'][0]
        assert result['status'] == 'error'


class TestRegisterChildOp:
    def test_registers_child(self, client, nurse, camp):
        client.force_authenticate(nurse)
        payload = {
            'full_name': 'Test Child',
            'date_of_birth': '2024-01-01',
            'sex': 'F',
            'camp': str(camp.id),
            'guardian': {
                'full_name': 'Test Mother',
                'phone_number': '+250789000001',
                'relationship': 'mother',
            },
        }
        res = client.post(BATCH_URL, {'operations': [_op('register_child', payload)]}, format='json')
        result = res.json()['results'][0]
        assert result['status'] == 'ok'
        assert result['data']['full_name'] == 'Test Child'

    def test_invalid_child_payload_returns_error(self, client, nurse):
        client.force_authenticate(nurse)
        res = client.post(BATCH_URL, {'operations': [_op('register_child', {})]}, format='json')
        result = res.json()['results'][0]
        assert result['status'] == 'error'

    def test_chw_cannot_register_child(self, client, chw, camp):
        # Mirrors the REST rule: CHWs may not register children, even via offline sync
        client.force_authenticate(chw)
        payload = {'full_name': 'X', 'date_of_birth': '2024-01-01', 'sex': 'F', 'camp': str(camp.id)}
        res = client.post(BATCH_URL, {'operations': [_op('register_child', payload)]}, format='json')
        assert res.json()['results'][0]['status'] == 'forbidden'


class TestAdministerVaccineOp:
    def test_administers_vaccine(self, db, client, nurse, child):
        vaccine = VaccineFactory()
        record = VaccinationRecordFactory(child=child, vaccine=vaccine, status=DoseStatus.SCHEDULED)
        client.force_authenticate(nurse)
        payload = {'record_id': str(record.id), 'administered_date': str(date.today())}
        res = client.post(BATCH_URL, {'operations': [_op('administer_vaccine', payload)]}, format='json')
        result = res.json()['results'][0]
        assert result['status'] == 'ok'
        record.refresh_from_db()
        assert record.status == DoseStatus.DONE

    def test_chw_cannot_administer_vaccine(self, db, client, chw, child):
        record = VaccinationRecordFactory(child=child, vaccine=VaccineFactory(), status=DoseStatus.SCHEDULED)
        client.force_authenticate(chw)
        payload = {'record_id': str(record.id)}
        res = client.post(BATCH_URL, {'operations': [_op('administer_vaccine', payload)]}, format='json')
        assert res.json()['results'][0]['status'] == 'forbidden'
        record.refresh_from_db()
        assert record.status == DoseStatus.SCHEDULED

    def test_nurse_other_camp_cannot_administer(self, db, client, child):
        outsider = UserFactory(role=UserRole.NURSE, camp=CampFactory(name='Elsewhere'))
        record = VaccinationRecordFactory(child=child, vaccine=VaccineFactory(), status=DoseStatus.SCHEDULED)
        client.force_authenticate(outsider)
        res = client.post(BATCH_URL, {'operations': [_op('administer_vaccine', {'record_id': str(record.id)})]},
                          format='json')
        assert res.json()['results'][0]['status'] == 'error'
        record.refresh_from_db()
        assert record.status == DoseStatus.SCHEDULED

    def test_already_done_returns_conflict(self, db, client, nurse, child):
        vaccine = VaccineFactory()
        record = VaccinationRecordFactory(child=child, vaccine=vaccine, status=DoseStatus.DONE)
        client.force_authenticate(nurse)
        payload = {'record_id': str(record.id), 'administered_date': str(date.today())}
        res = client.post(BATCH_URL, {'operations': [_op('administer_vaccine', payload)]}, format='json')
        result = res.json()['results'][0]
        assert result['status'] == 'conflict'


class TestIdempotency:
    def test_same_client_id_returns_stored_result(self, client, chw, child):
        client.force_authenticate(chw)
        client_id = uuid.uuid4()
        payload = {
            'child': str(child.id),
            'measurement_date': str(date.today()),
            'weight_kg': '8.5',
            'height_cm': '72.0',
        }
        op = _op('create_visit', payload, client_id=client_id)

        res1 = client.post(BATCH_URL, {'operations': [op]}, format='json')
        assert res1.json()['results'][0]['status'] == 'ok'

        # Submit same op again — should return stored result, not create duplicate
        res2 = client.post(BATCH_URL, {'operations': [op]}, format='json')
        assert res2.json()['results'][0]['status'] == 'ok'

        from apps.health_records.models import HealthRecord
        count = HealthRecord.objects.filter(child=child).count()
        assert count == 1  # only one record created despite two submissions

    def test_other_user_cannot_replay_client_id(self, client, chw, child, camp):
        client.force_authenticate(chw)
        client_id = uuid.uuid4()
        payload = {'child': str(child.id), 'measurement_date': str(date.today()),
                   'weight_kg': '8.5', 'height_cm': '72.0'}
        client.post(BATCH_URL, {'operations': [_op('create_visit', payload, client_id=client_id)]}, format='json')
        other = UserFactory(role=UserRole.CHW, camp=camp)
        client.force_authenticate(other)
        res = client.post(BATCH_URL, {'operations': [_op('create_visit', {}, client_id=client_id)]}, format='json')
        result = res.json()['results'][0]
        assert result['status'] == 'error'
        assert 'data' not in result

    def test_batch_size_capped(self, client, chw):
        client.force_authenticate(chw)
        ops = [_op('unknown_op', {}) for _ in range(201)]
        res = client.post(BATCH_URL, {'operations': ops}, format='json')
        assert res.status_code == 400

    def test_sync_operation_row_created(self, client, chw, child):
        client.force_authenticate(chw)
        client_id = uuid.uuid4()
        payload = {
            'child': str(child.id),
            'measurement_date': str(date.today()),
            'weight_kg': '8.5',
            'height_cm': '72.0',
        }
        client.post(BATCH_URL, {'operations': [_op('create_visit', payload, client_id=client_id)]}, format='json')
        assert SyncOperation.objects.filter(client_id=client_id).exists()


class TestMixedBatch:
    def test_failed_op_does_not_block_subsequent_ops(self, client, chw, child):
        client.force_authenticate(chw)
        bad_op = _op('create_visit', {})  # missing required fields — will fail
        good_op = _op('create_visit', {
            'child': str(child.id),
            'measurement_date': str(date.today()),
            'weight_kg': '9.0',
            'height_cm': '74.0',
        })
        res = client.post(BATCH_URL, {'operations': [bad_op, good_op]}, format='json')
        results = res.json()['results']
        assert results[0]['status'] == 'error'
        assert results[1]['status'] == 'ok'

    def test_unknown_op_returns_error(self, client, chw):
        client.force_authenticate(chw)
        res = client.post(BATCH_URL, {'operations': [_op('unknown_op', {})]}, format='json')
        result = res.json()['results'][0]
        assert result['status'] == 'error'
        assert 'Unknown op' in result['error']

    def test_invalid_uuid_returns_error(self, client, chw):
        client.force_authenticate(chw)
        op = {'id': 'not-a-uuid', 'op': 'create_visit', 'payload': {}}
        res = client.post(BATCH_URL, {'operations': [op]}, format='json')
        result = res.json()['results'][0]
        assert result['status'] == 'error'


class TestRecordAttendanceOp:
    """Offline clinic-session mode: nurses record attendance with no signal, synced later."""

    def _session(self, camp, nurse, vaccine, closed=False):
        from apps.vaccinations.models import ClinicSession, ClinicSessionStatus
        return ClinicSession.objects.create(
            camp=camp, vaccine=vaccine, session_date=date.today(), opened_by=nurse,
            status=ClinicSessionStatus.CLOSED if closed else ClinicSessionStatus.OPEN,
        )

    def test_marks_dose_done(self, db, client, nurse, child, camp):
        vaccine = VaccineFactory()
        record = VaccinationRecordFactory(child=child, vaccine=vaccine, status=DoseStatus.SCHEDULED)
        session = self._session(camp, nurse, vaccine)
        client.force_authenticate(nurse)
        payload = {'session': str(session.id), 'child': str(child.id), 'status': 'DONE', 'batch_number': 'B1'}
        result = client.post(BATCH_URL, {'operations': [_op('record_attendance', payload)]}, format='json').json()['results'][0]
        assert result['status'] == 'ok'
        record.refresh_from_db()
        assert record.status == DoseStatus.DONE and record.batch_number == 'B1'

    def test_other_camp_session_rejected(self, db, client, child, camp):
        outsider = UserFactory(role=UserRole.NURSE, camp=CampFactory(name='Far'))
        vaccine = VaccineFactory()
        session = self._session(camp, UserFactory(role=UserRole.NURSE, camp=camp), vaccine)
        client.force_authenticate(outsider)
        payload = {'session': str(session.id), 'child': str(child.id)}
        result = client.post(BATCH_URL, {'operations': [_op('record_attendance', payload)]}, format='json').json()['results'][0]
        assert result['status'] == 'error'

    def test_closed_session_rejected(self, db, client, nurse, child, camp):
        vaccine = VaccineFactory()
        session = self._session(camp, nurse, vaccine, closed=True)
        client.force_authenticate(nurse)
        payload = {'session': str(session.id), 'child': str(child.id)}
        result = client.post(BATCH_URL, {'operations': [_op('record_attendance', payload)]}, format='json').json()['results'][0]
        assert result['status'] == 'error'

    def test_chw_forbidden(self, db, client, chw, child, camp, nurse):
        vaccine = VaccineFactory()
        session = self._session(camp, nurse, vaccine)
        client.force_authenticate(chw)
        payload = {'session': str(session.id), 'child': str(child.id)}
        result = client.post(BATCH_URL, {'operations': [_op('record_attendance', payload)]}, format='json').json()['results'][0]
        assert result['status'] == 'forbidden'
