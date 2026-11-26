"""Government and partner access: aggregated statistics only, scoped by organisation."""
import json
from datetime import date

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Organization, UserRole
from apps.accounts.tests.factories import NurseFactory, UserFactory
from apps.camps.tests.factories import CampFactory
from apps.children.tests.factories import ChildFactory

URL = '/api/v1/insights/overview/'


def _client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


@pytest.fixture
def camps(db):
    big, small, other = CampFactory(name='Big camp'), CampFactory(name='Small camp'), CampFactory(name='Other camp')
    for _ in range(6):
        ChildFactory(camp=big, full_name='Secret Child Name')
    for _ in range(2):
        ChildFactory(camp=small)
    return big, small, other


def _user(role, org):
    return UserFactory(role=role, organization=org, is_approved=True, camp=None)


def _names(res):
    return {c['name'] for c in res.json()['data']['camps']}


@pytest.mark.django_db
class TestWhoSeesWhat:
    def test_ministry_without_camp_list_sees_all_camps(self, camps):
        moh = Organization.objects.create(name='Ministry of Health', kind='GOVERNMENT')
        assert _names(_client(_user(UserRole.GOVERNMENT, moh)).get(URL)) >= {'Big camp', 'Small camp', 'Other camp'}

    def test_partner_sees_only_its_camps(self, camps):
        big, small, _ = camps
        ngo = Organization.objects.create(name='Nutrition NGO', kind='NGO')
        ngo.camps.set([big])
        assert _names(_client(_user(UserRole.PARTNER, ngo)).get(URL)) == {'Big camp'}

    def test_partner_with_no_camps_sees_nothing(self, camps):
        ngo = Organization.objects.create(name='New NGO', kind='NGO')
        data = _client(_user(UserRole.PARTNER, ngo)).get(URL).json()['data']
        assert data['camps'] == [] and data['total'] is None

    def test_cannot_ask_for_a_camp_outside_the_organisation(self, camps):
        big, small, _ = camps
        ngo = Organization.objects.create(name='Nutrition NGO', kind='NGO')
        ngo.camps.set([big])
        res = _client(_user(UserRole.PARTNER, ngo)).get(URL, {'camp': str(small.id)})
        assert res.json()['data']['camps'] == []

    def test_care_roles_and_anonymous_are_refused(self, camps):
        assert _client(NurseFactory(camp=camps[0])).get(URL).status_code == 403
        assert APIClient().get(URL).status_code in (401, 403)


@pytest.mark.django_db
class TestPrivacy:
    def test_small_counts_are_hidden(self, camps):
        moh = Organization.objects.create(name='MoH', kind='GOVERNMENT')
        data = _client(_user(UserRole.GOVERNMENT, moh)).get(URL).json()['data']
        by_name = {c['name']: c for c in data['camps']}
        assert by_name['Big camp']['children'] == {'value': 6, 'suppressed': False}
        assert by_name['Small camp']['children'] == {'value': None, 'suppressed': True}
        assert by_name['Other camp']['children'] == {'value': 0, 'suppressed': False}

    def test_no_child_records_or_names_are_returned(self, camps):
        moh = Organization.objects.create(name='MoH', kind='GOVERNMENT')
        body = json.dumps(_client(_user(UserRole.GOVERNMENT, moh)).get(URL).json())
        assert 'Secret Child Name' not in body and 'registration_number' not in body

    def test_government_user_cannot_open_child_records(self, camps):
        moh = Organization.objects.create(name='MoH', kind='GOVERNMENT')
        res = _client(_user(UserRole.GOVERNMENT, moh)).get('/api/v1/children/')
        rows = res.json().get('data', [])
        rows = rows.get('results', rows) if isinstance(rows, dict) else rows
        assert res.status_code == 403 or rows == []

    def test_csv_export_marks_hidden_counts(self, camps):
        moh = Organization.objects.create(name='MoH', kind='GOVERNMENT')
        res = _client(_user(UserRole.GOVERNMENT, moh)).get('/api/v1/insights/export/')
        text = res.content.decode()
        assert res.status_code == 200 and res['Content-Type'].startswith('text/csv')
        assert 'Small camp' in text and '<5' in text and 'Secret Child Name' not in text


