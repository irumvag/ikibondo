"""Admin-editable public content and announcements."""
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.tests.factories import AdminUserFactory, NurseFactory
from apps.core.models import Announcement


@pytest.fixture
def admin(db):
    c = APIClient()
    c.force_authenticate(AdminUserFactory())
    return c


@pytest.mark.django_db
class TestSiteContent:
    def test_admin_edits_and_public_reads(self, admin):
        res = admin.put('/api/v1/site-content/home.hero/', {
            'content_en': {'title': 'Every child seen in time', 'body': 'New intro.'},
            'content_rw': {'title': 'Buri mwana akurikiranwa'},
        }, format='json')
        assert res.status_code == 200
        public = APIClient().get('/api/v1/site-content/').json()['data']
        assert public['home.hero']['content_en']['title'] == 'Every child seen in time'

    def test_lists_of_items_are_allowed(self, admin):
        res = admin.put('/api/v1/site-content/home.how_it_works/', {
            'content_en': {'steps': [{'title': 'Measure', 'description': 'MUAC and weight.'}]},
        }, format='json')
        assert res.status_code == 200

    def test_only_admins_edit(self, db):
        nurse = APIClient()
        nurse.force_authenticate(NurseFactory())
        assert nurse.put('/api/v1/site-content/home.hero/', {'content_en': {'title': 'x'}},
                         format='json').status_code == 403
        assert APIClient().put('/api/v1/site-content/home.hero/', {'content_en': {'title': 'x'}},
                               format='json').status_code in (401, 403)

    def test_unknown_section_and_bad_shapes_rejected(self, admin):
        assert admin.put('/api/v1/site-content/evil/', {'content_en': {}}, format='json').status_code == 404
        assert admin.put('/api/v1/site-content/about/', {'content_en': {'title': {'nested': 'x'}}},
                         format='json').status_code == 400
        assert admin.put('/api/v1/site-content/about/', {'content_en': {'body': 'x' * 5000}},
                         format='json').status_code == 400

    def test_reset_to_default(self, admin):
        admin.put('/api/v1/site-content/footer/', {'content_en': {'tagline': 'x'}}, format='json')
        assert admin.delete('/api/v1/site-content/footer/').status_code == 200
        assert 'footer' not in APIClient().get('/api/v1/site-content/').json()['data']


@pytest.mark.django_db
class TestAnnouncements:
    def test_active_window_and_placement(self, admin):
        now = timezone.now()
        admin.post('/api/v1/announcements/', {'message_en': 'Vaccination day Friday', 'show_dashboard': False},
                   format='json')
        Announcement.objects.create(message_en='Expired', ends_at=now - timedelta(days=1))
        Announcement.objects.create(message_en='Future', starts_at=now + timedelta(days=1))
        public = APIClient().get('/api/v1/announcements/active/?where=public').json()['data']
        assert [a['message_en'] for a in public] == ['Vaccination day Friday']
        dashboard = APIClient().get('/api/v1/announcements/active/?where=dashboard').json()['data']
        assert dashboard == []

    def test_unsafe_links_rejected(self, admin):
        res = admin.post('/api/v1/announcements/', {'message_en': 'x', 'link_url': 'javascript:alert(1)'},
                         format='json')
        assert res.status_code == 400

    def test_only_admins_manage(self, db):
        assert APIClient().post('/api/v1/announcements/', {'message_en': 'x'}, format='json').status_code in (401, 403)


@pytest.mark.django_db
def test_public_camp_listing_shows_description_only(admin):
    from apps.camps.tests.factories import CampFactory
    camp = CampFactory(public_description='Health centre open Monday to Friday.')
    rows = APIClient().get('/api/v1/camps/').json()
    rows = rows.get('data', rows)
    rows = rows.get('results', rows) if isinstance(rows, dict) else rows
    row = next(r for r in rows if r['id'] == str(camp.id))
    assert row['public_description'] == 'Health centre open Monday to Friday.'
    assert 'estimated_population' not in row
