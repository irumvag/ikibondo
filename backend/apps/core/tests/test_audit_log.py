"""
Tests for Sprint 10 — Audit Log & FAQ i18n.

Covers:
  AuditLog model & AuditLogMiddleware
    - POST/PATCH/DELETE mutations are recorded
    - GET requests are NOT recorded
    - Sensitive fields (password) are stripped from body
    - Auth paths are body-skipped
  GET /api/v1/audit/log/
    - Requires ADMIN role
    - Filters: user, action, path
    - Pagination
  FAQ multilingual fields
    - CRUD with rw/fr fields
    - lang=rw query param returns localised fields
"""
import pytest
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory, AdminUserFactory, NurseFactory
from apps.accounts.models import UserRole
from apps.camps.tests.factories import CampFactory
from apps.core.models import AuditLog, FAQItem


AUDIT_URL = '/api/v1/audit/log/'
FAQ_URL   = '/api/v1/faq/'


# ── fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def admin(db):
    return AdminUserFactory()


@pytest.fixture
def nurse(db):
    camp = CampFactory()
    return NurseFactory(camp=camp)


# ── helpers ───────────────────────────────────────────────────────────────────

def _make_audit(user=None, action='CREATE', path='/api/v1/children/', status_code=201):
    return AuditLog.objects.create(
        user=user,
        user_email=getattr(user, 'email', ''),
        action=action,
        method='POST' if action == 'CREATE' else ('PATCH' if action == 'UPDATE' else 'DELETE'),
        path=path,
        status_code=status_code,
        ip_address='127.0.0.1',
    )


# ── TestAuditLogModel ─────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAuditLogModel:
    def test_create_audit_log_entry(self, admin):
        entry = _make_audit(user=admin, action='CREATE')
        assert entry.id is not None
        assert entry.action == 'CREATE'
        assert entry.user_email == admin.email
        assert entry.status_code == 201

    def test_str_representation(self, admin):
        entry = _make_audit(user=admin, action='UPDATE', path='/api/v1/children/123/')
        s = str(entry)
        assert 'UPDATE' in s
        assert '/api/v1/children/123/' in s

    def test_ordering_newest_first(self, admin):
        e1 = _make_audit(user=admin, path='/api/v1/a/')
        e2 = _make_audit(user=admin, path='/api/v1/b/')
        entries = list(AuditLog.objects.all())
        assert entries[0].path == '/api/v1/b/'  # newest first
        assert entries[1].path == '/api/v1/a/'


# ── TestAuditLogMiddleware ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAuditLogMiddleware:
    """
    Test that the AuditLogMiddleware records mutations via real HTTP calls.
    We use the FAQ endpoint (public write = admin only, but any endpoint works).
    """

    def test_post_creates_audit_entry(self, client, admin):
        before = AuditLog.objects.count()
        client.force_authenticate(admin)
        client.post(FAQ_URL, {'question': 'Q?', 'answer': 'A.', 'order': 1}, format='json')
        assert AuditLog.objects.count() == before + 1
        entry = AuditLog.objects.latest('id')
        assert entry.action == 'CREATE'
        assert entry.method == 'POST'
        assert 'faq' in entry.path

    def test_patch_creates_audit_entry(self, client, admin):
        item = FAQItem.objects.create(question='Q', answer='A', order=1)
        client.force_authenticate(admin)
        before = AuditLog.objects.count()
        client.patch(f'{FAQ_URL}{item.id}/', {'is_published': False}, format='json')
        assert AuditLog.objects.count() == before + 1
        assert AuditLog.objects.latest('id').action == 'UPDATE'

    def test_delete_creates_audit_entry(self, client, admin):
        item = FAQItem.objects.create(question='Q', answer='A', order=1)
        client.force_authenticate(admin)
        before = AuditLog.objects.count()
        client.delete(f'{FAQ_URL}{item.id}/')
        assert AuditLog.objects.count() == before + 1
        assert AuditLog.objects.latest('id').action == 'DELETE'

    def test_get_does_not_create_audit_entry(self, client):
        before = AuditLog.objects.count()
        client.get(FAQ_URL)
        assert AuditLog.objects.count() == before

    def test_sensitive_fields_stripped(self, client, admin):
        client.force_authenticate(admin)
        client.post(
            '/api/v1/auth/change-password/',
            {'old_password': 'secret123', 'new_password': 'newpass456'},
            format='json',
        )
        entry = AuditLog.objects.filter(path__icontains='change-password').last()
        if entry and entry.request_body:
            assert entry.request_body.get('old_password') == '***'
            assert entry.request_body.get('new_password') == '***'

    def test_anonymous_post_recorded_with_null_user(self, client):
        before = AuditLog.objects.count()
        client.post(FAQ_URL, {'question': 'Q', 'answer': 'A', 'order': 1}, format='json')
        assert AuditLog.objects.count() == before + 1
        entry = AuditLog.objects.latest('id')
        assert entry.user is None

    def test_user_email_denormalised(self, client, admin):
        client.force_authenticate(admin)
        client.post(FAQ_URL, {'question': 'Q2', 'answer': 'A2', 'order': 2}, format='json')
        entry = AuditLog.objects.latest('id')
        assert entry.user_email == admin.email