@pytest.mark.django_db
def test_admin_manages_organisations_and_assigns_members(camps):
    from apps.accounts.tests.factories import AdminUserFactory
    admin = _client(AdminUserFactory())
    res = admin.post('/api/v1/auth/organizations/', {'name': 'UNICEF Rwanda', 'kind': 'NGO',
                                                     'camps': [str(camps[0].id)]}, format='json')
    assert res.status_code == 201, res.content
    org_id = res.json().get('data', res.json())['id']
    user = UserFactory(role=UserRole.CHW, camp=camps[0])
    res = admin.patch(f'/api/v1/auth/users/{user.id}/', {'role': 'PARTNER', 'camp': None}, format='json')
    assert res.status_code == 400  # a partner needs an organisation
    res = admin.patch(f'/api/v1/auth/users/{user.id}/', {'role': 'PARTNER', 'camp': None, 'organization': org_id},
                      format='json')
    assert res.status_code == 200 and res.json()['data']['organization_name'] == 'UNICEF Rwanda'


@pytest.mark.django_db
def test_trend_months_are_consecutive(camps):
    from apps.core.insights import _trend
    months = [m['month'] for m in _trend([camps[0].id], date(2026, 3, 15))]
    assert months[0] == '2025-04' and months[-1] == '2026-03' and len(months) == 12


class TestInstitutionalIndicators:
    def test_bands_follow_who_unicef_thresholds(self):
        from apps.core.insights import STUNTING_BANDS, WASTING_BANDS, _band
        assert _band(1.0, WASTING_BANDS) == ('Very low', 'good')
        assert _band(7.0, WASTING_BANDS) == ('Medium', 'watch')
        assert _band(16.0, WASTING_BANDS) == ('Very high', 'alert')
        assert _band(25.0, STUNTING_BANDS) == ('High', 'alert')

    def test_targets_judge_direction(self):
        from apps.core.insights import _indicator
        assert _indicator(96, target=95)['level'] == 'good'
        assert _indicator(80, target=95)['level'] == 'alert'
        assert _indicator(12, target=10, higher_is_better=False)['level'] == 'watch'
        assert _indicator(None, target=95)['level'] is None  # too few children: no verdict


class TestIndicatorSettings:
    def test_admin_changes_target_and_text_and_partners_see_it(self, db, camps):
        from apps.accounts.tests.factories import AdminUserFactory
        from rest_framework.test import APIClient
        admin = APIClient()
        admin.force_authenticate(AdminUserFactory())
        res = admin.put('/api/v1/insights/indicators/measles_coverage/',
                        {'label': 'Measles coverage (MR1)', 'target': 90, 'benchmark': 'Rwanda EPI target 90%'}, format='json')
        assert res.status_code == 200
        from apps.core.insights import indicator_config
        c = indicator_config()['measles_coverage']
        assert (c['label'], c['target'], c['benchmark']) == ('Measles coverage (MR1)', 90.0, 'Rwanda EPI target 90%')
        assert admin.delete('/api/v1/insights/indicators/measles_coverage/').status_code == 200
        assert indicator_config()['measles_coverage']['target'] == 95

    def test_band_indicators_refuse_a_target(self, db):
        from apps.accounts.tests.factories import AdminUserFactory
        from rest_framework.test import APIClient
        admin = APIClient()
        admin.force_authenticate(AdminUserFactory())
        assert admin.put('/api/v1/insights/indicators/gam_rate/', {'target': 5}, format='json').status_code == 400

    def test_only_admins_edit(self, db):
        from apps.accounts.models import Organization, UserRole
        from rest_framework.test import APIClient
        c = APIClient()
        c.force_authenticate(_user(UserRole.GOVERNMENT, Organization.objects.create(name='Ministry', kind='GOVERNMENT')))
        assert c.put('/api/v1/insights/indicators/sam_rate/', {'target': 3}, format='json').status_code == 403
