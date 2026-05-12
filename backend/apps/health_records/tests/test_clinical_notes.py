import pytest
from django.core.exceptions import ValidationError
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.tests.factories import (
    UserFactory, NurseFactory, SupervisorFactory, AdminUserFactory,
)
from apps.camps.tests.factories import CampFactory
from apps.children.tests.factories import ChildFactory
from .factories import HealthRecordFactory, ClinicalNoteFactory


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def camp(db):
    return CampFactory()


@pytest.fixture
def chw(db, camp):
    return UserFactory(email='chw@test.rw', camp=camp)


@pytest.fixture
def nurse(db, camp):
    return NurseFactory(email='nurse@test.rw', camp=camp)


@pytest.fixture
def supervisor(db, camp):
    return SupervisorFactory(email='sup@test.rw', camp=camp)


@pytest.fixture
def admin_user(db):
    return AdminUserFactory(email='admin@test.rw')


@pytest.fixture
def child(db, camp):
    return ChildFactory(camp=camp)


@pytest.fixture
def health_record(db, child, nurse):
    return HealthRecordFactory(child=child, recorded_by=nurse)


# ---------------------------------------------------------------------------
# Model validation
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestClinicalNoteModel:
    def test_clean_rejects_both_targets(self, health_record, child):
        from apps.health_records.models import ClinicalNote
        note = ClinicalNote(
            health_record=health_record,
            child=child,
            content='Test',
        )
        with pytest.raises(ValidationError):
            note.clean()

    def test_clean_rejects_neither_target(self):
        from apps.health_records.models import ClinicalNote
        note = ClinicalNote(content='Test')
        with pytest.raises(ValidationError):
            note.clean()

    def test_clean_accepts_health_record_only(self, health_record):
        from apps.health_records.models import ClinicalNote
        note = ClinicalNote(health_record=health_record, content='Test')
        note.clean()  # should not raise

    def test_clean_accepts_child_only(self, child):
        from apps.health_records.models import ClinicalNote
        note = ClinicalNote(child=child, content='Test')
        note.clean()  # should not raise


# ---------------------------------------------------------------------------
# GET/POST /api/v1/health-records/<hr_id>/notes/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestHealthRecordNotesEndpoint:
    def test_list_notes_unauthenticated(self, client, health_record):
        url = reverse('health-record-notes', kwargs={'pk': health_record.id})
        resp = client.get(url)
        assert resp.status_code == 401

    def test_list_notes_empty(self, client, nurse, health_record):
        client.force_authenticate(user=nurse)
        url = reverse('health-record-notes', kwargs={'pk': health_record.id})
        resp = client.get(url)
        assert resp.status_code == 200
        assert resp.data['data'] == []

    def test_list_notes_returns_existing(self, client, nurse, health_record):
        ClinicalNoteFactory(author=nurse, health_record=health_record, content='Follow up needed')
        client.force_authenticate(user=nurse)
        url = reverse('health-record-notes', kwargs={'pk': health_record.id})
        resp = client.get(url)
        assert resp.status_code == 200
        assert len(resp.data['data']) == 1
        assert resp.data['data'][0]['content'] == 'Follow up needed'

    def test_nurse_can_create_note(self, client, nurse, health_record):
        client.force_authenticate(user=nurse)
        url = reverse('health-record-notes', kwargs={'pk': health_record.id})
        resp = client.post(url, {'note_type': 'FOLLOW_UP', 'content': 'Refer to hospital'}, format='json')
        assert resp.status_code == 201
        data = resp.data['data']
        assert data['content'] == 'Refer to hospital'
        assert data['note_type'] == 'FOLLOW_UP'
        assert data['author_name'] == nurse.full_name

    def test_supervisor_can_create_note(self, client, supervisor, health_record):
        client.force_authenticate(user=supervisor)
        url = reverse('health-record-notes', kwargs={'pk': health_record.id})
        resp = client.post(url, {'note_type': 'OBSERVATION', 'content': 'Stable'}, format='json')
        assert resp.status_code == 201

    def test_chw_cannot_create_note(self, client, chw, health_record):
        # CHW cannot see the health record (queryset scoping) → 404 (resource not found for their scope)
        # or 403 (explicit permission check). Both signal "no access".
        client.force_authenticate(user=chw)
        url = reverse('health-record-notes', kwargs={'pk': health_record.id})
        resp = client.post(url, {'note_type': 'GENERAL', 'content': 'Test'}, format='json')
        assert resp.status_code in (403, 404)

    def test_parent_cannot_create_note(self, client, child, health_record):
        parent = UserFactory(email='parent@test.rw', role='PARENT')
        client.force_authenticate(user=parent)
        url = reverse('health-record-notes', kwargs={'pk': health_record.id})
        resp = client.post(url, {'note_type': 'GENERAL', 'content': 'Test'}, format='json')
        assert resp.status_code in (403, 404)

    def test_author_injected_from_request(self, client, nurse, health_record):
        client.force_authenticate(user=nurse)
        url = reverse('health-record-notes', kwargs={'pk': health_record.id})
        resp = client.post(url, {'content': 'Auto-author test'}, format='json')
        assert resp.status_code == 201
        assert resp.data['data']['author_name'] == nurse.full_name
        assert resp.data['data']['author_role'] == 'NURSE'

    def test_note_health_record_field_is_readonly(self, client, nurse, health_record, child):
        """Passing a child FK in the body on a health-record endpoint must be ignored."""
        client.force_authenticate(user=nurse)
        url = reverse('health-record-notes', kwargs={'pk': health_record.id})
        resp = client.post(url, {'content': 'Try override', 'child': str(child.id)}, format='json')
        # Should succeed and the note should be attached to health_record, not child
        assert resp.status_code == 201
        from apps.health_records.models import ClinicalNote
        note = ClinicalNote.objects.get(id=resp.data['data']['id'])
        assert note.health_record_id == health_record.id
        assert note.child_id is None


