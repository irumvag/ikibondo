"""
Tests for the global DRF exception handler (apps.core.exceptions).

Every DRF-raised exception must come back in the standard envelope:
  {"success": false, "error": "...", "code": "..."}
"""
import pytest
from rest_framework.test import APIClient

from apps.accounts.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


class TestExceptionEnvelope:
    def test_unauthenticated_request_is_enveloped(self, client):
        res = client.get('/api/v1/auth/me/')
        assert res.status_code == 401
        body = res.json()
        assert body['success'] is False
        assert body['code'] == 'NOT_AUTHENTICATED'
        assert isinstance(body['error'], str) and body['error']

    def test_not_found_is_enveloped(self, client):
        user = UserFactory()
        client.force_authenticate(user)
        res = client.get('/api/v1/children/00000000-0000-0000-0000-000000000000/')
        assert res.status_code in (403, 404)  # role scoping may 403 first
        body = res.json()
        # The view may answer via error_response or raise through the handler;
        # either way the envelope invariant holds.
        assert body['success'] is False
        assert 'error' in body and 'code' in body

    def test_method_not_allowed_is_enveloped(self, client):
        user = UserFactory()
        client.force_authenticate(user)
        res = client.delete('/api/v1/auth/me/')
        assert res.status_code == 405
        body = res.json()
        assert body['success'] is False
        assert body['code'] == 'METHOD_NOT_ALLOWED'

    def test_validation_error_keeps_field_details(self, client):
        # Login serializer raises a DRF ValidationError on missing fields
        res = client.post('/api/v1/auth/login/', {}, format='json')
        assert res.status_code == 400
        body = res.json()
        assert body['success'] is False
        assert body['code'] == 'VALIDATION_ERROR'
        # Field-level errors preserved for form clients
        assert 'details' in body
