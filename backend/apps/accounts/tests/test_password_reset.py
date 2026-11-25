import pytest
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts import password_reset
from apps.accounts.models import PasswordResetCode
from .factories import UserFactory

REQUEST = 'auth-password-reset-request'
CONFIRM = 'auth-password-reset-confirm'


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def sent(monkeypatch):
    """Capture codes instead of emailing/texting them."""
    box = []
    monkeypatch.setattr(password_reset, '_deliver', lambda user, code: box.append(code))
    return box


@pytest.fixture
def user(db):
    return UserFactory(email='reset@test.rw', password='Old-garden-31', is_approved=True)


def _request(identifier):
    return APIClient().post(reverse(REQUEST), {'identifier': identifier})


def _confirm(identifier, code, new_password='New-orchard-58'):
    return APIClient().post(reverse(CONFIRM), {'identifier': identifier, 'code': code, 'new_password': new_password})


@pytest.mark.django_db
class TestPasswordReset:
    def test_full_flow_sets_new_password(self, user, sent):
        assert _request('reset@test.rw').status_code == 200
        assert len(sent) == 1
        assert _confirm('reset@test.rw', sent[0]).status_code == 200
        user.refresh_from_db()
        assert user.check_password('New-orchard-58')

    def test_unknown_account_gets_identical_reply(self, db, sent):
        known = UserFactory(email='k@test.rw', is_approved=True)
        a = _request(known.email)
        b = _request('nobody@test.rw')
        assert a.status_code == b.status_code == 200
        assert a.data['message'] == b.data['message']
        assert len(sent) == 1  # only the real account received a code

    def test_code_is_stored_hashed(self, user, sent):
        _request('reset@test.rw')
        entry = PasswordResetCode.objects.get(user=user)
        assert sent[0] not in entry.code_hash

    def test_wrong_code_rejected_and_locks_after_max_attempts(self, user, sent):
        _request('reset@test.rw')
        for _ in range(PasswordResetCode.MAX_ATTEMPTS):
            assert _confirm('reset@test.rw', '000000' if sent[0] != '000000' else '111111').status_code == 400
        # Even the right code no longer works once attempts are exhausted
        assert _confirm('reset@test.rw', sent[0]).status_code == 400

    def test_code_is_single_use(self, user, sent):
        _request('reset@test.rw')
        assert _confirm('reset@test.rw', sent[0]).status_code == 200
        assert _confirm('reset@test.rw', sent[0], 'Another-meadow-90').status_code == 400

    def test_new_request_invalidates_old_code(self, user, sent):
        _request('reset@test.rw')
        cache.clear()  # reset throttle between requests
        _request('reset@test.rw')
        assert _confirm('reset@test.rw', sent[0]).status_code == 400 or sent[0] == sent[1]
        assert _confirm('reset@test.rw', sent[1]).status_code == 200

    def test_weak_new_password_rejected_but_code_still_usable(self, user, sent):
        _request('reset@test.rw')
        assert _confirm('reset@test.rw', sent[0], 'password').status_code == 400
        assert _confirm('reset@test.rw', sent[0]).status_code == 200

    def test_reset_revokes_existing_sessions(self, user, sent):
        client = APIClient()
        old = client.post(reverse('auth-login'), {'email': 'reset@test.rw', 'password': 'Old-garden-31'}).data['data']
        _request('reset@test.rw')
        _confirm('reset@test.rw', sent[0])
        assert client.post(reverse('auth-refresh'), {'refresh': old['refresh']}).status_code == 401
