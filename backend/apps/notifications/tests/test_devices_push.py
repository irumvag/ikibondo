import pytest
from rest_framework.test import APIClient

from apps.accounts.models import UserRole
from apps.accounts.tests.factories import UserFactory
from apps.notifications import push
from apps.notifications.models import DeviceToken, Notification, NotificationStatus

URL = '/api/v1/notifications/devices/'


@pytest.fixture
def user(db):
    return UserFactory(role=UserRole.CHW, is_approved=True)


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.mark.django_db
class TestDeviceRegistration:
    def test_register_device(self, user):
        resp = _client(user).post(URL, {'token': 'tok-1', 'platform': 'ios', 'app_version': '1.0.0'})
        assert resp.status_code == 201
        assert DeviceToken.objects.get(token='tok-1').user == user

    def test_reregister_same_token_is_idempotent(self, user):
        _client(user).post(URL, {'token': 'tok-1', 'platform': 'ios'})
        resp = _client(user).post(URL, {'token': 'tok-1', 'platform': 'ios'})
        assert resp.status_code == 200
        assert DeviceToken.objects.filter(token='tok-1').count() == 1

    def test_new_signin_on_device_takes_over_token(self, user):
        _client(user).post(URL, {'token': 'shared', 'platform': 'android'})
        other = UserFactory(role=UserRole.NURSE, is_approved=True)
        _client(other).post(URL, {'token': 'shared', 'platform': 'android'})
        assert DeviceToken.objects.get(token='shared').user == other

    def test_cannot_unregister_someone_elses_device(self, user):
        _client(user).post(URL, {'token': 'mine', 'platform': 'ios'})
        intruder = UserFactory(role=UserRole.PARENT, is_approved=True)
        _client(intruder).delete(URL, {'token': 'mine'}, format='json')
        assert DeviceToken.objects.filter(token='mine').exists()

    def test_owner_can_unregister(self, user):
        _client(user).post(URL, {'token': 'mine', 'platform': 'ios'})
        _client(user).delete(URL, {'token': 'mine'}, format='json')
        assert not DeviceToken.objects.filter(token='mine').exists()

    def test_rejects_unknown_platform(self, user):
        assert _client(user).post(URL, {'token': 't', 'platform': 'blackberry'}).status_code == 400

    def test_requires_auth(self, db):
        assert APIClient().post(URL, {'token': 't', 'platform': 'ios'}).status_code == 401


@pytest.mark.django_db
class TestPushDelivery:
    def test_unconfigured_push_is_skipped_not_faked(self, user, settings):
        settings.FIREBASE_CREDENTIALS_FILE = ''
        from apps.notifications.tasks import send_push
        n = Notification.objects.create(recipient=user, message='hello', notification_type='HIGH_RISK_ALERT')
        send_push(str(n.id))
        n.refresh_from_db()
        assert n.status == NotificationStatus.SKIPPED

    def test_sends_to_each_device_and_prunes_dead_tokens(self, user, settings, monkeypatch):
        settings.FIREBASE_CREDENTIALS_FILE = '/fake/creds.json'
        from firebase_admin import messaging
        DeviceToken.objects.create(user=user, token='alive', platform='ios')
        DeviceToken.objects.create(user=user, token='dead', platform='android')

        def fake_send(message, app=None):
            if message.token == 'dead':
                raise messaging.UnregisteredError('gone')
            return 'ok'

        monkeypatch.setattr(messaging, 'send', fake_send)
        monkeypatch.setattr(push, '_firebase_app', lambda: None)
        assert push.send_to_user(user, 'T', 'B', {'n': 1}) == 1
        assert list(DeviceToken.objects.values_list('token', flat=True)) == ['alive']
