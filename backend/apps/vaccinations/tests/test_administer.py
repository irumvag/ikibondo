import pytest
from datetime import date
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory, NurseFactory, SupervisorFactory, AdminUserFactory
from apps.accounts.models import UserRole
from apps.camps.models import CHWZoneAssignment
from apps.camps.tests.factories import CampFactory
from apps.children.tests.factories import ChildFactory
from apps.vaccinations.models import DoseStatus
from apps.vaccinations.tests.factories import VaccineFactory, VaccinationRecordFactory


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def camp(db):
    return CampFactory()


@pytest.fixture
def zone(db, camp):
    from apps.camps.models import CampZone
    return CampZone.objects.create(camp=camp, name='Zone B', code='ZB1')


@pytest.fixture
def child(db, camp, zone):
    return ChildFactory(camp=camp, zone=zone)


@pytest.fixture
def vaccine(db):
    return VaccineFactory()


@pytest.fixture
def record(db, child, vaccine):
    return VaccinationRecordFactory(child=child, vaccine=vaccine, status=DoseStatus.SCHEDULED)


@pytest.fixture
def nurse(db, camp):
    return NurseFactory(camp=camp)


@pytest.fixture
def chw(db, camp, zone):
    user = UserFactory(role=UserRole.CHW, camp=camp)
    CHWZoneAssignment.objects.create(chw_user=user, zone=zone, assigned_by=user)
    return user


def _url(record):
    return f'/api/v1/vaccinations/{record.id}/administer/'


class TestAdministerVaccination:
    def test_requires_auth(self, client, record):
        res = client.post(_url(record), {})
        assert res.status_code == 401

    def test_parent_cannot_administer(self, db, client, record):
        parent = UserFactory(role=UserRole.PARENT)
        client.force_authenticate(parent)
        res = client.post(_url(record), {'administered_date': str(date.today())})
        assert res.status_code == 403

    def test_nurse_can_administer(self, client, record, nurse):
        client.force_authenticate(nurse)
        res = client.post(_url(record), {'administered_date': str(date.today())})
        assert res.status_code == 200
        record.refresh_from_db()
        assert record.status == DoseStatus.DONE
        assert record.administered_by == nurse

    def test_supervisor_can_administer(self, db, client, record, camp):
        sup = SupervisorFactory(camp=camp)
        client.force_authenticate(sup)
        res = client.post(_url(record), {'administered_date': str(date.today())})
        assert res.status_code == 200

    def test_admin_can_administer(self, db, client, record):
        admin = AdminUserFactory()
        client.force_authenticate(admin)
        res = client.post(_url(record), {'administered_date': str(date.today())})
        assert res.status_code == 200

    def test_chw_in_same_zone_can_administer(self, client, record, chw):
        client.force_authenticate(chw)
        res = client.post(_url(record), {'administered_date': str(date.today())})
        assert res.status_code == 200

    def test_chw_wrong_zone_cannot_administer(self, db, client, record, camp):
        from apps.camps.models import CampZone
        other_zone = CampZone.objects.create(camp=camp, name='Zone C', code='ZC1')
        other_chw = UserFactory(role=UserRole.CHW, camp=camp)
        CHWZoneAssignment.objects.create(chw_user=other_chw, zone=other_zone, assigned_by=other_chw)
        client.force_authenticate(other_chw)
        res = client.post(_url(record), {'administered_date': str(date.today())})
        assert res.status_code == 403

    def test_administered_by_is_set_to_request_user(self, client, record, nurse):
        client.force_authenticate(nurse)
        client.post(_url(record), {'administered_date': str(date.today())})
        record.refresh_from_db()
        assert record.administered_by == nurse

    def test_administered_date_is_stored(self, client, record, nurse):
        target_date = date(2026, 4, 15)
        client.force_authenticate(nurse)
        client.post(_url(record), {'administered_date': str(target_date)})
        record.refresh_from_db()
        assert record.administered_date == target_date

    def test_batch_number_and_notes_stored(self, client, record, nurse):
        client.force_authenticate(nurse)
        client.post(_url(record), {
            'administered_date': str(date.today()),
            'batch_number': 'BATCH-001',
            'notes': 'No adverse reaction',
        })
        record.refresh_from_db()
        assert record.batch_number == 'BATCH-001'
        assert record.notes == 'No adverse reaction'

    def test_cannot_administer_already_done(self, client, record, nurse):
        client.force_authenticate(nurse)
        client.post(_url(record), {'administered_date': str(date.today())})
        # second attempt
        res = client.post(_url(record), {'administered_date': str(date.today())})
        assert res.status_code == 400

    def test_response_contains_record_data(self, client, record, nurse):
        client.force_authenticate(nurse)
        res = client.post(_url(record), {'administered_date': str(date.today())})
        data = res.json()
        assert data['data']['status'] == DoseStatus.DONE

    def test_administered_date_defaults_to_today_when_omitted(self, client, record, nurse):
        client.force_authenticate(nurse)
        res = client.post(_url(record), {})
        assert res.status_code == 200
        record.refresh_from_db()
        assert record.administered_date == date.today()
