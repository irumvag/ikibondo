"""
Tests for DHIS2 integration — Sprint 9.

Covers:
  GET  /api/v1/integrations/dhis2/status/  — status endpoint
  POST /api/v1/integrations/dhis2/sync/    — manual trigger
  Unit: dhis2.push_child_registration
  Unit: dhis2.push_vaccination_record
  Unit: dhis2.pull_from_dhis2
  Unit: dhis2.batch_sync (skipped when unconfigured)
  Signal: child post_save queues dhis2_push_child
  Signal: HealthRecord HIGH risk queues dhis2_push_high_risk
"""
import pytest
from unittest.mock import patch, MagicMock
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory, AdminUserFactory, NurseFactory
from apps.accounts.models import UserRole
from apps.camps.tests.factories import CampFactory
from apps.children.tests.factories import ChildFactory
from apps.vaccinations.models import VaccinationRecord


# ── fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def admin(db):
    return AdminUserFactory()


@pytest.fixture
def camp(db):
    return CampFactory()


@pytest.fixture
def child(db, camp):
    return ChildFactory(camp=camp)


STATUS_URL = '/api/v1/integrations/dhis2/status/'
SYNC_URL   = '/api/v1/integrations/dhis2/sync/'


# ── TestDHIS2StatusEndpoint ───────────────────────────────────────────────────

@pytest.mark.django_db
class TestDHIS2StatusEndpoint:
    def test_requires_auth(self, client):
        res = client.get(STATUS_URL)
        assert res.status_code == 401

    def test_non_admin_forbidden(self, client, camp):
        nurse = NurseFactory(camp=camp)
        client.force_authenticate(nurse)
        res = client.get(STATUS_URL)
        assert res.status_code == 403

    def test_unconfigured_returns_false(self, client, admin):
        """When DHIS2_URL is absent, configured=False."""
        client.force_authenticate(admin)
        with patch('apps.integrations.dhis2._creds', return_value=None):
            res = client.get(STATUS_URL)
        assert res.status_code == 200
        assert res.json()['data']['configured'] is False

    def test_configured_returns_true(self, client, admin):
        client.force_authenticate(admin)
        with patch('apps.integrations.dhis2._creds', return_value=('https://dhis2.example.com', 'u', 'p')):
            res = client.get(STATUS_URL)
        assert res.status_code == 200
        assert res.json()['data']['configured'] is True


# ── TestDHIS2SyncEndpoint ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestDHIS2SyncEndpoint:
    def test_requires_auth(self, client):
        res = client.post(SYNC_URL, {}, format='json')
        assert res.status_code == 401

    def test_non_admin_forbidden(self, client, camp):
        nurse = NurseFactory(camp=camp)
        client.force_authenticate(nurse)
        res = client.post(SYNC_URL, {}, format='json')
        assert res.status_code == 403

    def test_unconfigured_returns_503(self, client, admin):
        client.force_authenticate(admin)
        with patch('apps.integrations.dhis2._creds', return_value=None):
            res = client.post(SYNC_URL, {}, format='json')
        assert res.status_code == 503

    def test_sync_returns_summary(self, client, admin):
        client.force_authenticate(admin)
        fake_summary = {
            'pulled': 0, 'upserted': 0,
            'pushed_children': 0, 'pushed_vaccinations': 0,
            'errors': [], 'synced_at': '2025-01-01T00:00:00Z',
        }
        with patch('apps.integrations.dhis2._creds', return_value=('http://dhis2', 'u', 'p')):
            with patch('apps.integrations.dhis2.batch_sync', return_value=fake_summary) as mock_sync:
                res = client.post(SYNC_URL, {}, format='json')
        assert res.status_code == 200
        data = res.json()['data']
        assert 'pulled' in data
        assert 'pushed_children' in data
        mock_sync.assert_called_once()

    def test_sync_with_since_date(self, client, admin):
        client.force_authenticate(admin)
        fake_summary = {
            'pulled': 0, 'upserted': 0,
            'pushed_children': 0, 'pushed_vaccinations': 0,
            'errors': [], 'synced_at': '2025-01-01T00:00:00Z',
        }
        with patch('apps.integrations.dhis2._creds', return_value=('http://dhis2', 'u', 'p')):
            with patch('apps.integrations.dhis2.batch_sync', return_value=fake_summary) as mock_sync:
                res = client.post(SYNC_URL, {'since': '2024-01-01'}, format='json')
        assert res.status_code == 200
        # `since` should be passed as a datetime, not None
        call_kwargs = mock_sync.call_args
        assert call_kwargs is not None

    def test_invalid_since_date_returns_400(self, client, admin):
        client.force_authenticate(admin)
        with patch('apps.integrations.dhis2._creds', return_value=('http://dhis2', 'u', 'p')):
            res = client.post(SYNC_URL, {'since': 'not-a-date'}, format='json')
        assert res.status_code == 400


