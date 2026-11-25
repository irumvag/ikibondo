"""
Phase 14 tests:
  - Parent-only self-registration
  - Supervisor creates CHW/NURSE (own camp only)
  - Admin creates any role
  - must_change_password lifecycle
  - Email outbox assertions
"""
import pytest
from django.urls import reverse
from django.core import mail
from rest_framework.test import APIClient
from apps.accounts.models import CustomUser, UserRole
from apps.accounts.tests.factories import (
    UserFactory, SupervisorFactory, AdminUserFactory,
)
from apps.camps.tests.factories import CampFactory


# ── Fixtures ───────────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def camp(db):
    return CampFactory(name='Mahama', district='Kirehe')


@pytest.fixture
def other_camp(db):
    return CampFactory(name='Kiziba', district='Karongi')


@pytest.fixture
def supervisor(db, camp):
    return SupervisorFactory(email='super@test.rw', password='testpass1234', camp=camp, is_approved=True)


@pytest.fixture
def admin(db):
    return AdminUserFactory(email='admin@test.rw', password='testpass1234', is_approved=True)


# ── 1. Parent-only self-registration ──────────────────────────────────────────

@pytest.mark.django_db
class TestRegisterParentOnly:
    def test_default_registration_becomes_parent(self, client, camp):
        resp = client.post(reverse('auth-register'), {
            'email': 'parent1@test.rw', 'full_name': 'Alice',
            'password': 'TestPass123', 'camp': str(camp.pk),
        })
        assert resp.status_code == 201
        user = CustomUser.objects.get(email='parent1@test.rw')
        assert user.role == UserRole.PARENT
        assert user.is_approved is False

    def test_explicit_parent_role_succeeds(self, client, camp):
        resp = client.post(reverse('auth-register'), {
            'email': 'parent2@test.rw', 'full_name': 'Bob',
            'password': 'TestPass123', 'role': 'PARENT', 'camp': str(camp.pk),
        })
        assert resp.status_code == 201
        user = CustomUser.objects.get(email='parent2@test.rw')
        assert user.role == UserRole.PARENT

    def test_non_parent_role_is_rejected(self, client, camp):
        resp = client.post(reverse('auth-register'), {
            'email': 'chw@test.rw', 'full_name': 'Eve',
            'password': 'TestPass123', 'role': 'CHW', 'camp': str(camp.pk),
        })
        assert resp.status_code == 403

    def test_registration_sends_pending_email(self, client, camp):
        mail.outbox.clear()
        client.post(reverse('auth-register'), {
            'email': 'parent3@test.rw', 'full_name': 'Carol',
            'password': 'TestPass123', 'camp': str(camp.pk),
        })
        # The email task runs synchronously in test (CELERY_TASK_ALWAYS_EAGER or inline)
        # With Django's locmem backend, send_email_task runs inline in test mode
        emails_to_parent = [m for m in mail.outbox if 'parent3@test.rw' in m.to]
        assert len(emails_to_parent) >= 1


# ── 2. Supervisor creates CHW / NURSE ─────────────────────────────────────────

