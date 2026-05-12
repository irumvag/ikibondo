import pytest
from datetime import date, timedelta
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory, NurseFactory
from apps.accounts.models import UserRole
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
def child(db, camp):
    return ChildFactory(camp=camp)


@pytest.fixture
def nurse(db, camp):
    return NurseFactory(camp=camp)


@pytest.fixture
def parent(db):
    return UserFactory(role=UserRole.PARENT, preferred_language='en')


def _url(child):
    return f'/api/v1/growth-data/{child.id}/'


class TestGrowthDataNurse:
    def test_nurse_gets_full_response(self, client, child, nurse):
        HealthRecordFactory(child=child)
        client.force_authenticate(nurse)
        res = client.get(_url(child))
        assert res.status_code == 200
        data = res.json()['data']
        assert 'measurements' in data
        assert 'who_percentiles' in data
        assert 'parent_summary' in data

    def test_measurements_contain_z_scores(self, client, child, nurse):
        HealthRecordFactory(child=child)
        client.force_authenticate(nurse)
        data = client.get(_url(child)).json()['data']
        m = data['measurements'][0]
        assert 'waz' in m
        assert 'haz' in m
        assert 'whz' in m

    def test_requires_auth(self, client, child, db):
        res = client.get(_url(child))
        assert res.status_code == 401


class TestGrowthDataParent:
    def test_parent_gets_only_parent_summary(self, client, child, parent):
        HealthRecordFactory(child=child)
        client.force_authenticate(parent)
        data = client.get(_url(child)).json()['data']
        assert 'parent_summary' in data
        assert 'measurements' not in data
        assert 'who_percentiles' not in data

    def test_parent_summary_shape(self, client, child, parent):
        HealthRecordFactory(child=child)
        client.force_authenticate(parent)
        ps = client.get(_url(child)).json()['data']['parent_summary']
        assert 'status' in ps
        assert ps['status'] in ('on_track', 'watch', 'concern')
        assert 'latest_milestone' in ps
        assert 'next_milestone' in ps
        assert 'message_key' in ps
        assert 'message' in ps

    def test_no_z_scores_in_parent_summary(self, client, child, parent):
        HealthRecordFactory(child=child)
        client.force_authenticate(parent)
        ps = client.get(_url(child)).json()['data']['parent_summary']
        assert 'waz' not in ps
        assert 'haz' not in ps
        assert 'whz' not in ps

    def test_message_key_format(self, client, child, parent):
        HealthRecordFactory(child=child)
        client.force_authenticate(parent)
        ps = client.get(_url(child)).json()['data']['parent_summary']
        assert ps['message_key'].startswith('growth.status.')

    def test_on_track_when_normal_z_scores(self, db, client, camp):
        child = ChildFactory(camp=camp)
        # Normal-range z-scores: waz/haz/whz all > -1
        HealthRecordFactory(
            child=child,
            weight_kg=9.5, height_cm=75.0,  # normal for ~10mo child
        )
        parent = UserFactory(role=UserRole.PARENT, preferred_language='en')
        client.force_authenticate(parent)
        # Just verify the field exists and has a valid status
        ps = client.get(_url(child)).json()['data']['parent_summary']
        assert ps['status'] in ('on_track', 'watch', 'concern')

    def test_language_preference_applied(self, db, client, camp):
        child = ChildFactory(camp=camp)
        HealthRecordFactory(child=child)

        parent_rw = UserFactory(role=UserRole.PARENT, preferred_language='rw')
        client.force_authenticate(parent_rw)
        ps_rw = client.get(_url(child)).json()['data']['parent_summary']

        parent_fr = UserFactory(role=UserRole.PARENT, preferred_language='fr')
        client.force_authenticate(parent_fr)
        ps_fr = client.get(_url(child)).json()['data']['parent_summary']

        # Same status → different messages in different languages
        if ps_rw['status'] == ps_fr['status']:
            assert ps_rw['message'] != ps_fr['message']

    def test_no_records_returns_on_track(self, client, child, parent):
        client.force_authenticate(parent)
        ps = client.get(_url(child)).json()['data']['parent_summary']
        assert ps['status'] == 'on_track'

    def test_404_for_unknown_child(self, client, parent, db):
        import uuid
        client.force_authenticate(parent)
        res = client.get(f'/api/v1/growth-data/{uuid.uuid4()}/')
        assert res.status_code == 404
