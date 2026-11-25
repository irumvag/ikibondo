import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from apps.accounts.tests.factories import UserFactory, SupervisorFactory
from .factories import CampFactory


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def chw(db):
    return UserFactory(email='chw@test.rw', password='testpass')


@pytest.fixture
def supervisor(db):
    return SupervisorFactory(email='super@test.rw', password='testpass')


@pytest.fixture
def camp(db):
    return CampFactory(name='Mahama', district='Kirehe')


@pytest.mark.django_db
class TestCampList:
    def test_list_camps_authenticated(self, client, chw, camp):
        client.force_authenticate(user=chw)
        resp = client.get(reverse('camp-list'))
        assert resp.status_code == 200
        # DRF standard list response (paginated or plain list)
        results = resp.data.get('results', resp.data)
        assert isinstance(results, list)

    def test_list_camps_unauthenticated(self, client, camp):
        # Camp names stay public for the registration camp picker
        resp = client.get(reverse('camp-list'))
        assert resp.status_code == 200

    def test_anonymous_camp_list_hides_population(self, client, camp):
        resp = client.get(reverse('camp-list'))
        results = resp.data.get('results', resp.data)
        # The admin-written public description is the only text added; still no counts
        assert set(results[0].keys()) == {'id', 'name', 'code', 'district', 'public_description'}


@pytest.mark.django_db
class TestCampCreate:
    def test_create_camp_supervisor_forbidden(self, client, supervisor):
        # Camp creation is admin-only; supervisors manage their own camp's zones
        client.force_authenticate(user=supervisor)
        resp = client.post(reverse('camp-list'), {
            'name': 'Kiziba', 'district': 'Karongi', 'province': 'Western', 'capacity': 10000
        })
        assert resp.status_code == 403

    def test_create_camp_chw_forbidden(self, client, chw):
        client.force_authenticate(user=chw)
        resp = client.post(reverse('camp-list'), {
            'name': 'Kiziba', 'district': 'Karongi', 'province': 'Western', 'capacity': 10000
        })
        assert resp.status_code == 403


@pytest.mark.django_db
class TestCampStats:
    def test_stats_returns_counts(self, client, chw, camp):
        client.force_authenticate(user=chw)
        resp = client.get(reverse('camp-stats', kwargs={'pk': camp.id}))
        assert resp.status_code == 200
        data = resp.data['data']
        assert 'total_children' in data
        assert 'sam_count' in data
        assert 'vaccination_coverage_percent' in data