@pytest.mark.django_db
class TestSupervisorCreatesStaff:
    def test_supervisor_can_create_chw_in_own_camp(self, client, supervisor, camp):
        client.force_authenticate(user=supervisor)
        resp = client.post(reverse('auth-create-user'), {
            'email': 'chw1@test.rw', 'full_name': 'David CHW',
            'role': 'CHW', 'camp': str(camp.pk),
        })
        assert resp.status_code == 201
        user = CustomUser.objects.get(email='chw1@test.rw')
        assert user.role == UserRole.CHW
        assert user.is_approved is True
        assert user.must_change_password is True

    def test_supervisor_can_create_nurse_in_own_camp(self, client, supervisor, camp):
        client.force_authenticate(user=supervisor)
        resp = client.post(reverse('auth-create-user'), {
            'email': 'nurse1@test.rw', 'full_name': 'Nurse Emma',
            'role': 'NURSE', 'camp': str(camp.pk),
        })
        assert resp.status_code == 201

    def test_supervisor_cannot_create_chw_in_other_camp(self, client, supervisor, other_camp):
        client.force_authenticate(user=supervisor)
        resp = client.post(reverse('auth-create-user'), {
            'email': 'chw2@test.rw', 'full_name': 'Other CHW',
            'role': 'CHW', 'camp': str(other_camp.pk),
        })
        assert resp.status_code == 403

    def test_supervisor_cannot_create_supervisor(self, client, supervisor, camp):
        client.force_authenticate(user=supervisor)
        resp = client.post(reverse('auth-create-user'), {
            'email': 'sup2@test.rw', 'full_name': 'New Supervisor',
            'role': 'SUPERVISOR', 'camp': str(camp.pk),
        })
        assert resp.status_code == 403

    def test_supervisor_cannot_create_admin(self, client, supervisor, camp):
        client.force_authenticate(user=supervisor)
        resp = client.post(reverse('auth-create-user'), {
            'email': 'adm2@test.rw', 'full_name': 'New Admin',
            'role': 'ADMIN', 'camp': str(camp.pk),
        })
        assert resp.status_code == 403

    def test_auto_generates_password_when_blank(self, client, supervisor, camp):
        client.force_authenticate(user=supervisor)
        resp = client.post(reverse('auth-create-user'), {
            'email': 'chw_nopw@test.rw', 'full_name': 'No PW CHW',
            'role': 'CHW', 'camp': str(camp.pk),
            # No 'password' field
        })
        assert resp.status_code == 201
        # User should still be able to exist (password was auto-generated)
        user = CustomUser.objects.get(email='chw_nopw@test.rw')
        assert user.has_usable_password()


# ── 3. Admin creates any role ──────────────────────────────────────────────────

@pytest.mark.django_db
class TestAdminCreatesAnyRole:
    def _base_payload(self, email, role, camp_pk=None):
        d = {'email': email, 'full_name': 'Test User', 'role': role}
        if camp_pk:
            d['camp'] = str(camp_pk)
        return d

    def test_admin_can_create_chw(self, client, admin, camp):
        client.force_authenticate(user=admin)
        resp = client.post(reverse('auth-create-user'), self._base_payload('a1@test.rw', 'CHW', camp.pk))
        assert resp.status_code == 201

    def test_admin_can_create_nurse(self, client, admin, camp):
        client.force_authenticate(user=admin)
        resp = client.post(reverse('auth-create-user'), self._base_payload('a2@test.rw', 'NURSE', camp.pk))
        assert resp.status_code == 201

    def test_admin_can_create_supervisor(self, client, admin, camp):
        client.force_authenticate(user=admin)
        resp = client.post(reverse('auth-create-user'), self._base_payload('a3@test.rw', 'SUPERVISOR', camp.pk))
        assert resp.status_code == 201

    def test_admin_can_create_another_admin(self, client, admin):
        client.force_authenticate(user=admin)
        resp = client.post(reverse('auth-create-user'), self._base_payload('a4@test.rw', 'ADMIN'))
        assert resp.status_code == 201

    def test_admin_can_create_parent(self, client, admin, camp):
        client.force_authenticate(user=admin)
        resp = client.post(reverse('auth-create-user'), self._base_payload('a5@test.rw', 'PARENT', camp.pk))
        assert resp.status_code == 201

    def test_admin_create_sets_must_change_password(self, client, admin, camp):
        client.force_authenticate(user=admin)
        resp = client.post(reverse('auth-create-user'), {
            'email': 'a6@test.rw', 'full_name': 'Test', 'role': 'CHW', 'camp': str(camp.pk),
        })
        assert resp.status_code == 201
        user = CustomUser.objects.get(email='a6@test.rw')
        assert user.must_change_password is True
        assert user.is_approved is True

    def test_admin_create_auto_generates_password_when_omitted(self, client, admin, camp):
        client.force_authenticate(user=admin)
        resp = client.post(reverse('auth-create-user'), {
            'email': 'a7@test.rw', 'full_name': 'NoPW', 'role': 'CHW', 'camp': str(camp.pk),
        })
        assert resp.status_code == 201
        user = CustomUser.objects.get(email='a7@test.rw')
        assert user.has_usable_password()

    def test_admin_create_sends_welcome_email(self, client, admin, camp):
        mail.outbox.clear()
        client.force_authenticate(user=admin)
        client.post(reverse('auth-create-user'), {
            'email': 'emailtest@test.rw', 'full_name': 'Email Test',
            'role': 'CHW', 'camp': str(camp.pk),
        })
        emails = [m for m in mail.outbox if 'emailtest@test.rw' in m.to]
        assert len(emails) >= 1


