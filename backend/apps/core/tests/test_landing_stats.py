import pytest
from datetime import date, timedelta
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory
from apps.accounts.models import UserRole
from apps.camps.tests.factories import CampFactory
from apps.children.tests.factories import ChildFactory
from apps.health_records.tests.factories import HealthRecordFactory
from apps.vaccinations.tests.factories import VaccineFactory, VaccinationRecordFactory
from apps.vaccinations.models import DoseStatus


LANDING_URL = '/api/v1/stats/landing/'


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def camp(db):
    return CampFactory()


@pytest.fixture
def child(db, camp):
    return ChildFactory(camp=camp)


class TestLandingStatsEndpoint:
    def test_returns_200_unauthenticated(self, client, db):
        res = client.get(LANDING_URL)
        assert res.status_code == 200

    def test_response_shape(self, client, db):
        res = client.get(LANDING_URL)
        data = res.json()
        assert 'total_children' in data
        assert 'total_camps' in data
        assert 'total_chws_active' in data
        assert 'high_risk_30d' in data
        assert 'vaccination_coverage_pct' in data
        assert 'risk_distribution' in data
        assert set(data['risk_distribution'].keys()) == {'LOW', 'MEDIUM', 'HIGH'}

    def test_total_children_count(self, client, db, camp):
        ChildFactory.create_batch(3, camp=camp)
        res = client.get(LANDING_URL)
        assert res.json()['total_children'] == 3

    def test_inactive_children_excluded(self, client, db, camp):
        ChildFactory.create_batch(2, camp=camp)
        ChildFactory(camp=camp, is_active=False)
        res = client.get(LANDING_URL)
        assert res.json()['total_children'] == 2

    def test_total_camps_active_only(self, client, db):
        CampFactory(status='active')
        CampFactory(status='closed')
        res = client.get(LANDING_URL)
        assert res.json()['total_camps'] == 1

    def test_total_chws_active(self, client, db):
        UserFactory.create_batch(2, role=UserRole.CHW, is_active=True)
        UserFactory(role=UserRole.CHW, is_active=False)
        UserFactory(role=UserRole.NURSE, is_active=True)
        res = client.get(LANDING_URL)
        assert res.json()['total_chws_active'] == 2

    def test_high_risk_30d_counts_recent_only(self, client, db, child):
        HealthRecordFactory(child=child, risk_level='HIGH',
                            measurement_date=date.today() - timedelta(days=5))
        HealthRecordFactory(child=child, risk_level='HIGH',
                            measurement_date=date.today() - timedelta(days=35))
        HealthRecordFactory(child=child, risk_level='LOW',
                            measurement_date=date.today())
        res = client.get(LANDING_URL)
        assert res.json()['high_risk_30d'] == 1

    def test_risk_distribution(self, client, db, child):
        HealthRecordFactory(child=child, risk_level='LOW')
        HealthRecordFactory(child=child, risk_level='LOW')
        HealthRecordFactory(child=child, risk_level='MEDIUM')
        HealthRecordFactory(child=child, risk_level='HIGH')
        res = client.get(LANDING_URL)
        dist = res.json()['risk_distribution']
        assert dist['LOW'] == 2
        assert dist['MEDIUM'] == 1
        assert dist['HIGH'] == 1

    def test_vaccination_coverage_pct(self, client, db, child):
        vaccine = VaccineFactory()
        VaccinationRecordFactory(child=child, vaccine=vaccine, status=DoseStatus.DONE)
        VaccinationRecordFactory(child=child, vaccine=vaccine, status=DoseStatus.DONE)
        VaccinationRecordFactory(child=child, vaccine=vaccine, status=DoseStatus.SCHEDULED)
        VaccinationRecordFactory(child=child, vaccine=vaccine, status=DoseStatus.SKIPPED)
        res = client.get(LANDING_URL)
        # 2 done out of 3 non-skipped = 66.7%
        assert res.json()['vaccination_coverage_pct'] == 66.7

    def test_vaccination_coverage_zero_when_no_records(self, client, db):
        res = client.get(LANDING_URL)
        assert res.json()['vaccination_coverage_pct'] == 0.0

    def test_response_is_cached(self, client, db, camp):
        ChildFactory.create_batch(2, camp=camp)
        res1 = client.get(LANDING_URL)
        count1 = res1.json()['total_children']

        # Add more children — cached result should still show old count
        ChildFactory.create_batch(3, camp=camp)
        res2 = client.get(LANDING_URL)
        assert res2.json()['total_children'] == count1

    def test_risk_distribution_null_risk_levels_excluded(self, client, db, child):
        HealthRecordFactory(child=child, risk_level=None)
        res = client.get(LANDING_URL)
        dist = res.json()['risk_distribution']
        assert dist == {'LOW': 0, 'MEDIUM': 0, 'HIGH': 0}
