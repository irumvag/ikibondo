"""
Tests for Sprint 7 CHW field endpoints:
  GET /api/v1/chw/daily-plan/   — prioritised visit list
  GET /api/v1/chw/families/     — full family caseload
"""
import pytest
from datetime import date, timedelta
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory, NurseFactory
from apps.accounts.models import UserRole
from apps.camps.tests.factories import CampFactory
from apps.children.models import VisitRequest, VisitRequestStatus
from apps.children.tests.factories import ChildFactory, GuardianFactory
from apps.vaccinations.models import DoseStatus
from apps.vaccinations.tests.factories import VaccineFactory, VaccinationRecordFactory
from apps.health_records.models import HealthRecord
from apps.health_records.tests.factories import HealthRecordFactory


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def camp(db):
    return CampFactory()


@pytest.fixture
def chw(db, camp):
    return UserFactory(role=UserRole.CHW, camp=camp)


@pytest.fixture
def nurse(db, camp):
    return NurseFactory(camp=camp)


@pytest.fixture
def guardian(db, chw):
    return GuardianFactory(assigned_chw=chw)


@pytest.fixture
def child(db, camp, guardian):
    return ChildFactory(camp=camp, guardian=guardian)


@pytest.fixture
def vaccine(db):
    return VaccineFactory()


DAILY_PLAN_URL = '/api/v1/chw/daily-plan/'
FAMILIES_URL   = '/api/v1/chw/families/'


# ── TestDailyPlanAuth ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestDailyPlanAuth:
    def test_requires_auth(self, client):
        res = client.get(DAILY_PLAN_URL)
        assert res.status_code == 401

    def test_nurse_cannot_access(self, client, nurse):
        client.force_authenticate(nurse)
        res = client.get(DAILY_PLAN_URL)
        assert res.status_code == 403

    def test_chw_can_access(self, client, chw, child):
        client.force_authenticate(chw)
        res = client.get(DAILY_PLAN_URL)
        assert res.status_code == 200

    def test_returns_list(self, client, chw, child):
        client.force_authenticate(chw)
        res = client.get(DAILY_PLAN_URL)
        assert isinstance(res.json()['data'], list)


# ── TestDailyPlanScoping ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestDailyPlanScoping:
    def test_only_own_caseload_returned(self, client, chw, camp, child):
        """Children not assigned to this CHW must not appear."""
        other_guardian = GuardianFactory(assigned_chw=None)
        ChildFactory(camp=camp, guardian=other_guardian)
        client.force_authenticate(chw)
        res = client.get(DAILY_PLAN_URL)
        ids = [item['child_id'] for item in res.json()['data']]
        assert str(child.id) in ids
        assert len(ids) == 1

    def test_empty_caseload_returns_empty_list(self, client, camp):
        empty_chw = UserFactory(role=UserRole.CHW, camp=camp)
        client.force_authenticate(empty_chw)
        res = client.get(DAILY_PLAN_URL)
        assert res.status_code == 200
        assert res.json()['data'] == []


# ── TestDailyPlanPriorityScoring ─────────────────────────────────────────────

@pytest.mark.django_db
class TestDailyPlanPriorityScoring:
    def _get_item(self, client, chw, child_id):
        res = client.get(DAILY_PLAN_URL)
        items = res.json()['data']
        return next((i for i in items if i['child_id'] == str(child_id)), None)

    def test_pending_visit_request_adds_40(self, client, chw, child):
        VisitRequest.objects.create(
            child=child,
            requested_by=chw,
            status=VisitRequestStatus.PENDING,
        )
        client.force_authenticate(chw)
        item = self._get_item(client, chw, child.id)
        assert item is not None
        assert item['has_pending_request'] is True
        assert item['priority_score'] >= 40

    def test_high_risk_adds_30(self, client, chw, child, nurse):
        HealthRecordFactory(child=child, recorded_by=nurse, measurement_date=date.today(), risk_level='HIGH')
        client.force_authenticate(chw)
        item = self._get_item(client, chw, child.id)
        assert item['risk_level'] == 'HIGH'
        assert item['priority_score'] >= 30

    def test_overdue_vaccine_adds_20(self, client, chw, child, vaccine):
        VaccinationRecordFactory(
            child=child,
            vaccine=vaccine,
            status=DoseStatus.SCHEDULED,
            scheduled_date=date.today() - timedelta(days=5),
        )
        client.force_authenticate(chw)
        item = self._get_item(client, chw, child.id)
        assert item['has_overdue_vaccine'] is True
        assert item['priority_score'] >= 20

    def test_never_visited_adds_15(self, client, chw, child):
        # No HealthRecord created
        client.force_authenticate(chw)
        item = self._get_item(client, chw, child.id)
        assert item['last_visit_days_ago'] is None
        assert item['priority_score'] >= 15

    def test_visited_over_30_days_ago_adds_5(self, client, chw, child, nurse):
        HealthRecordFactory(child=child, recorded_by=nurse, measurement_date=date.today() - timedelta(days=35), risk_level='LOW')
        client.force_authenticate(chw)
        item = self._get_item(client, chw, child.id)
        assert item['last_visit_days_ago'] == 35
        assert item['priority_score'] >= 5

    def test_recently_visited_low_risk_scores_zero(self, client, chw, child, nurse):
        HealthRecordFactory(child=child, recorded_by=nurse, measurement_date=date.today() - timedelta(days=3), risk_level='LOW')
        client.force_authenticate(chw)
        item = self._get_item(client, chw, child.id)
        assert item['priority_score'] == 0

    def test_combined_score_request_and_high_risk(self, client, chw, child, nurse):
        HealthRecordFactory(child=child, recorded_by=nurse, measurement_date=date.today(), risk_level='HIGH')
        VisitRequest.objects.create(
            child=child,
            requested_by=chw,
            status=VisitRequestStatus.PENDING,
        )
        client.force_authenticate(chw)
        item = self._get_item(client, chw, child.id)
        # 40 (request) + 30 (HIGH risk) = 70 minimum
        assert item['priority_score'] >= 70

    def test_sorted_highest_score_first(self, client, chw, camp, nurse):
        # Child A: high priority — pending request
        g_a = GuardianFactory(assigned_chw=chw)
        child_a = ChildFactory(camp=camp, guardian=g_a)
        VisitRequest.objects.create(child=child_a, requested_by=chw, status=VisitRequestStatus.PENDING)

        # Child B: low priority — recently visited
        g_b = GuardianFactory(assigned_chw=chw)
        child_b = ChildFactory(camp=camp, guardian=g_b)
        HealthRecordFactory(child=child_b, recorded_by=nurse, measurement_date=date.today() - timedelta(days=2), risk_level='LOW')

        client.force_authenticate(chw)
        items = client.get(DAILY_PLAN_URL).json()['data']
        scores = [i['priority_score'] for i in items]
        assert scores == sorted(scores, reverse=True)
        assert items[0]['child_id'] == str(child_a.id)


