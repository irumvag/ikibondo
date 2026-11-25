import pytest
from rest_framework.test import APIClient
from apps.accounts.tests.factories import UserFactory

ME_URL = '/api/v1/auth/me/'


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def user(db):
    return UserFactory()


class TestThemePreferenceField:
    def test_me_response_includes_theme_preference(self, client, user):
        client.force_authenticate(user)
        res = client.get(ME_URL)
        assert res.status_code == 200
        assert 'theme_preference' in res.json()['data']

    def test_default_is_system(self, client, user):
        client.force_authenticate(user)
        res = client.get(ME_URL)
        assert res.json()['data']['theme_preference'] == 'system'

    def test_patch_updates_theme_preference(self, client, user):
        client.force_authenticate(user)
        res = client.patch(ME_URL, {'theme_preference': 'dark'}, format='json')
        assert res.status_code == 200
        assert res.json()['data']['theme_preference'] == 'dark'
        user.refresh_from_db()
        assert user.theme_preference == 'dark'

    def test_patch_light_theme(self, client, user):
        client.force_authenticate(user)
        client.patch(ME_URL, {'theme_preference': 'light'}, format='json')
        user.refresh_from_db()
        assert user.theme_preference == 'light'

    def test_patch_system_theme(self, client, user):
        client.force_authenticate(user)
        # set to dark first, then back to system
        client.patch(ME_URL, {'theme_preference': 'dark'}, format='json')
        client.patch(ME_URL, {'theme_preference': 'system'}, format='json')
        user.refresh_from_db()
        assert user.theme_preference == 'system'

    def test_invalid_theme_value_rejected(self, client, user):
        client.force_authenticate(user)
        res = client.patch(ME_URL, {'theme_preference': 'neon'}, format='json')
        assert res.status_code == 400

    def test_patch_also_updates_preferred_language(self, client, user):
        client.force_authenticate(user)
        res = client.patch(ME_URL, {'preferred_language': 'fr'}, format='json')
        assert res.status_code == 200
        user.refresh_from_db()
        assert user.preferred_language == 'fr'

    def test_patch_requires_auth(self, client, db):
        res = client.patch(ME_URL, {'theme_preference': 'dark'}, format='json')
        assert res.status_code == 401

    def test_role_and_camp_not_patchable(self, client, user):
        """Read-only fields should be silently ignored, not cause an error."""
        original_role = user.role
        client.force_authenticate(user)
        res = client.patch(ME_URL, {'role': 'ADMIN', 'theme_preference': 'light'}, format='json')
        assert res.status_code == 200
        user.refresh_from_db()
        assert user.role == original_role  # unchanged
