import pytest
from datetime import date, timedelta
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory, SupervisorFactory, AdminUserFactory
from apps.accounts.models import UserRole
from apps.camps.models import CHWZoneAssignment
from apps.camps.tests.factories import CampFactory
from apps.children.tests.factories import ChildFactory
from apps.health_records.tests.factories import HealthRecordFactory


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def camp(db):
    return CampFactory()


@pytest.fixture
def zone(db, camp):
    from apps.camps.models import CampZone
    return CampZone.objects.create(camp=camp, name='Zone A', code='ZA1')


@pytest.fixture
def supervisor(db, camp):
    return SupervisorFactory(camp=camp)


@pytest.fixture
def chw1(db, camp, zone):
    user = UserFactory(role=UserRole.CHW, camp=camp)
    CHWZoneAssignment.objects.create(chw_user=user, zone=zone, assigned_by=user)
    return user


@pytest.fixture
def chw2(db, camp, zone):
    user = UserFactory(role=UserRole.CHW, camp=camp)
    CHWZoneAssignment.objects.create(chw_user=user, zone=zone, assigned_by=user)
    return user


def _url(camp, zone):
    return f'/api/v1/camps/{camp.id}/zones/{zone.id}/chw-activity/'


class TestCHWActivityEndpoint:
    def test_requires_auth(self, client, camp, zone):
        res = client.get(_url(camp, zone))
        assert res.status_code == 401

    def test_chw_cannot_access(self, client, camp, zone, chw1):
        client.force_authenticate(chw1)
        res = client.get(_url(camp, zone))
        assert res.status_code == 403

    def test_supervisor_can_access(self, client, camp, zone, supervisor, chw1):
        client.force_authenticate(supervisor)
        res = client.get(_url(camp, zone))
        assert res.status_code == 200

    def test_admin_can_access(self, db, client, camp, zone, chw1):
        admin = AdminUserFactory()
        client.force_authenticate(admin)
        res = client.get(_url(camp, zone))
        assert res.status_code == 200

    def test_returns_list_of_chws(self, client, camp, zone, supervisor, chw1, chw2):
        client.force_authenticate(supervisor)
        res = client.get(_url(camp, zone))
        data = res.json()['data']
        assert len(data) == 2

    def test_response_shape(self, client, camp, zone, supervisor, chw1):
        client.force_authenticate(supervisor)
        res = client.get(_url(camp, zone))
        row = res.json()['data'][0]
        assert 'user_id' in row
        assert 'full_name' in row
        assert 'phone_number' in row
        assert 'last_visit_at' in row
        assert 'visits_7d' in row
        assert 'visits_30d' in row
        assert 'status' in row

    def test_visit_counts_are_accurate(self, client, camp, zone, supervisor, chw1):
        child = ChildFactory(camp=camp, zone=zone)
        today = date.today()
        # 2 visits in last 7 days
        HealthRecordFactory(child=child, recorded_by=chw1, zone=zone,
                            measurement_date=today - timedelta(days=2))
        HealthRecordFactory(child=child, recorded_by=chw1, zone=zone,
                            measurement_date=today - timedelta(days=5))
        # 1 visit between 7 and 30 days
        HealthRecordFactory(child=child, recorded_by=chw1, zone=zone,
                            measurement_date=today - timedelta(days=15))
        # 1 visit outside 30 days (should not count)
        HealthRecordFactory(child=child, recorded_by=chw1, zone=zone,
                            measurement_date=today - timedelta(days=40))

        client.force_authenticate(supervisor)
        res = client.get(_url(camp, zone))
        row = next(r for r in res.json()['data'] if r['user_id'] == str(chw1.id))
        assert row['visits_7d'] == 2
        assert row['visits_30d'] == 3

    def test_inactive_status_when_no_visits_7d(self, client, camp, zone, supervisor, chw1):
        child = ChildFactory(camp=camp, zone=zone)
        # only a visit older than 7 days
        HealthRecordFactory(child=child, recorded_by=chw1, zone=zone,
                            measurement_date=date.today() - timedelta(days=10))
        client.force_authenticate(supervisor)
        res = client.get(_url(camp, zone))
        row = next(r for r in res.json()['data'] if r['user_id'] == str(chw1.id))
        assert row['status'] == 'inactive'

    def test_active_status_when_visited_recently(self, client, camp, zone, supervisor, chw1):
        child = ChildFactory(camp=camp, zone=zone)
        HealthRecordFactory(child=child, recorded_by=chw1, zone=zone,
                            measurement_date=date.today() - timedelta(days=1))
        client.force_authenticate(supervisor)
        res = client.get(_url(camp, zone))
        row = next(r for r in res.json()['data'] if r['user_id'] == str(chw1.id))
        assert row['status'] == 'active'

    def test_last_visit_at_is_most_recent(self, client, camp, zone, supervisor, chw1):
        child = ChildFactory(camp=camp, zone=zone)
        today = date.today()
        HealthRecordFactory(child=child, recorded_by=chw1, zone=zone,
                            measurement_date=today - timedelta(days=5))
        HealthRecordFactory(child=child, recorded_by=chw1, zone=zone,
                            measurement_date=today - timedelta(days=1))
        client.force_authenticate(supervisor)
        res = client.get(_url(camp, zone))
        row = next(r for r in res.json()['data'] if r['user_id'] == str(chw1.id))
        expected = (today - timedelta(days=1)).isoformat()
        assert row['last_visit_at'] == expected

    def test_last_visit_at_is_none_when_no_visits(self, client, camp, zone, supervisor, chw1):
        client.force_authenticate(supervisor)
        res = client.get(_url(camp, zone))
        row = next(r for r in res.json()['data'] if r['user_id'] == str(chw1.id))
        assert row['last_visit_at'] is None

    def test_unassigned_chw_excluded(self, db, client, camp, zone, supervisor):
        # CHW not assigned to this zone should not appear
        unassigned = UserFactory(role=UserRole.CHW, camp=camp)
        client.force_authenticate(supervisor)
        res = client.get(_url(camp, zone))
        ids = [r['user_id'] for r in res.json()['data']]
        assert str(unassigned.id) not in ids

    def test_inactive_assignment_excluded(self, db, client, camp, zone, supervisor):
        user = UserFactory(role=UserRole.CHW, camp=camp)
        # Create inactive assignment bypassing clean() which only blocks duplicate actives
        CHWZoneAssignment.objects.create(
            chw_user=user, zone=zone, assigned_by=user, status='inactive'
        )
        client.force_authenticate(supervisor)
        res = client.get(_url(camp, zone))
        ids = [r['user_id'] for r in res.json()['data']]
        assert str(user.id) not in ids
