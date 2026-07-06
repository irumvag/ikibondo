"""
Tests for ClinicSession bulk-vaccination workflow (Sprint 4).

Covers:
  POST   /vaccinations/clinic-sessions/                              create session
  GET    /vaccinations/clinic-sessions/<id>/eligible-children/      list eligible
  POST   /vaccinations/clinic-sessions/<id>/record-attendance/      bulk mark DONE
  DELETE /vaccinations/clinic-sessions/<id>/attendees/<child_id>/   remove attendee
  POST   /vaccinations/clinic-sessions/<id>/close/                  close session
"""
import pytest
from datetime import date
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory, NurseFactory
from apps.accounts.models import UserRole
from apps.camps.tests.factories import CampFactory
from apps.children.tests.factories import ChildFactory
from apps.vaccinations.models import DoseStatus, ClinicSession, ClinicSessionAttendance
from .factories import VaccineFactory, VaccinationRecordFactory


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def camp(db):
    return CampFactory(name='SessionCamp')


@pytest.fixture
def nurse(db, camp):
    return NurseFactory(email='cs_nurse@test.rw', camp=camp)


@pytest.fixture
def vaccine(db):
    return VaccineFactory(name='DPT-HepB-Hib', short_code='DPT1', dose_number=1)


@pytest.fixture
def child(db, camp):
    return ChildFactory(camp=camp)


@pytest.fixture
def session(db, camp, vaccine, nurse):
    return ClinicSession.objects.create(
        camp=camp,
        vaccine=vaccine,
        session_date=date.today(),
        opened_by=nurse,
        status='OPEN',
    )


# ── Session creation ──────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestClinicSessionCreate:
    def test_nurse_can_create_session(self, client, nurse, vaccine):
        # camp is injected by view from nurse.camp — do not pass in body
        client.force_authenticate(user=nurse)
        resp = client.post(
            reverse('clinic-session-list'),
            {'vaccine': str(vaccine.id), 'session_date': str(date.today())},
            format='json',
        )
        assert resp.status_code == 201

    def test_parent_cannot_create_session(self, client, vaccine, camp):
        parent = UserFactory(email='cs_parent@test.rw', role=UserRole.PARENT, camp=camp)
        client.force_authenticate(user=parent)
        resp = client.post(
            reverse('clinic-session-list'),
            {'vaccine': str(vaccine.id), 'session_date': str(date.today())},
            format='json',
        )
        assert resp.status_code in (403, 404)


# ── Eligible children ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestEligibleChildren:
    def test_eligible_children_listed(self, client, nurse, session, child, vaccine):
        VaccinationRecordFactory(child=child, vaccine=vaccine, status=DoseStatus.SCHEDULED)
        client.force_authenticate(user=nurse)
        resp = client.get(
            reverse('clinic-session-eligible-children', kwargs={'pk': session.id})
        )
        assert resp.status_code == 200

    def test_already_done_not_listed(self, client, nurse, session, child, vaccine):
        VaccinationRecordFactory(child=child, vaccine=vaccine, status=DoseStatus.DONE)
        client.force_authenticate(user=nurse)
        resp = client.get(
            reverse('clinic-session-eligible-children', kwargs={'pk': session.id})
        )
        assert resp.status_code == 200
        items = resp.data.get('data') or resp.data.get('results') or []
        child_ids = [str(c['id']) for c in items]
        assert str(child.id) not in child_ids


# ── Record attendance ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRecordAttendance:
    def test_bulk_mark_done(self, client, nurse, session, child, vaccine):
        record = VaccinationRecordFactory(
            child=child, vaccine=vaccine, status=DoseStatus.SCHEDULED
        )
        client.force_authenticate(user=nurse)
        resp = client.post(
            reverse('clinic-session-record-attendance', kwargs={'pk': session.id}),
            {'attendances': [{'child': str(child.id), 'status': 'DONE'}]},
            format='json',
        )
        assert resp.status_code == 200
        record.refresh_from_db()
        assert record.status == DoseStatus.DONE

    def test_cross_camp_child_silently_skipped(self, client, nurse, session, vaccine):
        """Child from another camp must be ignored — security / IDOR fix."""
        other_camp = CampFactory(name='OtherCamp')
        other_child = ChildFactory(camp=other_camp)
        record = VaccinationRecordFactory(
            child=other_child, vaccine=vaccine, status=DoseStatus.SCHEDULED
        )
        client.force_authenticate(user=nurse)
        resp = client.post(
            reverse('clinic-session-record-attendance', kwargs={'pk': session.id}),
            {'attendances': [{'child': str(other_child.id), 'status': 'DONE'}]},
            format='json',
        )
        assert resp.status_code == 200
        # The record must NOT have been marked done
        record.refresh_from_db()
        assert record.status == DoseStatus.SCHEDULED


# ── Remove attendee ───────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRemoveAttendee:
    def test_revert_attendance_reverts_vax_record(self, client, nurse, session, child, vaccine):
        # Set up an attendance + done vaccination record
        vax_record = VaccinationRecordFactory(
            child=child, vaccine=vaccine, status=DoseStatus.DONE
        )
        ClinicSessionAttendance.objects.create(
            session=session, child=child,
            status='DONE', vaccination_record=vax_record,
        )
        client.force_authenticate(user=nurse)
        # DELETE /vaccinations/clinic-sessions/<session_id>/attendees/<child_id>/
        url = reverse('clinic-session-remove-attendee', kwargs={'pk': session.id, 'child_id': str(child.id)})
        resp = client.delete(url)
        assert resp.status_code == 200
        vax_record.refresh_from_db()
        assert vax_record.status == DoseStatus.SCHEDULED


# ── Close session ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCloseSession:
    def test_nurse_can_close_open_session(self, client, nurse, session):
        client.force_authenticate(user=nurse)
        resp = client.post(
            reverse('clinic-session-close-session', kwargs={'pk': session.id})
        )
        assert resp.status_code == 200
        session.refresh_from_db()
        assert session.status == 'CLOSED'

    def test_cannot_close_already_closed_session(self, client, nurse, session):
        session.status = 'CLOSED'
        session.save()
        client.force_authenticate(user=nurse)
        resp = client.post(
            reverse('clinic-session-close-session', kwargs={'pk': session.id})
        )
        assert resp.status_code in (400, 409)