# ── TestCHWFamiliesAuth ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCHWFamiliesAuth:
    def test_requires_auth(self, client):
        res = client.get(FAMILIES_URL)
        assert res.status_code == 401

    def test_nurse_cannot_access(self, client, nurse):
        client.force_authenticate(nurse)
        res = client.get(FAMILIES_URL)
        assert res.status_code == 403

    def test_chw_can_access(self, client, chw, child):
        client.force_authenticate(chw)
        res = client.get(FAMILIES_URL)
        assert res.status_code == 200


# ── TestCHWFamiliesPayload ────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCHWFamiliesPayload:
    def _get_child_entry(self, client, chw, child):
        res = client.get(FAMILIES_URL)
        for family in res.json()['data']:
            for c in family['children']:
                if c['id'] == str(child.id):
                    return c
        return None

    def test_returns_guardian_with_children(self, client, chw, guardian, child):
        client.force_authenticate(chw)
        res = client.get(FAMILIES_URL)
        data = res.json()['data']
        assert len(data) == 1
        assert data[0]['full_name'] == guardian.full_name
        assert len(data[0]['children']) == 1

    def test_unassigned_guardian_not_returned(self, client, chw, camp):
        other = GuardianFactory(assigned_chw=None)
        ChildFactory(camp=camp, guardian=other)
        client.force_authenticate(chw)
        res = client.get(FAMILIES_URL)
        assert res.json()['data'] == []

    def test_risk_level_returned(self, client, chw, child, nurse):
        HealthRecordFactory(child=child, recorded_by=nurse, measurement_date=date.today(), risk_level='HIGH')
        client.force_authenticate(chw)
        c_entry = self._get_child_entry(client, chw, child)
        assert c_entry['risk_level'] == 'HIGH'

    def test_risk_unknown_when_no_records(self, client, chw, child):
        client.force_authenticate(chw)
        c_entry = self._get_child_entry(client, chw, child)
        assert c_entry['risk_level'] == 'UNKNOWN'

    def test_overdue_vaccine_count(self, client, chw, child, vaccine):
        VaccinationRecordFactory(
            child=child,
            vaccine=vaccine,
            status=DoseStatus.SCHEDULED,
            scheduled_date=date.today() - timedelta(days=10),
        )
        client.force_authenticate(chw)
        c_entry = self._get_child_entry(client, chw, child)
        assert c_entry['overdue_vaccines'] == 1

    def test_upcoming_vaccine_count(self, client, chw, child, vaccine):
        VaccinationRecordFactory(
            child=child,
            vaccine=vaccine,
            status=DoseStatus.SCHEDULED,
            scheduled_date=date.today() + timedelta(days=7),
        )
        client.force_authenticate(chw)
        c_entry = self._get_child_entry(client, chw, child)
        assert c_entry['upcoming_vaccines'] == 1

    def test_next_vaccine_name_and_date(self, client, chw, child, vaccine):
        target_date = date.today() + timedelta(days=14)
        VaccinationRecordFactory(
            child=child,
            vaccine=vaccine,
            status=DoseStatus.SCHEDULED,
            scheduled_date=target_date,
        )
        client.force_authenticate(chw)
        c_entry = self._get_child_entry(client, chw, child)
        assert c_entry['next_vaccine_name'] == vaccine.name
        assert c_entry['next_vaccine_date'] == str(target_date)

    def test_last_visit_date_returned(self, client, chw, child, nurse):
        visit_date = date.today() - timedelta(days=10)
        HealthRecordFactory(child=child, recorded_by=nurse, measurement_date=visit_date, risk_level='LOW')
        client.force_authenticate(chw)
        c_entry = self._get_child_entry(client, chw, child)
        assert c_entry['last_visit_date'] == str(visit_date)
        assert c_entry['last_visit_days_ago'] == 10

    def test_last_visit_null_when_never_visited(self, client, chw, child):
        client.force_authenticate(chw)
        c_entry = self._get_child_entry(client, chw, child)
        assert c_entry['last_visit_date'] is None
        assert c_entry['last_visit_days_ago'] is None

    def test_multiple_families_all_returned(self, client, chw, camp, guardian, child):
        g2 = GuardianFactory(assigned_chw=chw)
        ChildFactory(camp=camp, guardian=g2)
        client.force_authenticate(chw)
        res = client.get(FAMILIES_URL)
        assert len(res.json()['data']) == 2
