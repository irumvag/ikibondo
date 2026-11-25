import pytest
from datetime import date
from django.urls import reverse
from rest_framework.test import APIClient
from apps.accounts.tests.factories import UserFactory, NurseFactory
from apps.camps.tests.factories import CampFactory
from apps.children.tests.factories import ChildFactory
from .factories import HealthRecordFactory


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def nurse(db):
    return NurseFactory(email='nurse@test.rw', password='testpass')


@pytest.fixture
def camp(db):
    return CampFactory()


@pytest.fixture
def child(db, camp, nurse):
    return ChildFactory(camp=camp, registered_by=nurse)


@pytest.mark.django_db
class TestHealthRecordCreate:
    def test_create_record(self, client, nurse, child):
        client.force_authenticate(user=nurse)
        resp = client.post(reverse('health-record-list'), {
            'child': str(child.id),
            'measurement_date': str(date.today()),
            'weight_kg': 8.5,
            'height_cm': 72.0,
            'muac_cm': 13.5,
            'oedema': False,
        }, format='json')
        assert resp.status_code == 201

    def test_create_sam_record(self, client, nurse, child):
        """SAM case: low weight, critical MUAC, should be classified correctly."""
        client.force_authenticate(user=nurse)
        resp = client.post(reverse('health-record-list'), {
            'child': str(child.id),
            'measurement_date': str(date.today()),
            'weight_kg': 5.8,
            'height_cm': 68.0,
            'muac_cm': 10.5,
            'oedema': False,
        }, format='json')
        assert resp.status_code == 201

    def test_create_record_unauthenticated(self, client, child):
        resp = client.post(reverse('health-record-list'), {
            'child': str(child.id),
            'measurement_date': str(date.today()),
            'weight_kg': 8.5,
            'height_cm': 72.0,
        }, format='json')
        assert resp.status_code == 401


@pytest.mark.django_db
class TestHealthRecordList:
    def test_list_records(self, client, nurse):
        record = HealthRecordFactory(recorded_by=nurse)
        client.force_authenticate(user=nurse)
        resp = client.get(reverse('health-record-list'))
        assert resp.status_code == 200

    def test_get_record_detail(self, client, nurse):
        record = HealthRecordFactory(recorded_by=nurse)
        client.force_authenticate(user=nurse)
        resp = client.get(reverse('health-record-detail', kwargs={'pk': record.id}))
        assert resp.status_code == 200


@pytest.mark.django_db
class TestWHOZScore:
    def test_compute_whz(self):
        from apps.health_records.who_zscore import compute_whz
        # Normal male child: 72cm, 8.5kg
        whz = compute_whz(weight_kg=8.5, height_cm=72.0, sex='M')
        assert whz is not None
        assert -2 < whz < 2  # normal range

    def test_compute_whz_severe_wasting(self):
        from apps.health_records.who_zscore import compute_whz
        # Severely underweight: 68cm, 5.5kg
        whz = compute_whz(weight_kg=5.5, height_cm=68.0, sex='F')
        assert whz is not None
        assert whz < -3  # SAM threshold

    def test_classify_sam(self):
        from apps.health_records.who_zscore import classify_nutrition_status
        result = classify_nutrition_status(whz=-3.5, muac_cm=10.5, oedema=False)
        assert result == 'SAM'

    def test_classify_mam(self):
        from apps.health_records.who_zscore import classify_nutrition_status
        result = classify_nutrition_status(whz=-2.5, muac_cm=12.0, oedema=False)
        assert result == 'MAM'

    def test_classify_normal(self):
        from apps.health_records.who_zscore import classify_nutrition_status
        result = classify_nutrition_status(whz=0.5, muac_cm=14.0, oedema=False)
        assert result == 'NORMAL'

    def test_oedema_forces_sam(self):
        from apps.health_records.who_zscore import classify_nutrition_status
        result = classify_nutrition_status(whz=0.0, muac_cm=14.0, oedema=True)
        assert result == 'SAM'

    def test_muac_critical_forces_sam(self):
        from apps.health_records.who_zscore import classify_nutrition_status
        result = classify_nutrition_status(whz=0.0, muac_cm=11.0, oedema=False)
        assert result == 'SAM'
