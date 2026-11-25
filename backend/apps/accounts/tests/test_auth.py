import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from .factories import UserFactory


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def user(db):
    return UserFactory(email='chw@ikibondo.rw', password='testpass123')


@pytest.mark.django_db
class TestLogin:
    def test_login_success(self, client, user):
        resp = client.post(reverse('auth-login'), {'email': 'chw@ikibondo.rw', 'password': 'testpass123'})
        assert resp.status_code == 200
        assert resp.data['success'] is True
        assert 'access' in resp.data['data']
        assert 'refresh' in resp.data['data']
        assert resp.data['data']['user']['email'] == 'chw@ikibondo.rw'

    def test_login_wrong_password(self, client, user):
        resp = client.post(reverse('auth-login'), {'email': 'chw@ikibondo.rw', 'password': 'wrongpass'})
        assert resp.status_code == 401

    def test_login_unknown_email(self, client):
        resp = client.post(reverse('auth-login'), {'email': 'nobody@ikibondo.rw', 'password': 'anything'})
        assert resp.status_code == 401


@pytest.mark.django_db
class TestMeEndpoint:
    def test_me_authenticated(self, client, user):
        client.force_authenticate(user=user)
        resp = client.get(reverse('auth-me'))
        assert resp.status_code == 200
        assert resp.data['data']['email'] == user.email

    def test_me_unauthenticated(self, client):
        resp = client.get(reverse('auth-me'))
        assert resp.status_code == 401


@pytest.mark.django_db
class TestLogout:
    def test_logout_blacklists_token(self, client, user):
        # First login to get tokens
        login_resp = client.post(reverse('auth-login'), {'email': 'chw@ikibondo.rw', 'password': 'testpass123'})
        refresh_token = login_resp.data['data']['refresh']
        access_token = login_resp.data['data']['access']

        client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        logout_resp = client.post(reverse('auth-logout'), {'refresh': refresh_token})
        assert logout_resp.status_code == 200
        assert logout_resp.data['success'] is True


@pytest.mark.django_db
class TestChangePassword:
    def test_correct_old_password_succeeds(self, client, user):
        client.force_authenticate(user=user)
        resp = client.post(reverse('auth-change-password'), {
            'old_password': 'testpass123',
            'new_password': 'newpass456!',
        })
        assert resp.status_code == 200
        assert resp.data['success'] is True
        user.refresh_from_db()
        assert user.check_password('newpass456!')

    def test_wrong_old_password_rejected(self, client, user):
        client.force_authenticate(user=user)
        resp = client.post(reverse('auth-change-password'), {
            'old_password': 'wrongpassword',
            'new_password': 'newpass456!',
        })
        assert resp.status_code == 400

    def test_short_new_password_rejected(self, client, user):
        client.force_authenticate(user=user)
        resp = client.post(reverse('auth-change-password'), {
            'old_password': 'testpass123',
            'new_password': 'short',
        })
        assert resp.status_code == 400

    def test_unauthenticated_rejected(self, client):
        resp = client.post(reverse('auth-change-password'), {
            'old_password': 'anything',
            'new_password': 'newpass456!',
        })
        assert resp.status_code == 401