# ── TestAuditLogEndpoint ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAuditLogEndpoint:
    def test_requires_auth(self, client):
        res = client.get(AUDIT_URL)
        assert res.status_code == 403

    def test_non_admin_forbidden(self, client, nurse):
        client.force_authenticate(nurse)
        res = client.get(AUDIT_URL)
        assert res.status_code == 403

    def test_admin_can_access(self, client, admin):
        client.force_authenticate(admin)
        res = client.get(AUDIT_URL)
        assert res.status_code == 200
        body = res.json()['data']
        assert 'count' in body
        assert 'results' in body

    def test_filter_by_action(self, client, admin):
        _make_audit(user=admin, action='CREATE')
        _make_audit(user=admin, action='DELETE')
        client.force_authenticate(admin)
        res = client.get(AUDIT_URL + '?action=CREATE')
        results = res.json()['data']['results']
        assert all(r['action'] == 'CREATE' for r in results)

    def test_filter_by_user(self, client, admin, nurse):
        _make_audit(user=admin, action='CREATE')
        _make_audit(user=nurse, action='UPDATE')
        client.force_authenticate(admin)
        res = client.get(AUDIT_URL + f'?user={nurse.id}')
        results = res.json()['data']['results']
        assert all(r['user'] == str(nurse.id) for r in results)

    def test_filter_by_path(self, client, admin):
        _make_audit(user=admin, action='CREATE', path='/api/v1/children/')
        _make_audit(user=admin, action='CREATE', path='/api/v1/faq/')
        client.force_authenticate(admin)
        res = client.get(AUDIT_URL + '?path=children')
        results = res.json()['data']['results']
        assert all('children' in r['path'] for r in results)

    def test_pagination(self, client, admin):
        for _ in range(5):
            _make_audit(user=admin)
        client.force_authenticate(admin)
        res = client.get(AUDIT_URL + '?page_size=2&page=1')
        body = res.json()['data']
        assert len(body['results']) == 2
        assert body['page_size'] == 2

    def test_page_size_capped_at_100(self, client, admin):
        client.force_authenticate(admin)
        res = client.get(AUDIT_URL + '?page_size=999')
        assert res.status_code == 200
        assert res.json()['data']['page_size'] == 100


# ── TestFAQMultilingual ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestFAQMultilingual:
    def test_admin_can_create_with_rw_fr_fields(self, client, admin):
        client.force_authenticate(admin)
        res = client.post(FAQ_URL, {
            'question':    'What is Ikibondo?',
            'answer':      'A child health platform.',
            'question_rw': 'Ikibondo ni iki?',
            'answer_rw':   'Platform yo gukurikirana ubuzima bw\'abana.',
            'question_fr': 'Qu\'est-ce qu\'Ikibondo?',
            'answer_fr':   'Une plateforme de santé infantile.',
            'order': 1,
        }, format='json')
        assert res.status_code == 201
        data = res.json()
        assert data['question_rw'] == 'Ikibondo ni iki?'
        assert data['question_fr'] == 'Qu\'est-ce qu\'Ikibondo?'

    def test_lang_rw_adds_localised_fields(self, client, admin):
        FAQItem.objects.create(
            question='What?', answer='This.',
            question_rw='Iki?', answer_rw='Iki kintu.',
            order=1, is_published=True,
        )
        client.force_authenticate(admin)
        res = client.get(FAQ_URL + '?lang=rw')
        assert res.status_code == 200
        items = res.json().get('results', res.json())
        item = items[0]
        assert item['localised_question'] == 'Iki?'
        assert item['localised_answer'] == 'Iki kintu.'

    def test_lang_fr_adds_localised_fields(self, client, admin):
        FAQItem.objects.create(
            question='What?', answer='This.',
            question_fr='Quoi?', answer_fr='Ceci.',
            order=1, is_published=True,
        )
        client.force_authenticate(admin)
        res = client.get(FAQ_URL + '?lang=fr')
        items = res.json().get('results', res.json())
        item = items[0]
        assert item['localised_question'] == 'Quoi?'
        assert item['localised_answer'] == 'Ceci.'

    def test_lang_rw_falls_back_to_en_when_blank(self, client, admin):
        FAQItem.objects.create(
            question='Fallback?', answer='Fallback answer.',
            question_rw='', answer_rw='',
            order=1, is_published=True,
        )
        client.force_authenticate(admin)
        res = client.get(FAQ_URL + '?lang=rw')
        items = res.json().get('results', res.json())
        assert items[0]['localised_question'] == 'Fallback?'

    def test_public_can_list_with_lang_param(self, client):
        FAQItem.objects.create(
            question='Q', answer='A',
            question_rw='Q rw', answer_rw='A rw',
            order=1, is_published=True,
        )
        res = client.get(FAQ_URL + '?lang=rw')
        assert res.status_code == 200
        items = res.json().get('results', res.json())
        assert items[0]['localised_question'] == 'Q rw'
