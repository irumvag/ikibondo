"""
Close-case workflow (deceased / transferred / departed).

Verifies the full downstream chain: audit record, is_active flip, scheduled
vaccinations cancelled, open visit requests withdrawn, and lead notifications
delivered to CHW + camp supervisors.
"""
from datetime import date, timedelta

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import UserRole
from apps.accounts.tests.factories import (
    AdminUserFactory, NurseFactory, SupervisorFactory, UserFactory,
)
from apps.camps.tests.factories import CampFactory
from apps.children.models import (
    ChildClosure, VisitRequest, VisitRequestStatus, VisitUrgency,
)
from apps.children.tests.factories import ChildFactory, GuardianFactory
from apps.notifications.models import Notification, NotificationType
from apps.vaccinations.models import DoseStatus, VaccinationRecord
from apps.vaccinations.tests.factories import (
    VaccinationRecordFactory, VaccineFactory,
)


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def camp(db):
    return CampFactory()


@pytest.fixture
def nurse(db, camp):
    return NurseFactory(is_approved=True, camp=camp)


@pytest.fixture
def supervisor(db, camp):
    return SupervisorFactory(is_approved=True, camp=camp)


@pytest.fixture
def chw(db, camp):
    return UserFactory(role=UserRole.CHW, is_approved=True, camp=camp)


@pytest.fixture
def guardian(db, camp, chw):
    return GuardianFactory(assigned_chw=chw)


@pytest.fixture
def child(db, camp, guardian):
    return ChildFactory(camp=camp, guardian=guardian, date_of_birth=date(2025, 1, 1))


def _url(child):
    return f'/api/v1/children/{child.id}/close/'


class TestCloseCasePermissions:
    def test_chw_cannot_close(self, client, child, chw):
        client.force_authenticate(chw)
        res = client.post(_url(child), {'status': 'DECEASED', 'reason': 'x'}, format='json')
        assert res.status_code == 403

    def test_parent_cannot_close(self, client, child):
        parent = UserFactory(role=UserRole.PARENT, is_approved=True)
        client.force_authenticate(parent)
        res = client.post(_url(child), {'status': 'DECEASED', 'reason': 'x'}, format='json')
        assert res.status_code == 403

    def test_nurse_can_close(self, client, child, nurse):
        client.force_authenticate(nurse)
        res = client.post(
            _url(child), {'status': 'DEPARTED', 'reason': 'Family relocated'}, format='json',
        )
        assert res.status_code == 200

    def test_supervisor_can_close(self, client, child, supervisor):
        client.force_authenticate(supervisor)
        res = client.post(
            _url(child), {'status': 'TRANSFERRED', 'reason': 'Moved to hospital'}, format='json',
        )
        assert res.status_code == 200


class TestCloseCaseValidation:
    def test_status_required(self, client, child, nurse):
        client.force_authenticate(nurse)
        res = client.post(_url(child), {'reason': 'x'}, format='json')
        assert res.status_code == 400
        assert res.json()['code'] == 'VALIDATION_ERROR'

    def test_reason_required(self, client, child, nurse):
        client.force_authenticate(nurse)
        res = client.post(_url(child), {'status': 'DECEASED'}, format='json')
        assert res.status_code == 400

    def test_status_must_be_allowed(self, client, child, nurse):
        client.force_authenticate(nurse)
        res = client.post(
            _url(child), {'status': 'RANDOM', 'reason': 'x'}, format='json',
        )
        assert res.status_code == 400

    def test_cannot_close_already_closed_case(self, client, child, nurse):
        client.force_authenticate(nurse)
        client.post(_url(child), {'status': 'DECEASED', 'reason': 'x'}, format='json')
        res = client.post(_url(child), {'status': 'TRANSFERRED', 'reason': 'y'}, format='json')
        assert res.status_code == 409
        assert res.json()['code'] == 'ALREADY_CLOSED'


