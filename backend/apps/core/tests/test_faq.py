import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.core.models import FAQItem
from apps.accounts.models import CustomUser, UserRole


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    return CustomUser.objects.create_user(
        email='admin@example.com',
        password='pass',
        full_name='Admin User',
        role=UserRole.ADMIN,
        is_approved=True,
    )


@pytest.fixture
def faq_items(db):
    FAQItem.objects.create(question='Q1', answer='A1', order=1, is_published=True)
    FAQItem.objects.create(question='Q2', answer='A2', order=2, is_published=False)


@pytest.mark.django_db
def test_public_list_returns_only_published(client, faq_items):
    url = reverse('faq-list')
    resp = client.get(url)
    assert resp.status_code == 200
    data = resp.json()
    results = data.get('results', data)
    assert len(results) == 1
    assert results[0]['question'] == 'Q1'


@pytest.mark.django_db
def test_admin_list_returns_all(client, admin_user, faq_items):
    client.force_authenticate(admin_user)
    url = reverse('faq-list')
    resp = client.get(url)
    assert resp.status_code == 200
    data = resp.json()
    results = data.get('results', data)
    assert len(results) == 2


@pytest.mark.django_db
def test_public_cannot_create(client):
    url = reverse('faq-list')
    resp = client.post(url, {'question': 'Q', 'answer': 'A', 'order': 1, 'is_published': True})
    assert resp.status_code == 401


@pytest.mark.django_db
def test_admin_can_create(client, admin_user):
    client.force_authenticate(admin_user)
    url = reverse('faq-list')
    resp = client.post(url, {'question': 'New Q', 'answer': 'New A', 'order': 1, 'is_published': True})
    assert resp.status_code == 201
    assert FAQItem.objects.filter(question='New Q').exists()


@pytest.mark.django_db
def test_admin_can_patch(client, admin_user, faq_items):
    item = FAQItem.objects.first()
    client.force_authenticate(admin_user)
    url = reverse('faq-detail', args=[item.id])
    resp = client.patch(url, {'is_published': False}, content_type='application/json')
    assert resp.status_code == 200
    item.refresh_from_db()
    assert item.is_published is False


@pytest.mark.django_db
def test_admin_can_delete(client, admin_user, faq_items):
    item = FAQItem.objects.first()
    client.force_authenticate(admin_user)
    url = reverse('faq-detail', args=[item.id])
    resp = client.delete(url)
    assert resp.status_code == 204
