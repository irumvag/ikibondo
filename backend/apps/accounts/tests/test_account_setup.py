from urllib.parse import parse_qs, urlparse

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts import account_setup
from apps.accounts.models import CustomUser, UserRole
from apps.camps.tests.factories import CampFactory
from .factories import NurseFactory, UserFactory

CREATE = '/api/v1/auth/users/'
SET_PASSWORD = 'auth-set-password'


@pytest.fixture
def nurse(db):
    return NurseFactory(is_approved=True, camp=CampFactory())


@pytest.fixture
def no_providers(monkeypatch):
    """No SMS provider and no email address: nothing can be delivered."""
    monkeypatch.setattr('apps.notifications.sms.send_sms_text', lambda phone, text: False)


def _create_parent(nurse, **extra):
    client = APIClient()
    client.force_authenticate(nurse)
    body = {'full_name': 'Uwase Marie', 'role': 'PARENT', 'phone_number': '+250788111222',
            'email': '', **extra}
    return client.post(CREATE, body, format='json')


def _link_parts(link):
    q = parse_qs(urlparse(link).query)
    return q['uid'][0], q['token'][0]


@pytest.mark.django_db
class TestNurseCreatedParent:
    def test_nurse_never_receives_a_password(self, nurse, no_providers):
        res = _create_parent(nurse, password='Nurse-picked-99')
        assert res.status_code == 201
        data = res.json()['data']
        assert 'temp_password' not in data
        user = CustomUser.objects.get(id=data['id'])
        # Even a password the nurse typed is ignored
        assert not user.has_usable_password()
        assert user.check_password('Nurse-picked-99') is False

    def test_link_returned_only_when_nothing_was_delivered(self, nurse, no_providers):
        data = _create_parent(nurse).json()['data']
        assert data['setup_delivery'] == {'sms': False, 'email': False}
        assert '/set-password?uid=' in data['setup_link']

    def test_link_not_returned_when_sms_went_out(self, nurse, monkeypatch):
        monkeypatch.setattr('apps.notifications.sms.send_sms_text', lambda phone, text: True)
        data = _create_parent(nurse).json()['data']
        assert data['setup_delivery']['sms'] is True
        assert 'setup_link' not in data


@pytest.mark.django_db
class TestSetPassword:
    def _parent(self):
        user = UserFactory(role=UserRole.PARENT, is_approved=True)
        user.set_unusable_password()
        user.save()
        return user

    def test_link_sets_password_once(self):
        user = self._parent()
        uid, token = _link_parts(account_setup.setup_link(user))
        res = APIClient().post(reverse(SET_PASSWORD), {'uid': uid, 'token': token, 'new_password': 'Banana-river-73'})
        assert res.status_code == 200
        user.refresh_from_db()
        assert user.check_password('Banana-river-73')
        # Reusing the same link fails
        res = APIClient().post(reverse(SET_PASSWORD), {'uid': uid, 'token': token, 'new_password': 'Other-river-74'})
        assert res.status_code == 400

    def test_weak_password_keeps_link_valid(self):
        user = self._parent()
        uid, token = _link_parts(account_setup.setup_link(user))
        res = APIClient().post(reverse(SET_PASSWORD), {'uid': uid, 'token': token, 'new_password': '12345678'})
        assert res.status_code == 400
        res = APIClient().post(reverse(SET_PASSWORD), {'uid': uid, 'token': token, 'new_password': 'Banana-river-73'})
        assert res.status_code == 200

    def test_tampered_token_rejected(self):
        user = self._parent()
        uid, _ = _link_parts(account_setup.setup_link(user))
        res = APIClient().post(reverse(SET_PASSWORD), {'uid': uid, 'token': 'abc-123', 'new_password': 'Banana-river-73'})
        assert res.status_code == 400
        user.refresh_from_db()
        assert not user.has_usable_password()


@pytest.mark.django_db
class TestResendSetupLink:
    def _url(self, user):
        return reverse('auth-resend-setup-link', args=[user.id])

    def test_nurse_resends_for_parent_in_own_camp(self, nurse, no_providers):
        parent = CustomUser.objects.get(id=_create_parent(nurse).json()['data']['id'])
        client = APIClient()
        client.force_authenticate(nurse)
        res = client.post(self._url(parent))
        assert res.status_code == 200
        assert 'setup_link' in res.json()['data']

    def test_other_camp_is_hidden(self, nurse, no_providers):
        parent = CustomUser.objects.get(id=_create_parent(nurse).json()['data']['id'])
        other = NurseFactory(is_approved=True, camp=CampFactory())
        client = APIClient()
        client.force_authenticate(other)
        assert client.post(self._url(parent)).status_code == 404

    def test_refused_once_password_is_set(self, nurse, no_providers):
        parent = CustomUser.objects.get(id=_create_parent(nurse).json()['data']['id'])
        parent.set_password('Banana-river-73')
        parent.save()
        client = APIClient()
        client.force_authenticate(nurse)
        assert client.post(self._url(parent)).status_code == 409


@pytest.mark.django_db
def test_parent_without_email_gets_hidden_placeholder(nurse, no_providers):
    data = _create_parent(nurse).json()['data']
    assert data['email'] == ''
    assert data['password_set'] is False
    user = CustomUser.objects.get(id=data['id'])
    assert user.email.endswith('@' + account_setup.PLACEHOLDER_EMAIL_DOMAIN)