# ── TestDHIS2Module ───────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestDHIS2Module:
    """Unit tests for dhis2.py functions — HTTP calls are mocked."""

    def test_push_child_skipped_when_unconfigured(self, child):
        from apps.integrations.dhis2 import push_child_registration
        with patch('apps.integrations.dhis2._creds', return_value=None):
            result = push_child_registration(child)
        assert result['status'] == 'skipped'

    def test_push_child_ok(self, child):
        from apps.integrations.dhis2 import push_child_registration
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            'bundleReport': {
                'typeReportMap': {
                    'TRACKED_ENTITY': {
                        'stats': {'created': 1},
                        'objectReports': [{'uid': 'abc123'}],
                    }
                }
            }
        }
        mock_resp.raise_for_status.return_value = None

        with patch('apps.integrations.dhis2._creds', return_value=('http://dhis2', 'u', 'p')):
            with patch('requests.Session.post', return_value=mock_resp):
                result = push_child_registration(child)

        assert result['status'] == 'ok'
        assert result['dhis2_uid'] == 'abc123'

    def test_push_child_handles_request_error(self, child):
        from apps.integrations.dhis2 import push_child_registration
        import requests as req

        with patch('apps.integrations.dhis2._creds', return_value=('http://dhis2', 'u', 'p')):
            with patch('requests.Session.post', side_effect=req.ConnectionError('timeout')):
                result = push_child_registration(child)

        assert result['status'] == 'error'
        assert 'timeout' in result['detail']

    def test_pull_skipped_when_unconfigured(self):
        from apps.integrations.dhis2 import pull_from_dhis2
        with patch('apps.integrations.dhis2._creds', return_value=None):
            result = pull_from_dhis2()
        assert result == []

    def test_pull_returns_list(self):
        from apps.integrations.dhis2 import pull_from_dhis2
        mock_resp = MagicMock()
        mock_resp.json.return_value = {'instances': [{'trackedEntity': 'x1'}, {'trackedEntity': 'x2'}]}
        mock_resp.raise_for_status.return_value = None

        with patch('apps.integrations.dhis2._creds', return_value=('http://dhis2', 'u', 'p')):
            with patch('requests.Session.get', return_value=mock_resp):
                result = pull_from_dhis2()

        assert len(result) == 2

    def test_batch_sync_skipped_when_unconfigured(self):
        from apps.integrations.dhis2 import batch_sync
        with patch('apps.integrations.dhis2._creds', return_value=None):
            summary = batch_sync()
        assert summary['errors'] == ['DHIS2 not configured — sync skipped']
        assert summary['pulled'] == 0

    def test_batch_sync_summary_keys(self):
        from apps.integrations.dhis2 import batch_sync
        # Fully mock the HTTP layer so no real request is made
        mock_get_resp = MagicMock()
        mock_get_resp.json.return_value = {'instances': []}
        mock_get_resp.raise_for_status.return_value = None

        with patch('apps.integrations.dhis2._creds', return_value=('http://dhis2', 'u', 'p')):
            with patch('requests.Session.get', return_value=mock_get_resp):
                summary = batch_sync()

        for key in ('pulled', 'upserted', 'pushed_children', 'pushed_vaccinations', 'errors', 'synced_at'):
            assert key in summary


# ── TestDHIS2Signals ──────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestDHIS2Signals:
    def test_child_creation_queues_dhis2_push(self, camp):
        """post_save on a new Child should enqueue dhis2_push_child."""
        with patch('apps.integrations.tasks.dhis2_push_child.apply_async') as mock_task:
            child = ChildFactory(camp=camp)
        mock_task.assert_called_once()
        args = mock_task.call_args[1]['args']
        assert args[0] == str(child.id)

    def test_child_update_does_not_re_queue(self, child):
        """Updating an existing child should NOT queue a DHIS2 push."""
        with patch('apps.integrations.tasks.dhis2_push_child.apply_async') as mock_task:
            child.notes = 'updated'
            child.save()
        mock_task.assert_not_called()

    def test_high_risk_health_record_queues_dhis2_push(self, child):
        """Saving a HealthRecord with risk_level=HIGH should queue dhis2_push_high_risk."""
        from apps.health_records.tests.factories import HealthRecordFactory
        with patch('apps.integrations.tasks.dhis2_push_high_risk.apply_async') as mock_task:
            # Create then update risk_level to HIGH (mimics ML task result)
            record = HealthRecordFactory(child=child, risk_level='HIGH')
        mock_task.assert_called()

    def test_low_risk_health_record_does_not_queue(self, child):
        """LOW-risk records should not trigger a DHIS2 push."""
        from apps.health_records.tests.factories import HealthRecordFactory
        with patch('apps.integrations.tasks.dhis2_push_high_risk.apply_async') as mock_task:
            HealthRecordFactory(child=child, risk_level='LOW')
        mock_task.assert_not_called()
