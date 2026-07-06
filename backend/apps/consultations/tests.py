"""
Tests for the Consultations app — Sprint 8.

Covers:
  POST   /api/v1/consultations/              create consultation
  GET    /api/v1/consultations/              list (scoped by role)
  POST   /api/v1/consultations/<id>/reply/   add message
  POST   /api/v1/consultations/<id>/resolve/ close consultation
  POST   /api/v1/consultations/<id>/dispute/ supervisor escalation
"""
import pytest
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory, NurseFactory, SupervisorFactory
from apps.accounts.models import UserRole
from apps.camps.tests.factories import CampFactory
from apps.children.tests.factories import ChildFactory
from apps.consultations.models import Consultation, ConsultationMessage, ConsultationStatus


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
def supervisor(db, camp):
    return SupervisorFactory(camp=camp)


@pytest.fixture
def child(db, camp):
    return ChildFactory(camp=camp)


@pytest.fixture
def consultation(db, chw, child):
    return Consultation.objects.create(child=child, opened_by=chw)


LIST_URL    = '/api/v1/consultations/'
REPLY_URL   = lambda pk: f'/api/v1/consultations/{pk}/reply/'
RESOLVE_URL = lambda pk: f'/api/v1/consultations/{pk}/resolve/'
DISPUTE_URL = lambda pk: f'/api/v1/consultations/{pk}/dispute/'


# ── TestConsultationAuth ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestConsultationAuth:
    def test_requires_auth(self, client, child):
        res = client.post(LIST_URL, {'child': str(child.id)})
        assert res.status_code == 401

    def test_parent_cannot_create(self, client, child):
        parent = UserFactory(role=UserRole.PARENT)
        client.force_authenticate(parent)
        res = client.post(LIST_URL, {'child': str(child.id)})
        assert res.status_code == 403

    def test_parent_list_returns_empty(self, client, consultation):
        parent = UserFactory(role=UserRole.PARENT)
        client.force_authenticate(parent)
        res = client.get(LIST_URL)
        assert res.status_code == 200
        body = res.json()
        items = body.get('data') or body.get('results') or []
        assert items == []


# ── TestConsultationCreate ────────────────────────────────────────────────────

@pytest.mark.django_db
class TestConsultationCreate:
    def test_chw_can_open_consultation(self, client, chw, child):
        client.force_authenticate(chw)
        res = client.post(LIST_URL, {'child': str(child.id)}, format='json')
        assert res.status_code == 201
        assert res.json()['data']['status'] == ConsultationStatus.OPEN

    def test_nurse_can_open_consultation(self, client, nurse, child):
        client.force_authenticate(nurse)
        res = client.post(LIST_URL, {'child': str(child.id)}, format='json')
        assert res.status_code == 201

    def test_opened_by_set_to_request_user(self, client, chw, child):
        client.force_authenticate(chw)
        res = client.post(LIST_URL, {'child': str(child.id)}, format='json')
        assert res.status_code == 201
        obj = Consultation.objects.get(id=res.json()['data']['id'])
        assert obj.opened_by == chw


# ── TestConsultationScoping ───────────────────────────────────────────────────

@pytest.mark.django_db
class TestConsultationScoping:
    def _items(self, res):
        body = res.json()
        return body.get('data') or body.get('results') or []

    def test_chw_sees_only_own(self, client, chw, child, camp):
        Consultation.objects.create(child=child, opened_by=chw)
        other_chw = UserFactory(role=UserRole.CHW, camp=camp)
        Consultation.objects.create(child=child, opened_by=other_chw)
        client.force_authenticate(chw)
        res = client.get(LIST_URL)
        opener_ids = [c['opened_by'] for c in self._items(res)]
        assert all(i == str(chw.id) for i in opener_ids)

    def test_nurse_sees_camp_consultations(self, client, nurse, consultation):
        client.force_authenticate(nurse)
        res = client.get(LIST_URL)
        assert res.status_code == 200
        assert len(self._items(res)) >= 1

    def test_nurse_different_camp_sees_nothing(self, client, consultation):
        other_camp  = CampFactory()
        other_nurse = NurseFactory(camp=other_camp)
        client.force_authenticate(other_nurse)
        res = client.get(LIST_URL)
        assert self._items(res) == []


# ── TestConsultationReply ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestConsultationReply:
    def test_nurse_can_reply(self, client, nurse, consultation):
        client.force_authenticate(nurse)
        res = client.post(REPLY_URL(consultation.id), {'body': 'Administer ORS.'}, format='json')
        assert res.status_code == 201
        assert res.json()['data']['body'] == 'Administer ORS.'

    def test_chw_can_reply_own(self, client, chw, consultation):
        client.force_authenticate(chw)
        res = client.post(REPLY_URL(consultation.id), {'body': 'Understood.'}, format='json')
        assert res.status_code == 201

    def test_author_set_from_request(self, client, nurse, consultation):
        client.force_authenticate(nurse)
        res = client.post(REPLY_URL(consultation.id), {'body': 'Reply text'}, format='json')
        msg = ConsultationMessage.objects.get(id=res.json()['data']['id'])
        assert msg.author == nurse

    def test_reply_on_resolved_returns_400(self, client, nurse, consultation):
        consultation.status = ConsultationStatus.RESOLVED
        consultation.save()
        client.force_authenticate(nurse)
        res = client.post(REPLY_URL(consultation.id), {'body': 'Late reply'}, format='json')
        assert res.status_code == 400


# ── TestConsultationResolve ───────────────────────────────────────────────────

@pytest.mark.django_db
class TestConsultationResolve:
    def test_resolve_sets_status(self, client, nurse, consultation):
        client.force_authenticate(nurse)
        res = client.post(RESOLVE_URL(consultation.id), {}, format='json')
        assert res.status_code == 200
        consultation.refresh_from_db()
        assert consultation.status == ConsultationStatus.RESOLVED

    def test_resolve_with_rating(self, client, chw, consultation):
        client.force_authenticate(chw)
        res = client.post(RESOLVE_URL(consultation.id), {'helpful_rating': 5}, format='json')
        assert res.status_code == 200
        consultation.refresh_from_db()
        assert consultation.helpful_rating == 5

    def test_double_resolve_returns_400(self, client, nurse, consultation):
        consultation.status = ConsultationStatus.RESOLVED
        consultation.save()
        client.force_authenticate(nurse)
        res = client.post(RESOLVE_URL(consultation.id), {}, format='json')
        assert res.status_code == 400


# ── TestConsultationDispute ───────────────────────────────────────────────────

@pytest.mark.django_db
class TestConsultationDispute:
    def test_supervisor_can_dispute(self, client, supervisor, consultation):
        client.force_authenticate(supervisor)
        res = client.post(DISPUTE_URL(consultation.id), {}, format='json')
        assert res.status_code == 200
        consultation.refresh_from_db()
        assert consultation.disputed_classification is True
        assert consultation.status == ConsultationStatus.ESCALATED

    def test_chw_cannot_dispute(self, client, chw, consultation):
        client.force_authenticate(chw)
        res = client.post(DISPUTE_URL(consultation.id), {}, format='json')
        assert res.status_code == 403
