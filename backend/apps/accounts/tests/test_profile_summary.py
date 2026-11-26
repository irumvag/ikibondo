"""The profile page summary: each person's own work, for the role they act as."""
from datetime import date

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import UserRole
from apps.accounts.tests.factories import NurseFactory, UserFactory
from apps.camps.tests.factories import CampFactory
from apps.children.tests.factories import ChildFactory
from apps.health_records.tests.factories import HealthRecordFactory

URL = '/api/v1/auth/me/summary/'


def _get(user):
    client = APIClient()
    client.force_authenticate(user)
    body = client.get(URL).json()
    return body.get('data', body)


@pytest.mark.django_db
def test_parent_sees_only_their_own_children():
    parent = UserFactory(role=UserRole.PARENT)
    mine = ChildFactory()
    mine.guardian.user = parent
    mine.guardian.save(update_fields=['user'])
    ChildFactory()  # someone else's child
    HealthRecordFactory(child=mine, measurement_date=date.today(), nutrition_status='NORMAL', risk_level='LOW')
    work = _get(parent)['work']
    assert [c['full_name'] for c in work['children']] == [mine.full_name]
    assert work['children'][0]['nutrition_status'] == 'NORMAL'


@pytest.mark.django_db
def test_nurse_counts_their_own_work():
    camp = CampFactory()
    nurse = NurseFactory(camp=camp)
    ChildFactory(camp=camp, registered_by=nurse)
    ChildFactory(camp=camp)
    data = _get(nurse)
    assert data['work']['children_in_camp'] == 2
    assert data['work']['registered_by_me'] == 1
    assert data['member_since']


@pytest.mark.django_db
def test_unauthenticated_is_refused():
    assert APIClient().get(URL).status_code in (401, 403)


@pytest.mark.django_db
def test_signing_in_with_identifier_records_last_sign_in():
    user = UserFactory(role=UserRole.PARENT, email='mum@example.rw', is_approved=True)
    user.set_password('a-strong-pass-123')
    user.save()
    res = APIClient().post('/api/v1/auth/login/', {'identifier': 'mum@example.rw', 'password': 'a-strong-pass-123'}, format='json')
    assert res.status_code == 200
    user.refresh_from_db()
    assert user.last_login is not None


@pytest.mark.django_db
def test_partner_profile_shows_aggregates_only():
    from apps.accounts.models import Organization
    camp = CampFactory()
    org = Organization.objects.create(name='Test NGO', kind='NGO')
    org.camps.set([camp])
    partner = UserFactory(role=UserRole.PARTNER, organization=org, is_approved=True)
    for _ in range(6):
        ChildFactory(camp=camp)
    work = _get(partner)['work']
    assert work['organization'] == 'Test NGO' and work['camps_covered'] == 1
    assert work['highlights']['children'] == {'value': 6, 'suppressed': False}
    assert 'children' not in {k for k in work if isinstance(work[k], list)}  # no child list for partners
