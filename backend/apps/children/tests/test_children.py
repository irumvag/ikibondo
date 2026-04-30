import pytest
from datetime import date, timedelta
from django.urls import reverse
from rest_framework.test import APIClient
from apps.accounts.tests.factories import UserFactory
from apps.camps.tests.factories import CampFactory
from .factories import ChildFactory, GuardianFactory


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def chw(db):
    return UserFactory(email='chw@test.rw', password='testpass')


@pytest.fixture
def camp(db):
    return CampFactory(name='TestCamp')


@pytest.fixture
def child(db, camp, chw):
    return ChildFactory(camp=camp, registered_by=chw)


@pytest.mark.django_db
class TestChildRegistration:
    def test_register_child_creates_vaccination_schedule(self, client, chw, camp):
        client.force_authenticate(user=chw)
        resp = client.post(reverse('child-list'), {
            'full_name': 'Test Child',
            'date_of_birth': str(date.today() - timedelta(days=60)),
            'sex': 'F',
            'camp': str(camp.id),
            'guardian': {
                'full_name': 'Test Mother',
                'phone_number': '+250789999999',
                'relationship': 'mother',
            }
        }, format='json')
        assert resp.status_code == 201
        assert resp.data['success'] is True

        # Verify vaccination schedule was auto-created
        from apps.children.models import Child
        child = Child.objects.get(full_name='Test Child')
        assert child.vaccinations.count() > 0

    def test_registration_number_auto_generated(self, client, chw, camp):
        client.force_authenticate(user=chw)
        resp = client.post(reverse('child-list'), {
            'full_name': 'Auto Reg Child',
            'date_of_birth': str(date.today() - timedelta(days=90)),
            'sex': 'M',
            'camp': str(camp.id),
            'guardian': {
                'full_name': 'Guardian',
                'phone_number': '+250789999998',
                'relationship': 'father',
            }
        }, format='json')
        assert resp.status_code == 201
        assert resp.data['data']['registration_number'] is not None


@pytest.mark.django_db
class TestChildList:
    def test_list_children(self, client, chw, child):
        client.force_authenticate(user=chw)
        resp = client.get(reverse('child-list'))
        assert resp.status_code == 200
        assert len(resp.data['results']) >= 1

    def test_filter_by_camp(self, client, chw, child, camp):
        client.force_authenticate(user=chw)
        resp = client.get(reverse('child-list'), {'camp': str(camp.id)})
        assert resp.status_code == 200

    def test_filter_by_sex(self, client, chw, child):
        client.force_authenticate(user=chw)
        resp = client.get(reverse('child-list'), {'sex': 'M'})
        assert resp.status_code == 200

    def test_search_by_name(self, client, chw, child):
        client.force_authenticate(user=chw)
        resp = client.get(reverse('child-list'), {'search': child.full_name[:5]})
        assert resp.status_code == 200


@pytest.mark.django_db
class TestChildDetail:
    def test_get_child_detail(self, client, chw, child):
        client.force_authenticate(user=chw)
        resp = client.get(reverse('child-detail', kwargs={'pk': child.id}))
        assert resp.status_code == 200
        # retrieve() returns raw serializer data (no success wrapper)
        assert resp.data['full_name'] == child.full_name

    def test_get_child_history(self, client, chw, child):
        client.force_authenticate(user=chw)
        resp = client.get(reverse('child-history', kwargs={'pk': child.id}))
        assert resp.status_code == 200
        assert resp.data['success'] is True

    def test_get_child_vaccinations(self, client, chw, child):
        client.force_authenticate(user=chw)
        resp = client.get(reverse('child-vaccinations', kwargs={'pk': child.id}))
        assert resp.status_code == 200

    def test_get_child_predictions(self, client, chw, child):
        client.force_authenticate(user=chw)
        resp = client.get(reverse('child-predictions', kwargs={'pk': child.id}))
        assert resp.status_code == 200


@pytest.mark.django_db
class TestChildModel:
    def test_age_months_computed(self, child):
        # Child was born ~300 days ago = ~10 months
        assert child.age_months >= 9
        assert child.age_months <= 11
