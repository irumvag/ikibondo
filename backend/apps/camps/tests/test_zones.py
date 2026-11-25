import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from apps.accounts.tests.factories import UserFactory, SupervisorFactory, AdminUserFactory
from .factories import CampFactory, ZoneFactory


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def camp(db):
    return CampFactory(name='Mahama', district='Kirehe')


@pytest.fixture
def zone(db, camp):
    return ZoneFactory(camp=camp, name='Zone A', code='ZNA')


@pytest.fixture
def chw(db):
    return UserFactory(email='chw@test.rw', password='testpass')


@pytest.fixture
def supervisor(db):
    return SupervisorFactory(email='super@test.rw', password='testpass')


@pytest.fixture
def admin(db):
    return AdminUserFactory(email='admin@test.rw', password='testpass')


# ── List ───────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestZoneList:
    def test_authenticated_user_can_list(self, client, chw, camp, zone):
        client.force_authenticate(user=chw)
        url = reverse('camp-zone-list', kwargs={'camp_pk': camp.pk})
        resp = client.get(url)
        assert resp.status_code == 200
        results = resp.data.get('results', resp.data)
        assert isinstance(results, list)
        assert len(results) == 1

    def test_unauthenticated_is_rejected(self, client, camp):
        url = reverse('camp-zone-list', kwargs={'camp_pk': camp.pk})
        resp = client.get(url)
        assert resp.status_code == 401

    def test_only_returns_zones_for_that_camp(self, client, chw, camp):
        other_camp = CampFactory()
        ZoneFactory(camp=camp, name='My Zone', code='ZMY')
        ZoneFactory(camp=other_camp, name='Other Zone', code='ZOT')
        client.force_authenticate(user=chw)
        url = reverse('camp-zone-list', kwargs={'camp_pk': camp.pk})
        resp = client.get(url)
        results = resp.data.get('results', resp.data)
        names = [r['name'] for r in results]
        assert 'My Zone' in names
        assert 'Other Zone' not in names


# ── Create ────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestZoneCreate:
    def _payload(self):
        return {
            'name': 'New Zone', 'code': 'ZNW', 'status': 'active',
            'estimated_households': 300, 'estimated_population': 1500,
        }

    def test_supervisor_can_create(self, client, supervisor, camp):
        client.force_authenticate(user=supervisor)
        url = reverse('camp-zone-list', kwargs={'camp_pk': camp.pk})
        resp = client.post(url, self._payload())
        assert resp.status_code == 201
        assert resp.data['name'] == 'New Zone'

    def test_admin_can_create(self, client, admin, camp):
        client.force_authenticate(user=admin)
        url = reverse('camp-zone-list', kwargs={'camp_pk': camp.pk})
        resp = client.post(url, self._payload())
        assert resp.status_code == 201

    def test_chw_cannot_create(self, client, chw, camp):
        client.force_authenticate(user=chw)
        url = reverse('camp-zone-list', kwargs={'camp_pk': camp.pk})
        resp = client.post(url, self._payload())
        assert resp.status_code == 403

    def test_zone_is_linked_to_correct_camp(self, client, supervisor, camp):
        client.force_authenticate(user=supervisor)
        url = reverse('camp-zone-list', kwargs={'camp_pk': camp.pk})
        resp = client.post(url, self._payload())
        assert resp.status_code == 201
        assert str(resp.data['camp']) == str(camp.pk)

    def test_missing_required_fields_rejected(self, client, supervisor, camp):
        client.force_authenticate(user=supervisor)
        url = reverse('camp-zone-list', kwargs={'camp_pk': camp.pk})
        resp = client.post(url, {'status': 'ACTIVE'})   # name and code missing
        assert resp.status_code == 400


# ── Retrieve ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestZoneRetrieve:
    def test_authenticated_can_retrieve(self, client, chw, camp, zone):
        client.force_authenticate(user=chw)
        url = reverse('camp-zone-detail', kwargs={'camp_pk': camp.pk, 'pk': zone.pk})
        resp = client.get(url)
        assert resp.status_code == 200
        assert resp.data['name'] == 'Zone A'
        assert resp.data['code'] == 'ZNA'


# ── Update ────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestZoneUpdate:
    def test_supervisor_can_patch(self, client, supervisor, camp, zone):
        client.force_authenticate(user=supervisor)
        url = reverse('camp-zone-detail', kwargs={'camp_pk': camp.pk, 'pk': zone.pk})
        resp = client.patch(url, {'name': 'Renamed Zone', 'status': 'inactive'})
        assert resp.status_code == 200
        assert resp.data['name'] == 'Renamed Zone'
        assert resp.data['status'] == 'inactive'

    def test_admin_can_patch(self, client, admin, camp, zone):
        client.force_authenticate(user=admin)
        url = reverse('camp-zone-detail', kwargs={'camp_pk': camp.pk, 'pk': zone.pk})
        resp = client.patch(url, {'estimated_population': 9999})
        assert resp.status_code == 200
        assert resp.data['estimated_population'] == 9999

    def test_chw_cannot_patch(self, client, chw, camp, zone):
        client.force_authenticate(user=chw)
        url = reverse('camp-zone-detail', kwargs={'camp_pk': camp.pk, 'pk': zone.pk})
        resp = client.patch(url, {'name': 'Hack attempt'})
        assert resp.status_code == 403


# ── Delete ────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestZoneDelete:
    def test_supervisor_can_delete(self, client, supervisor, camp, zone):
        client.force_authenticate(user=supervisor)
        url = reverse('camp-zone-detail', kwargs={'camp_pk': camp.pk, 'pk': zone.pk})
        resp = client.delete(url)
        assert resp.status_code in (200, 204)

    def test_chw_cannot_delete(self, client, chw, camp, zone):
        client.force_authenticate(user=chw)
        url = reverse('camp-zone-detail', kwargs={'camp_pk': camp.pk, 'pk': zone.pk})
        resp = client.delete(url)
        assert resp.status_code == 403

    def test_unauthenticated_cannot_delete(self, client, camp, zone):
        url = reverse('camp-zone-detail', kwargs={'camp_pk': camp.pk, 'pk': zone.pk})
        resp = client.delete(url)
        assert resp.status_code == 401
