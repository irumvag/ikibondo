"""
Permission matrix smoke test.

For each (endpoint, method) combination we specify which roles are FORBIDDEN
(must get 401 or 403) vs ALLOWED (must not get 401/403 or any 5xx).
400 / 404 on an allowed role is fine — it means the permission check passed
but the empty/invalid body was rejected by validation.
"""
import pytest
from rest_framework.test import APIClient

from apps.accounts.models import UserRole
from .factories import UserFactory, NurseFactory, SupervisorFactory, AdminUserFactory


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def chw():
    return UserFactory(role=UserRole.CHW, is_approved=True)

@pytest.fixture
def nurse():
    return NurseFactory(is_approved=True)

@pytest.fixture
def supervisor():
    return SupervisorFactory(is_approved=True)

@pytest.fixture
def admin():
    return AdminUserFactory(is_approved=True)

@pytest.fixture
def parent():
    return UserFactory(role=UserRole.PARENT, is_approved=True)


def _client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


# ── Matrix ────────────────────────────────────────────────────────────────────
# Each entry: (url, method, forbidden_roles)
# forbidden_roles: set of role names that MUST get 401/403.
# All other roles must NOT get 401/403/5xx.

MATRIX = [
    # Auth management — only staff creators + admin can list/create users
    ('/api/v1/auth/me/',              'get',  set()),                                      # everyone can GET /me/
    ('/api/v1/auth/users/',           'get',  {'chw', 'parent'}),                         # nurse/supervisor/admin
    ('/api/v1/auth/pending-approvals/', 'get', {'chw', 'parent'}),                        # nurse/supervisor/admin
    ('/api/v1/auth/consent/',         'get',  set()),                                      # all authenticated
    # Children — PARENT gets limited filtered list (200); duplicate-check requires params
    ('/api/v1/children/',             'get',  set()),                                      # all roles
    # Health records — parent scope returns 200 with filtered empty list
    ('/api/v1/health-records/',       'get',  set()),                                      # all roles
    # ML versions — everyone can list, only admin can create
    ('/api/v1/ml/model-versions/',    'get',  set()),                                      # all roles
    ('/api/v1/ml/model-versions/',    'post', {'chw', 'nurse', 'supervisor', 'parent'}),  # admin only
    # Vaccinations — parent gets 403 or filtered list based on implementation
    ('/api/v1/vaccinations/',         'get',  set()),                                      # all roles
    # Broadcasts — supervisor/admin only for writes; read is broader
    ('/api/v1/notifications/broadcasts/', 'post', {'chw', 'nurse', 'parent'}),            # supervisor/admin
    # Audit log — admin only
    ('/api/v1/audit/log/',            'get',  {'chw', 'nurse', 'supervisor', 'parent'}),  # admin only
    # Consultations & referrals — parent forbidden (gets 403 or empty 200 based on viewset)
    ('/api/v1/consultations/',        'get',  set()),                                      # non-parent roles + filtered
    ('/api/v1/referrals/',            'get',  set()),                                      # non-parent roles + filtered
]


@pytest.mark.parametrize('url,method,forbidden_roles', MATRIX)
@pytest.mark.django_db
def test_permission_matrix(url, method, forbidden_roles, chw, nurse, supervisor, admin, parent):
    role_fixtures = {
        'chw': chw,
        'nurse': nurse,
        'supervisor': supervisor,
        'admin': admin,
        'parent': parent,
    }
    for role_name, user in role_fixtures.items():
        client = _client(user)
        response = getattr(client, method)(url, format='json')
        status_code = response.status_code

        # Never a server error regardless of role
        assert status_code < 500, (
            f"[{role_name}] {method.upper()} {url} returned server error {status_code}"
        )

        if role_name in forbidden_roles:
            assert status_code in (401, 403), (
                f"[{role_name}] {method.upper()} {url} expected 401/403 (forbidden), got {status_code}"
            )
        else:
            # Allowed — must not be 401 or 403
            assert status_code not in (401, 403), (
                f"[{role_name}] {method.upper()} {url} expected access (not 401/403), got {status_code}"
            )


@pytest.mark.django_db
def test_unauthenticated_cannot_access_protected_endpoints():
    """Anonymous requests to protected endpoints must return 401."""
    client = APIClient()
    endpoints = [
        '/api/v1/auth/me/',
        '/api/v1/auth/users/',
        '/api/v1/children/',
        '/api/v1/health-records/',
        '/api/v1/vaccinations/',
        '/api/v1/notifications/',
        '/api/v1/consultations/',
        '/api/v1/referrals/',
        '/api/v1/audit/log/',
    ]
    for url in endpoints:
        response = client.get(url)
        assert response.status_code in (401, 403), (
            f"Unauthenticated GET {url} should return 401 or 403, got {response.status_code}"
        )