class TestCloseCaseSideEffects:
    def test_creates_closure_audit_record(self, client, child, nurse):
        client.force_authenticate(nurse)
        client.post(
            _url(child),
            {'status': 'DECEASED', 'reason': 'Cause: measles'},
            format='json',
        )
        closure = ChildClosure.objects.get(child=child)
        assert closure.status == 'DECEASED'
        assert closure.reason == 'Cause: measles'
        assert closure.closed_by == nurse

    def test_flips_is_active_and_closure_status(self, client, child, nurse):
        client.force_authenticate(nurse)
        client.post(_url(child), {'status': 'DECEASED', 'reason': 'x'}, format='json')
        child.refresh_from_db()
        assert child.is_active is False
        assert child.closure_status == 'DECEASED'

    def test_hidden_from_child_list_after_close(self, client, child, nurse):
        client.force_authenticate(nurse)
        client.post(_url(child), {'status': 'DECEASED', 'reason': 'x'}, format='json')
        res = client.get('/api/v1/children/')
        body = res.json()
        rows = None
        for candidate in (body.get('data'), body):
            if isinstance(candidate, dict):
                rows = candidate.get('results')
                if rows is not None:
                    break
            if isinstance(candidate, list):
                rows = candidate
                break
        assert rows is not None, f'no results in body: {body}'
        ids = [c['id'] for c in rows]
        assert str(child.id) not in ids

    def test_cancels_scheduled_vaccinations(self, client, child, nurse):
        vax = VaccineFactory()
        scheduled = VaccinationRecordFactory(
            child=child, vaccine=vax, status=DoseStatus.SCHEDULED,
            scheduled_date=date.today() + timedelta(days=7),
        )
        done = VaccinationRecordFactory(
            child=child, vaccine=vax, status=DoseStatus.DONE,
            scheduled_date=date.today() - timedelta(days=30),
        )
        client.force_authenticate(nurse)
        client.post(
            _url(child), {'status': 'DECEASED', 'reason': 'severe pneumonia'},
            format='json',
        )
        scheduled.refresh_from_db()
        done.refresh_from_db()
        assert scheduled.status == DoseStatus.SKIPPED
        assert 'Case closed (DECEASED)' in scheduled.notes
        # Historical DONE doses must NOT be rewritten.
        assert done.status == DoseStatus.DONE

    def test_withdraws_open_visit_requests(self, client, child, nurse):
        pending = VisitRequest.objects.create(
            child=child,
            requested_by=nurse,
            status=VisitRequestStatus.PENDING,
            urgency=VisitUrgency.ROUTINE,
            concern_text='routine',
        )
        accepted = VisitRequest.objects.create(
            child=child,
            requested_by=nurse,
            status=VisitRequestStatus.ACCEPTED,
            urgency=VisitUrgency.ROUTINE,
            concern_text='follow-up',
        )
        completed = VisitRequest.objects.create(
            child=child,
            requested_by=nurse,
            status=VisitRequestStatus.COMPLETED,
            urgency=VisitUrgency.ROUTINE,
            concern_text='done',
        )
        client.force_authenticate(nurse)
        client.post(_url(child), {'status': 'DEPARTED', 'reason': 'moved'}, format='json')
        pending.refresh_from_db(); accepted.refresh_from_db(); completed.refresh_from_db()
        assert pending.status == VisitRequestStatus.WITHDRAWN
        assert accepted.status == VisitRequestStatus.WITHDRAWN
        # Completed history is preserved.
        assert completed.status == VisitRequestStatus.COMPLETED

    def test_notifies_chw_and_supervisor(self, client, child, chw, supervisor, nurse):
        client.force_authenticate(nurse)
        client.post(
            _url(child),
            {'status': 'DECEASED', 'reason': 'Cause: pneumonia'},
            format='json',
        )
        notes = Notification.objects.filter(
            child=child, notification_type=NotificationType.CASE_CLOSED,
        )
        recipient_ids = set(notes.values_list('recipient_id', flat=True))
        assert chw.id in recipient_ids
        assert supervisor.id in recipient_ids
        # The actor is NOT notified.
        assert nurse.id not in recipient_ids
        # Message contains the child name and the reason (truncated).
        assert any('pneumonia' in n.message for n in notes)

    def test_admin_notified_across_all_camps(self, client, child, nurse):
        # Admin has no camp assigned but should still be paged on any closure.
        admin = AdminUserFactory(is_approved=True)
        assert admin.camp_id is None
        client.force_authenticate(nurse)
        client.post(_url(child), {'status': 'DECEASED', 'reason': 'x'}, format='json')
        recipients = set(Notification.objects.filter(
            child=child, notification_type=NotificationType.CASE_CLOSED,
        ).values_list('recipient_id', flat=True))
        assert admin.id in recipients

    def test_supervisor_in_different_camp_not_notified(self, client, child, nurse):
        other_camp = CampFactory()
        other_sup = SupervisorFactory(is_approved=True, camp=other_camp)
        client.force_authenticate(nurse)
        client.post(_url(child), {'status': 'DECEASED', 'reason': 'x'}, format='json')
        recipients = set(Notification.objects.filter(
            child=child, notification_type=NotificationType.CASE_CLOSED,
        ).values_list('recipient_id', flat=True))
        assert other_sup.id not in recipients

    def test_supervisor_actor_does_not_notify_themselves(
        self, client, child, chw, supervisor,
    ):
        client.force_authenticate(supervisor)
        client.post(_url(child), {'status': 'TRANSFERRED', 'reason': 'x'}, format='json')
        recipients = set(Notification.objects.filter(
            child=child, notification_type=NotificationType.CASE_CLOSED,
        ).values_list('recipient_id', flat=True))
        assert chw.id in recipients
        assert supervisor.id not in recipients


