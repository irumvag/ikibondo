"""
Tests for the Referrals app — Sprint 8.

Covers:
  POST   /api/v1/referrals/              create referral
  GET    /api/v1/referrals/              list (scoped by role)
  PATCH  /api/v1/referrals/<id>/        update status/notes
  POST   /api/v1/referrals/<id>/complete/ mark completed
  GET    /api/v1/children/<id>/referrals/ referral history on child profile
"""
import pytest
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory, NurseFactory, SupervisorFactory
from apps.accounts.models import UserRole
from apps.camps.tests.factories import CampFactory
from apps.children.tests.factories import ChildFactory, GuardianFactory
from apps.referrals.models import Referral, ReferralStatus, ReferralUrgency


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
def referral(db, chw, child):
    return Referral.objects.create(
        child=child,
        referring_user=chw,
        target_facility='Kigali Teaching Hospital',
        urgency=ReferralUrgency.ROUTINE,
        reason='Malnutrition follow-up',
    )


LIST_URL      = '/api/v1/referrals/'
DETAIL_URL    = lambda pk: f'/api/v1/referrals/{pk}/'
COMPLETE_URL  = lambda pk: f'/api/v1/referrals/{pk}/complete/'
CHILD_REF_URL = lambda pk: f'/api/v1/children/{pk}/referrals/'


# ── TestReferralAuth ──────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestReferralAuth:
    def test_requires_auth(self, client, child):
        res = client.post(LIST_URL, {'child': str(child.id), 'target_facility': 'X', 'reason': 'Y'})
        assert res.status_code == 401

    def test_parent_cannot_create(self, client, child):
        parent = UserFactory(role=UserRole.PARENT)
        client.force_authenticate(parent)
        res = client.post(LIST_URL, {'child': str(child.id), 'target_facility': 'X', 'reason': 'Y'})
        assert res.status_code == 403


# ── TestReferralCreate ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestReferralCreate:
    def _payload(self, child, urgency='ROUTINE'):
        return {
            'child': str(child.id),
            'target_facility': 'CHUK',
            'urgency': urgency,
            'reason': 'Severe malnutrition',
            'clinical_notes': 'MUAC < 11.5 cm',
        }

    def test_chw_can_create(self, client, chw, child):
        client.force_authenticate(chw)
        res = client.post(LIST_URL, self._payload(child), format='json')
        assert res.status_code == 201
        assert res.json()['data']['status'] == ReferralStatus.PENDING

    def test_nurse_can_create(self, client, nurse, child):
        client.force_authenticate(nurse)
        res = client.post(LIST_URL, self._payload(child), format='json')
        assert res.status_code == 201

    def test_urgency_stored(self, client, chw, child):
        client.force_authenticate(chw)
        res = client.post(LIST_URL, self._payload(child, urgency='URGENT'), format='json')
        assert res.status_code == 201
        assert res.json()['data']['urgency'] == 'URGENT'

    def test_clinical_notes_stored(self, client, chw, child):
        client.force_authenticate(chw)
        res = client.post(LIST_URL, self._payload(child), format='json')
        assert res.json()['data']['clinical_notes'] == 'MUAC < 11.5 cm'

    def test_referring_user_set_from_request(self, client, chw, child):
        client.force_authenticate(chw)
        res = client.post(LIST_URL, self._payload(child), format='json')
        obj = Referral.objects.get(id=res.json()['data']['id'])
        assert obj.referring_user == chw


# ── TestReferralScoping ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestReferralScoping:
    def _items(self, res):
        body = res.json()
        return body.get('data') or body.get('results') or []

    def test_chw_sees_only_own(self, client, chw, referral, camp, child):
        other_chw = UserFactory(role=UserRole.CHW, camp=camp)
        Referral.objects.create(child=child, referring_user=other_chw, target_facility='X', reason='Y')
        client.force_authenticate(chw)
        res = client.get(LIST_URL)
        refs = self._items(res)
        assert all(r['referring_user'] == str(chw.id) for r in refs)

    def test_nurse_sees_camp_referrals(self, client, nurse, referral):
        client.force_authenticate(nurse)
        res = client.get(LIST_URL)
        assert len(self._items(res)) >= 1

    def test_nurse_different_camp_sees_nothing(self, client, referral):
        other_nurse = NurseFactory(camp=CampFactory())
        client.force_authenticate(other_nurse)
        res = client.get(LIST_URL)
        assert self._items(res) == []

    def test_parent_sees_own_childs_referrals(self, client, child, referral):
        guardian = GuardianFactory()
        child.guardian = guardian
        child.save()
        parent = UserFactory(role=UserRole.PARENT)
        guardian.user = parent
        guardian.save()
        client.force_authenticate(parent)
        res = client.get(LIST_URL)
        ids = [r['id'] for r in self._items(res)]
        assert str(referral.id) in ids


# ── TestReferralComplete ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestReferralComplete:
    def test_nurse_can_complete(self, client, nurse, referral):
        client.force_authenticate(nurse)
        res = client.post(COMPLETE_URL(referral.id), {'outcome': 'Treated and discharged'}, format='json')
        assert res.status_code == 200
        referral.refresh_from_db()
        assert referral.status == ReferralStatus.COMPLETED
        assert referral.outcome == 'Treated and discharged'
        assert referral.completed_at is not None

    def test_double_complete_returns_400(self, client, nurse, referral):
        referral.status = ReferralStatus.COMPLETED
        referral.save()
        client.force_authenticate(nurse)
        res = client.post(COMPLETE_URL(referral.id), {'outcome': 'Done'}, format='json')
        assert res.status_code == 400


# ── TestReferralPatch ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestReferralPatch:
    def test_nurse_can_update_status(self, client, nurse, referral):
        client.force_authenticate(nurse)
        res = client.patch(DETAIL_URL(referral.id), {'status': 'ACCEPTED'}, format='json')
        assert res.status_code == 200
        referral.refresh_from_db()
        assert referral.status == ReferralStatus.ACCEPTED


# ── TestChildReferralHistory ──────────────────────────────────────────────────

@pytest.mark.django_db
class TestChildReferralHistory:
    def test_nurse_can_see_child_referral_history(self, client, nurse, child, referral):
        client.force_authenticate(nurse)
        res = client.get(CHILD_REF_URL(child.id))
        assert res.status_code == 200
        ids = [r['id'] for r in res.json()['data']]
        assert str(referral.id) in ids

    def test_empty_history_returns_empty_list(self, client, nurse, child):
        client.force_authenticate(nurse)
        res = client.get(CHILD_REF_URL(child.id))
        assert res.status_code == 200
        assert res.json()['data'] == []

    def test_chw_cannot_see_other_childs_referrals(self, client, camp, referral):
        # CHW with no assigned children cannot access child detail → 403/404
        other_chw = UserFactory(role=UserRole.CHW, camp=camp)
        client.force_authenticate(other_chw)
        res = client.get(CHILD_REF_URL(referral.child.id))
        assert res.status_code in (403, 404)

    def test_referral_includes_urgency_and_clinical_notes(self, client, nurse, child):
        Referral.objects.create(
            child=child,
            referring_user=nurse,
            target_facility='CHUK',
            urgency=ReferralUrgency.URGENT,
            reason='SAM',
            clinical_notes='MUAC 10 cm',
        )
        client.force_authenticate(nurse)
        res = client.get(CHILD_REF_URL(child.id))
        item = res.json()['data'][0]
        assert item['urgency'] == 'URGENT'
        assert item['clinical_notes'] == 'MUAC 10 cm'