# ---------------------------------------------------------------------------
# GET/POST /api/v1/children/<child_id>/notes/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestChildNotesEndpoint:
    def test_list_child_notes_unauthenticated(self, client, child):
        url = reverse('child-notes', kwargs={'pk': child.id})
        resp = client.get(url)
        assert resp.status_code == 401

    def test_list_child_notes_empty(self, client, nurse, child):
        client.force_authenticate(user=nurse)
        url = reverse('child-notes', kwargs={'pk': child.id})
        resp = client.get(url)
        assert resp.status_code == 200
        assert resp.data['data'] == []

    def test_supervisor_can_create_child_note(self, client, supervisor, child):
        client.force_authenticate(user=supervisor)
        url = reverse('child-notes', kwargs={'pk': child.id})
        resp = client.post(url, {'note_type': 'REFERRAL', 'content': 'Refer to nutrition centre'}, format='json')
        assert resp.status_code == 201
        data = resp.data['data']
        assert data['note_type'] == 'REFERRAL'
        assert str(data['child']) == str(child.id)

    def test_child_note_has_no_health_record(self, client, nurse, child):
        client.force_authenticate(user=nurse)
        url = reverse('child-notes', kwargs={'pk': child.id})
        resp = client.post(url, {'content': 'Longitudinal note'}, format='json')
        assert resp.status_code == 201
        from apps.health_records.models import ClinicalNote
        note = ClinicalNote.objects.get(id=resp.data['data']['id'])
        assert note.health_record_id is None
        assert note.child_id == child.id

    def test_chw_cannot_create_child_note(self, client, chw, child):
        # CHW cannot write clinical notes (note creation is NURSE/SUPERVISOR/ADMIN only).
        # The view may return 403 (explicit guard) or 404 (child not in CHW's caseload).
        client.force_authenticate(user=chw)
        url = reverse('child-notes', kwargs={'pk': child.id})
        resp = client.post(url, {'content': 'Forbidden'}, format='json')
        assert resp.status_code in (403, 404)


# ---------------------------------------------------------------------------
# PATCH / DELETE  /api/v1/notes/<note_id>/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestClinicalNoteStandaloneViewSet:
    def _note_url(self, note_id):
        return reverse('clinical-note-detail', kwargs={'pk': note_id})

    def test_author_can_patch_own_note(self, client, nurse, health_record):
        note = ClinicalNoteFactory(author=nurse, health_record=health_record)
        client.force_authenticate(user=nurse)
        resp = client.patch(self._note_url(note.id), {'content': 'Updated content'}, format='json')
        assert resp.status_code == 200
        assert resp.data['data']['content'] == 'Updated content'

    def test_other_nurse_cannot_patch_note(self, client, health_record):
        author  = NurseFactory(email='nurse_a@test.rw')
        intruder = NurseFactory(email='nurse_b@test.rw')
        note = ClinicalNoteFactory(author=author, health_record=health_record)
        client.force_authenticate(user=intruder)
        resp = client.patch(self._note_url(note.id), {'content': 'Hijacked'}, format='json')
        assert resp.status_code == 403

    def test_admin_can_patch_any_note(self, client, admin_user, nurse, health_record):
        note = ClinicalNoteFactory(author=nurse, health_record=health_record)
        client.force_authenticate(user=admin_user)
        resp = client.patch(self._note_url(note.id), {'content': 'Admin edit'}, format='json')
        assert resp.status_code == 200

    def test_author_can_soft_delete_own_note(self, client, nurse, health_record):
        note = ClinicalNoteFactory(author=nurse, health_record=health_record)
        client.force_authenticate(user=nurse)
        resp = client.delete(self._note_url(note.id))
        assert resp.status_code == 200
        note.refresh_from_db()
        assert note.is_active is False

    def test_other_user_cannot_delete_note(self, client, health_record):
        author   = NurseFactory(email='owner@test.rw')
        intruder = NurseFactory(email='thief@test.rw')
        note = ClinicalNoteFactory(author=author, health_record=health_record)
        client.force_authenticate(user=intruder)
        resp = client.delete(self._note_url(note.id))
        assert resp.status_code == 403

    def test_pinning_a_note(self, client, nurse, health_record):
        note = ClinicalNoteFactory(author=nurse, health_record=health_record, is_pinned=False)
        client.force_authenticate(user=nurse)
        resp = client.patch(self._note_url(note.id), {'is_pinned': True}, format='json')
        assert resp.status_code == 200
        assert resp.data['data']['is_pinned'] is True

    def test_pinned_notes_sort_first(self, client, nurse, health_record):
        ClinicalNoteFactory(author=nurse, health_record=health_record, content='Normal note', is_pinned=False)
        ClinicalNoteFactory(author=nurse, health_record=health_record, content='Pinned note',  is_pinned=True)
        client.force_authenticate(user=nurse)
        url = reverse('health-record-notes', kwargs={'pk': health_record.id})
        resp = client.get(url)
        assert resp.status_code == 200
        notes = resp.data['data']
        assert notes[0]['is_pinned'] is True
        assert notes[0]['content'] == 'Pinned note'
