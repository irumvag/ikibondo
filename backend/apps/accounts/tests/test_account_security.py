"""Regression tests for account hardening: lockout, password strength, session revocation, broadcast scope."""
import pytest
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import UserRole
from apps.camps.tests.factories import CampFactory
from .factories import UserFactory, SupervisorFactory, AdminUserFactory


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def user(db):
    return UserFactory(email='lock@test.rw', password='Correct-horse-42', is_approved=True)


def _login(client, password, email='lock@test.rw'):
    return client.post(reverse('auth-login'), {'email': email, 'password': password})


@pytest.mark.django_db
class TestLoginLockout:
    def test_locks_after_five_failures(self, client, user):
        for _ in range(5):
            assert _login(client, 'wrong-password').status_code == 401
        # Even the right password is refused while locked
        resp = _login(client, 'Correct-horse-42')
        assert resp.status_code == 429

    def test_success_resets_counter(self, client, user):
        for _ in range(4):
            _login(client, 'wrong-password')
        assert _login(client, 'Correct-horse-42').status_code == 200
        for _ in range(4):
            _login(client, 'wrong-password')
        assert _login(client, 'Correct-horse-42').status_code == 200


@pytest.mark.django_db
class TestPasswordStrength:
    def test_register_rejects_common_password(self, client):
        resp = client.post(reverse('auth-register'), {
            'email': 'weak@test.rw', 'full_name': 'Weak Parent', 'role': 'PARENT',
            'phone_number': '+250788000111', 'password': 'password123',
        })
        assert resp.status_code == 400

    def test_change_password_rejects_numeric_password(self, client, user):
        client.force_authenticate(user=user)
        resp = client.post(reverse('auth-change-password'),
                           {'old_password': 'Correct-horse-42', 'new_password': '1234567890'})
        assert resp.status_code == 400


@pytest.mark.django_db
class TestSessionRevocation:
    def test_password_change_revokes_old_refresh_token(self, client, user):
        old = _login(client, 'Correct-horse-42').data['data']
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {old['access']}")
        resp = client.post(reverse('auth-change-password'),
                           {'old_password': 'Correct-horse-42', 'new_password': 'Fresh-river-77'})
        assert resp.status_code == 200
        fresh = resp.data['data']
        assert fresh['access'] and fresh['refresh']

        client.credentials()
        assert client.post(reverse('auth-refresh'), {'refresh': old['refresh']}).status_code == 401
        assert client.post(reverse('auth-refresh'), {'refresh': fresh['refresh']}).status_code == 200

    def test_suspension_revokes_refresh_token(self, client, user):
        old = _login(client, 'Correct-horse-42').data['data']
        admin = AdminUserFactory(is_approved=True)
        client.force_authenticate(user=admin)
        client.post(reverse('auth-suspend-user', kwargs={'user_id': user.id}), {'action': 'suspend', 'reason': 'test'})
        client.force_authenticate(user=None)
        assert client.post(reverse('auth-refresh'), {'refresh': old['refresh']}).status_code == 401


@pytest.mark.django_db
class TestBroadcastScope:
    def test_supervisor_cannot_broadcast_to_other_camp(self, client):
        own, other = CampFactory(name='Own'), CampFactory(name='Other')
        supervisor = SupervisorFactory(camp=own, is_approved=True)
        client.force_authenticate(user=supervisor)
        resp = client.post('/api/v1/notifications/broadcasts/', {
            'title': 'Hi', 'body': 'Hello', 'scope_type': 'CAMP', 'scope_id': str(other.id),
        }, format='json')
        assert resp.status_code == 403

    def test_role_broadcast_stays_in_supervisors_camp(self, client):
        own, other = CampFactory(name='Own2'), CampFactory(name='Other2')
        supervisor = SupervisorFactory(camp=own, is_approved=True)
        UserFactory(role=UserRole.CHW, camp=own, is_approved=True)
        UserFactory(role=UserRole.CHW, camp=other, is_approved=True)
        client.force_authenticate(user=supervisor)
        resp = client.post('/api/v1/notifications/broadcasts/', {
            'title': 'Hi', 'body': 'Hello', 'scope_type': 'ROLE', 'scope_id': 'CHW',
        }, format='json')
        assert resp.status_code in (200, 201)
        assert '1 recipient' in resp.data['message']