class TestClosedCasesReport:
    def test_lists_closures_scoped_to_camp_for_nurse(self, client, camp, nurse):
        camp_b = CampFactory()
        # Case in nurse's camp
        c1 = ChildFactory(camp=camp)
        ChildClosure.objects.create(
            child=c1, status='DECEASED', reason='illness', closed_by=nurse,
        )
        # Case in a different camp
        c2 = ChildFactory(camp=camp_b)
        ChildClosure.objects.create(
            child=c2, status='DECEASED', reason='x', closed_by=nurse,
        )
        client.force_authenticate(nurse)
        res = client.get('/api/v1/children/closed/')
        assert res.status_code == 200
        ids = [row['child_id'] for row in res.json()['data']]
        assert str(c1.id) in ids
        assert str(c2.id) not in ids

    def test_supervisor_sees_all_camps(self, client, camp):
        admin_camp = CampFactory()
        admin = AdminUserFactory(is_approved=True)
        supervisor = SupervisorFactory(is_approved=True, camp=admin_camp)
        c1 = ChildFactory(camp=camp)
        c2 = ChildFactory(camp=admin_camp)
        ChildClosure.objects.create(child=c1, status='DECEASED', reason='x', closed_by=admin)
        ChildClosure.objects.create(child=c2, status='DEPARTED', reason='x', closed_by=admin)
        client.force_authenticate(supervisor)
        res = client.get('/api/v1/children/closed/')
        assert res.status_code == 200
        ids = [row['child_id'] for row in res.json()['data']]
        assert {str(c1.id), str(c2.id)} <= set(ids)

    def test_filter_by_status(self, client, camp, nurse):
        c1 = ChildFactory(camp=camp)
        c2 = ChildFactory(camp=camp)
        ChildClosure.objects.create(child=c1, status='DECEASED', reason='x', closed_by=nurse)
        ChildClosure.objects.create(child=c2, status='DEPARTED', reason='x', closed_by=nurse)
        client.force_authenticate(nurse)
        res = client.get('/api/v1/children/closed/?status=DECEASED')
        ids = [row['child_id'] for row in res.json()['data']]
        assert str(c1.id) in ids
        assert str(c2.id) not in ids

    def test_chw_forbidden(self, client, chw):
        client.force_authenticate(chw)
        res = client.get('/api/v1/children/closed/')
        assert res.status_code == 403