# ── 4. must_change_password lifecycle ─────────────────────────────────────────

@pytest.mark.django_db
class TestMustChangePasswordFlow:
    def test_newly_created_staff_has_flag_true(self, client, admin, camp):
        client.force_authenticate(user=admin)
        client.post(reverse('auth-create-user'), {
            'email': 'mcp1@test.rw', 'full_name': 'MCP User',
            'role': 'CHW', 'camp': str(camp.pk),
        })
        user = CustomUser.objects.get(email='mcp1@test.rw')
        assert user.must_change_password is True

    def test_me_endpoint_exposes_flag(self, client, admin, camp):
        client.force_authenticate(user=admin)
        client.post(reverse('auth-create-user'), {
            'email': 'mcp2@test.rw', 'full_name': 'MCP2',
            'role': 'CHW', 'camp': str(camp.pk),
        })
        user = CustomUser.objects.get(email='mcp2@test.rw')
        client.force_authenticate(user=user)
        resp = client.get(reverse('auth-me'))
        assert resp.status_code == 200
        assert resp.data['data']['must_change_password'] is True

    def test_change_password_clears_flag(self, db, client):
        user = UserFactory(email='mcp3@test.rw', password='OldPass123', is_approved=True)
        user.must_change_password = True
        user.save(update_fields=['must_change_password'])
        client.force_authenticate(user=user)
        resp = client.post(reverse('auth-change-password'), {
            'old_password': 'OldPass123',
            'new_password': 'NewPass456',
        })
        assert resp.status_code == 200
        user.refresh_from_db()
        assert user.must_change_password is False

    def test_regular_user_created_by_factory_has_flag_false(self, db):
        user = UserFactory(email='regular@test.rw', password='Pass1234')
        assert user.must_change_password is False


# ── 5. Email outbox ────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestEmailOutbox:
    def test_approval_sends_email_to_user(self, client, supervisor, camp):
        user = UserFactory(
            email='tobeapproved@test.rw', password='pass1234',
            role=UserRole.PARENT, camp=camp, is_approved=False, is_active=True,
        )
        mail.outbox.clear()
        client.force_authenticate(user=supervisor)
        resp = client.patch(reverse('auth-approve-user', kwargs={'user_id': user.id}))
        assert resp.status_code == 200
        emails = [m for m in mail.outbox if 'tobeapproved@test.rw' in m.to]
        assert len(emails) >= 1

    def test_welcome_email_contains_credentials(self, client, admin, camp):
        mail.outbox.clear()
        client.force_authenticate(user=admin)
        client.post(reverse('auth-create-user'), {
            'email': 'cred_test@test.rw', 'full_name': 'Cred Test',
            'role': 'CHW', 'camp': str(camp.pk),
        })
        emails = [m for m in mail.outbox if 'cred_test@test.rw' in m.to]
        assert len(emails) >= 1
        # Body should mention the email address
        assert 'cred_test@test.rw' in emails[0].body
