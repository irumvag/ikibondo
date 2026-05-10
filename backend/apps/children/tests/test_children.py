import pytest
from datetime import date, timedelta
from django.urls import reverse
from rest_framework.test import APIClient
from apps.accounts.tests.factories import UserFactory, NurseFactory
from apps.camps.tests.factories import CampFactory
from .factories import ChildFactory, GuardianFactory


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def chw(db):
    return UserFactory(email='chw@test.rw', password='testpass')


@pytest.fixture
def nurse(db):
    return NurseFactory(email='nurse@test.rw', password='testpass')


@pytest.fixture
def camp(db):
    return CampFactory(name='TestCamp')


@pytest.fixture
def child(db, camp, chw):
    # CHW is assigned to the guardian so they can see the child
    guardian = GuardianFactory(assigned_chw=chw)
    return ChildFactory(camp=camp, registered_by=chw, guardian=guardian)


@pytest.mark.django_db
class TestChildRegistration:
    def test_register_child_creates_vaccination_schedule(self, client, nurse, camp):
        client.force_authenticate(user=nurse)
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

    def test_registration_number_auto_generated(self, client, nurse, camp):
        client.force_authenticate(user=nurse)
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

    def test_chw_cannot_register_child(self, client, chw, camp):
        client.force_authenticate(user=chw)
        resp = client.post(reverse('child-list'), {
            'full_name': 'Blocked Child',
            'date_of_birth': str(date.today() - timedelta(days=30)),
            'sex': 'M',
            'camp': str(camp.id),
            'guardian': {
                'full_name': 'Guardian',
                'phone_number': '+250789999997',
                'relationship': 'father',
            }
        }, format='json')
        assert resp.status_code == 403


@pytest.mark.django_db
class TestChildList:
    def test_list_children(self, client, chw, child):
        client.force_authenticate(user=chw)
        resp = client.get(reverse('child-list'))
        assert resp.status_code == 200
        # CHW sees only children of their assigned guardians
        items = resp.data.get('results') or resp.data.get('data') or []
        assert len(items) >= 1

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


# ── Visit Request Lifecycle ──────────────────────────────────────────────────

@pytest.mark.django_db
class TestVisitRequestLifecycle:
    """Full state machine: PENDING -> ACCEPTED/DECLINED -> COMPLETED; parent can WITHDRAW."""

    @pytest.fixture
    def parent_user(self, db):
        from apps.accounts.models import UserRole
        return UserFactory(email='vr_parent@test.rw', role=UserRole.PARENT)

    @pytest.fixture
    def chw_user(self, db):
        from apps.accounts.models import UserRole
        return UserFactory(email='vr_chw@test.rw', role=UserRole.CHW)

    @pytest.fixture
    def visit_child(self, db, parent_user, chw_user):
        guardian = GuardianFactory(user=parent_user, assigned_chw=chw_user)
        camp = CampFactory(name='VisitCamp')
        return ChildFactory(camp=camp, guardian=guardian)

    def test_parent_can_create_visit_request(self, client, parent_user, visit_child):
        client.force_authenticate(user=parent_user)
        resp = client.post(
            reverse('visit-request-list'),
            {'child': str(visit_child.id), 'urgency': 'ROUTINE', 'concern_text': 'Fever', 'symptom_flags': []},
            format='json',
        )
        assert resp.status_code == 201
        assert resp.data['data']['status'] == 'PENDING'

    def test_chw_accepts_visit_request(self, client, parent_user, chw_user, visit_child):
        from apps.children.models import VisitRequest
        vr = VisitRequest.objects.create(
            child=visit_child, requested_by=parent_user,
            urgency='ROUTINE', concern_text='Cough',
        )
        client.force_authenticate(user=chw_user)
        resp = client.post(reverse('visit-request-accept', kwargs={'pk': vr.id}))
        assert resp.status_code == 200
        vr.refresh_from_db()
        assert vr.status == 'ACCEPTED'

    def test_chw_declines_visit_request(self, client, parent_user, chw_user, visit_child):
        from apps.children.models import VisitRequest
        vr = VisitRequest.objects.create(
            child=visit_child, requested_by=parent_user,
            urgency='ROUTINE', concern_text='Rash',
        )
        client.force_authenticate(user=chw_user)
        resp = client.post(
            reverse('visit-request-decline', kwargs={'pk': vr.id}),
            {'decline_reason': 'Out of zone'},
            format='json',
        )
        assert resp.status_code == 200
        vr.refresh_from_db()
        assert vr.status == 'DECLINED'

    def test_parent_withdraws_pending_request(self, client, parent_user, visit_child):
        from apps.children.models import VisitRequest
        vr = VisitRequest.objects.create(
            child=visit_child, requested_by=parent_user,
            urgency='SOON', concern_text='Weight loss',
        )
        client.force_authenticate(user=parent_user)
        resp = client.post(reverse('visit-request-withdraw', kwargs={'pk': vr.id}))
        assert resp.status_code == 200
        vr.refresh_from_db()
        assert vr.status == 'WITHDRAWN'

    def test_chw_completes_accepted_request(self, client, parent_user, chw_user, visit_child):
        from apps.children.models import VisitRequest
        vr = VisitRequest.objects.create(
            child=visit_child, requested_by=parent_user,
            urgency='URGENT', concern_text='High fever',
            status='ACCEPTED', assigned_chw=chw_user,
        )
        client.force_authenticate(user=chw_user)
        resp = client.post(reverse('visit-request-complete', kwargs={'pk': vr.id}))
        assert resp.status_code == 200
        vr.refresh_from_db()
        assert vr.status == 'COMPLETED'


# ── Family Overview ──────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestFamilyOverview:
    """Guardian family-overview endpoint returns rich family profile."""

    @pytest.fixture
    def supervisor(self, db):
        from apps.accounts.models import UserRole
        return UserFactory(email='sup_ov@test.rw', role=UserRole.SUPERVISOR)

    @pytest.fixture
    def family(self, db):
        guardian = GuardianFactory()
        camp = CampFactory(name='FamCamp')
        ChildFactory(camp=camp, guardian=guardian)
        ChildFactory(camp=camp, guardian=guardian)
        return guardian

    def test_family_overview_returns_children(self, client, supervisor, family):
        client.force_authenticate(user=supervisor)
        resp = client.get(reverse('guardian-family-overview', kwargs={'pk': family.id}))
        assert resp.status_code == 200
        data = resp.data.get('data', resp.data)
        assert 'children' in data

    def test_family_overview_forbidden_for_parent(self, client, family):
        from apps.accounts.models import UserRole
        parent = UserFactory(email='p_ov@test.rw', role=UserRole.PARENT)
        client.force_authenticate(user=parent)
        resp = client.get(reverse('guardian-family-overview', kwargs={'pk': family.id}))
        assert resp.status_code in (403, 404)

    def test_neonatal_fields_on_child(self, client, supervisor, family):
        """Registered children carry birth_weight, gestational_age, feeding_type."""
        from apps.children.models import Child
        child = Child.objects.filter(guardian=family).first()
        child.birth_weight = 3.25
        child.gestational_age = 38
        child.feeding_type = 'BREAST'
        child.save()
        client.force_authenticate(user=supervisor)
        resp = client.get(reverse('child-detail', kwargs={'pk': child.id}))
        assert resp.status_code == 200
        assert str(resp.data['birth_weight']) == '3.25'
        assert resp.data['gestational_age'] == 38
        assert resp.data['feeding_type'] == 'BREAST'
