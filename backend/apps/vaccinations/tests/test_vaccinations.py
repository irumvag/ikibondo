import pytest
from datetime import date, timedelta
from django.urls import reverse
from rest_framework.test import APIClient
from apps.accounts.tests.factories import UserFactory, NurseFactory
from apps.camps.tests.factories import CampFactory
from apps.children.tests.factories import ChildFactory
from .factories import VaccineFactory, VaccinationRecordFactory
from apps.vaccinations.models import DoseStatus


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def nurse(db):
    return NurseFactory(email='nurse@test.rw', password='testpass')


@pytest.fixture
def camp(db):
    return CampFactory()


@pytest.fixture
def child(db, camp, nurse):
    return ChildFactory(camp=camp, registered_by=nurse)


@pytest.mark.django_db
class TestVaccinationSchedule:
    def test_schedule_generation(self, child):
        """Child registration should auto-create vaccination schedule."""
        from apps.vaccinations.schedule import generate_schedule_for_child
        records = generate_schedule_for_child(child)
        # Rwanda EPI has 20 vaccine doses
        assert len(records) == 20

    def test_scheduled_dates_based_on_dob(self, child):
        from apps.vaccinations.schedule import generate_schedule_for_child
        records = generate_schedule_for_child(child)
        # BCG is at birth (0 weeks)
        bcg_records = [r for r in records if r.vaccine.short_code == 'BCG']
        assert len(bcg_records) == 1
        assert bcg_records[0].scheduled_date == child.date_of_birth

    def test_overdue_doses_marked_missed(self):
        """If a dose date is > 4 weeks past, it should be MISSED not SCHEDULED."""
        from apps.vaccinations.schedule import generate_schedule_for_child
        # Create a 12-month-old child — birth doses should be marked MISSED
        old_child = ChildFactory(date_of_birth=date.today() - timedelta(days=365))
        records = generate_schedule_for_child(old_child)
        birth_records = [r for r in records if r.vaccine.recommended_age_weeks == 0]
        for r in birth_records:
            assert r.status == DoseStatus.MISSED


@pytest.mark.django_db
class TestVaccinationAPI:
    def test_list_vaccinations(self, client, nurse):
        record = VaccinationRecordFactory()
        client.force_authenticate(user=nurse)
        resp = client.get(reverse('vaccination-list'))
        assert resp.status_code == 200

    def test_mark_as_done(self, client, nurse):
        record = VaccinationRecordFactory()
        client.force_authenticate(user=nurse)
        resp = client.patch(
            reverse('vaccination-detail', kwargs={'pk': record.id}),
            {'status': 'DONE', 'administered_date': str(date.today())},
            format='json'
        )
        assert resp.status_code == 200
        record.refresh_from_db()
        assert record.status == DoseStatus.DONE

    def test_mark_as_missed(self, client, nurse):
        record = VaccinationRecordFactory()
        client.force_authenticate(user=nurse)
        resp = client.patch(
            reverse('vaccination-detail', kwargs={'pk': record.id}),
            {'status': 'MISSED'},
            format='json'
        )
        assert resp.status_code == 200
        record.refresh_from_db()
        assert record.status == DoseStatus.MISSED

    def test_list_vaccines(self, client, nurse):
        VaccineFactory(name='BCG', short_code='BCG')
        client.force_authenticate(user=nurse)
        resp = client.get(reverse('vaccine-list'))
        assert resp.status_code == 200


@pytest.mark.django_db
class TestVaccinationRecordModel:
    def test_is_overdue_property(self):
        past_record = VaccinationRecordFactory(
            scheduled_date=date.today() - timedelta(days=7),
            status=DoseStatus.SCHEDULED
        )
        assert past_record.is_overdue is True

    def test_not_overdue_when_done(self):
        done_record = VaccinationRecordFactory(
            scheduled_date=date.today() - timedelta(days=7),
            status=DoseStatus.DONE
        )
        assert done_record.is_overdue is False
