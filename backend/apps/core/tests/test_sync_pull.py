import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import UserRole
from apps.accounts.tests.factories import UserFactory
from apps.camps.tests.factories import CampFactory
from apps.children.tests.factories import ChildFactory
from apps.health_records.tests.factories import HealthRecordFactory

URL = '/api/v1/sync/pull/'


@pytest.fixture
def camp(db):
    return CampFactory()


@pytest.fixture
def chw(db, camp):
    return UserFactory(role=UserRole.CHW, camp=camp, is_approved=True)


@pytest.fixture
def my_child(db, camp, chw):
    child = ChildFactory(camp=camp)
    child.guardian.assigned_chw = chw
    child.guardian.save(update_fields=['assigned_chw'])
    return child


def _pull(user, since=None):
    c = APIClient()
    c.force_authenticate(user=user)
    return c.get(URL, {'since': since} if since else {})


@pytest.mark.django_db
class TestPullSync:
    def test_first_sync_returns_only_callers_scope(self, chw, my_child, camp):
        other = ChildFactory(camp=camp)  # same camp, but not assigned to this CHW
        HealthRecordFactory(child=my_child)
        HealthRecordFactory(child=other)
        data = _pull(chw).data['data']
        ids = {c['id'] for c in data['children']['items']}
        assert ids == {str(my_child.id)}
        assert len(data['health_records']['items']) == 1
        assert 'server_time' in data

    def test_incremental_sync_returns_only_changes(self, chw, my_child):
        first = _pull(chw).data['data']
        assert _pull(chw, first['server_time']).data['data']['children']['items'] == []
        my_child.full_name = 'Renamed'
        my_child.save()
        changed = _pull(chw, first['server_time']).data['data']['children']['items']
        assert [c['full_name'] for c in changed] == ['Renamed']

    def test_soft_deleted_rows_come_back_as_deleted_ids(self, chw, my_child):
        stamp = _pull(chw).data['data']['server_time']
        my_child.soft_delete()
        children = _pull(chw, stamp).data['data']['children']
        assert children['items'] == []
        assert children['deleted'] == [str(my_child.id)]

    def test_parent_gets_own_children_and_no_clinic_sessions(self, db, my_child):
        parent = UserFactory(role=UserRole.PARENT, is_approved=True)
        my_child.guardian.user = parent
        my_child.guardian.save(update_fields=['user'])
        data = _pull(parent).data['data']
        assert [c['id'] for c in data['children']['items']] == [str(my_child.id)]
        assert 'clinic_sessions' not in data

    def test_nurse_without_camp_gets_nothing(self, db, my_child):
        nurse = UserFactory(role=UserRole.NURSE, camp=None, is_approved=True)
        assert _pull(nurse).data['data']['children']['items'] == []

    def test_rejects_bad_since(self, chw):
        assert _pull(chw, 'yesterday').status_code == 400

    def test_accepts_naive_timestamp(self, chw, my_child):
        naive = timezone.now().replace(tzinfo=None).isoformat()
        assert _pull(chw, naive).status_code == 200

    def test_requires_auth(self, db):
        assert APIClient().get(URL).status_code == 401


@pytest.mark.django_db
def test_app_config_is_public_and_versioned(settings):
    settings.MOBILE_MIN_VERSION = '1.2.0'
    resp = APIClient().get('/api/v1/app/config/')
    assert resp.status_code == 200
    assert resp.data['data']['min_version'] == '1.2.0'
    assert set(resp.data['data']['features']) == {'push_notifications', 'sms_reset_codes', 'offline_sync'}
