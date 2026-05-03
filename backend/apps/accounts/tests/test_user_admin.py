import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from .factories import UserFactory, AdminUserFactory, SupervisorFactory
from apps.camps.tests.factories import CampFactory


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def admin(db):
    return AdminUserFactory(email='admin@ikibondo.rw', password='adminpass123')


@pytest.fixture
def target_user(db):
    return UserFactory(email='nurse@ikibondo.rw', password='nursepass123', full_name='Test Nurse')


# ── PATCH /auth/users/<id>/ ───────────────────────────────────────────────────

@pytest.mark.django_db
class TestManageUserPatch:
    def test_admin_can_update_full_name(self, client, admin, target_user):
        client.force_authenticate(user=admin)
        url = reverse('auth-manage-user', kwargs={'user_id': target_user.pk})
        resp = client.patch(url, {'full_name': 'Updated Name'})
        assert resp.status_code == 200
        assert resp.data['data']['full_name'] == 'Updated Name'

    def test_admin_can_update_role(self, client, admin, target_user):
        client.force_authenticate(user=admin)
        url = reverse('auth-manage-user', kwargs={'user_id': target_user.pk})
        resp = client.patch(url, {'role': 'SUPERVISOR'})
        assert resp.status_code == 200
        target_user.refresh_from_db()
        assert target_user.role == 'SUPERVISOR'

    def test_admin_can_assign_camp(self, client, admin, target_user, db):
        camp = CampFactory()
        client.force_authenticate(user=admin)
        url = reverse('auth-manage-user', kwargs={'user_id': target_user.pk})
        resp = client.patch(url, {'camp': str(camp.pk)})
        assert resp.status_code == 200
        target_user.refresh_from_db()
        assert str(target_user.camp_id) == str(camp.pk)

    def test_admin_can_approve_user(self, client, admin, db):
        unapproved = UserFactory(email='pending@ikibondo.rw', is_approved=False)
        client.force_authenticate(user=admin)
        url = reverse('auth-manage-user', kwargs={'user_id': unapproved.pk})
        resp = client.patch(url, {'is_approved': True})
        assert resp.status_code == 200
        unapproved.refresh_from_db()
        assert unapproved.is_approved is True

    def test_non_admin_cannot_update(self, client, target_user, db):
        supervisor = SupervisorFactory(email='sup@ikibondo.rw', password='pass')
        client.force_authenticate(user=supervisor)
        url = reverse('auth-manage-user', kwargs={'user_id': target_user.pk})
        resp = client.patch(url, {'full_name': 'Hacked'})
        assert resp.status_code == 403

    def test_unauthenticated_rejected(self, client, target_user):
        url = reverse('auth-manage-user', kwargs={'user_id': target_user.pk})
        resp = client.patch(url, {'full_name': 'Hacked'})
        assert resp.status_code == 401

    def test_nonexistent_user_returns_404(self, client, admin):
        import uuid
        client.force_authenticate(user=admin)
        url = reverse('auth-manage-user', kwargs={'user_id': uuid.uuid4()})
        resp = client.patch(url, {'full_name': 'Nobody'})
        assert resp.status_code == 404


# ── DELETE /auth/users/<id>/ ──────────────────────────────────────────────────

@pytest.mark.django_db
class TestManageUserDelete:
    def test_admin_can_deactivate_user(self, client, admin, target_user):
        client.force_authenticate(user=admin)
        url = reverse('auth-manage-user', kwargs={'user_id': target_user.pk})
        resp = client.delete(url)
        assert resp.status_code == 200
        target_user.refresh_from_db()
        assert target_user.is_active is False

    def test_admin_cannot_deactivate_self(self, client, admin):
        client.force_authenticate(user=admin)
        url = reverse('auth-manage-user', kwargs={'user_id': admin.pk})
        resp = client.delete(url)
        assert resp.status_code == 403
        admin.refresh_from_db()
        assert admin.is_active is True

    def test_deactivated_user_no_longer_appears_in_list(self, client, admin, target_user):
        client.force_authenticate(user=admin)
        # Deactivate
        client.delete(reverse('auth-manage-user', kwargs={'user_id': target_user.pk}))
        # List should exclude deactivated user
        list_resp = client.get(reverse('auth-create-user'))
        assert list_resp.status_code == 200
        emails = [u['email'] for u in list_resp.data['data']]
        assert target_user.email not in emails

    def test_non_admin_cannot_deactivate(self, client, target_user, db):
        supervisor = SupervisorFactory(email='sup@ikibondo.rw', password='pass')
        client.force_authenticate(user=supervisor)
        url = reverse('auth-manage-user', kwargs={'user_id': target_user.pk})
        resp = client.delete(url)
        assert resp.status_code == 403
        target_user.refresh_from_db()
        assert target_user.is_active is True
