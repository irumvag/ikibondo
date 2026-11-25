import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from apps.accounts.tests.factories import UserFactory
from apps.children.tests.factories import ChildFactory
from apps.notifications.models import Notification, NotificationType


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def chw(db):
    return UserFactory(email='chw@test.rw', password='testpass')


@pytest.fixture
def child(db):
    return ChildFactory()


@pytest.fixture
def notification(db, chw, child):
    return Notification.objects.create(
        recipient=chw,
        child=child,
        notification_type=NotificationType.SAM_ALERT,
        message='Test SAM alert for child.',
    )


@pytest.mark.django_db
class TestNotificationList:
    def test_list_notifications(self, client, chw, notification):
        client.force_authenticate(user=chw)
        resp = client.get(reverse('notification-list'))
        assert resp.status_code == 200

    def test_list_unauthenticated(self, client):
        resp = client.get(reverse('notification-list'))
        assert resp.status_code == 401


@pytest.mark.django_db
class TestNotificationMarkRead:
    def test_mark_as_read(self, client, chw, notification):
        assert notification.is_read is False
        client.force_authenticate(user=chw)
        resp = client.patch(
            reverse('notification-mark-read', kwargs={'pk': notification.id}),
            format='json'
        )
        assert resp.status_code == 200
        notification.refresh_from_db()
        assert notification.is_read is True


@pytest.mark.django_db
class TestNotificationModel:
    def test_notification_types(self):
        assert NotificationType.SAM_ALERT == 'SAM_ALERT'
        assert NotificationType.VACCINATION_REMINDER == 'VACCINATION_REMINDER'
        assert NotificationType.GROWTH_RISK == 'GROWTH_RISK'
        assert NotificationType.MISSED_VISIT == 'MISSED_VISIT'

    def test_str_representation(self, chw, child):
        n = Notification.objects.create(
            recipient=chw,
            child=child,
            notification_type=NotificationType.SAM_ALERT,
            message='Test',
        )
        assert 'SAM_ALERT' in str(n)
        assert chw.full_name in str(n)
