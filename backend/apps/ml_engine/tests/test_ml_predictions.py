import pytest
from datetime import date, timedelta
from django.urls import reverse
from rest_framework.test import APIClient
from apps.accounts.tests.factories import UserFactory
from apps.camps.tests.factories import CampFactory
from apps.children.tests.factories import ChildFactory
from apps.health_records.tests.factories import HealthRecordFactory


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def chw(db):
    return UserFactory(email='chw@test.rw', password='testpass')


@pytest.fixture
def child(db):
    camp = CampFactory()
    return ChildFactory(camp=camp)


@pytest.mark.django_db
class TestMalnutritionPrediction:
    def test_predict_requires_auth(self, client, child):
        resp = client.post(reverse('ml-predict-malnutrition'), {
            'child_id': str(child.id),
            'age_months': 12,
            'sex': 'M',
            'weight_kg': 8.5,
            'height_cm': 72.0,
        }, format='json')
        assert resp.status_code == 401

    def test_predict_validates_input(self, client, chw):
        client.force_authenticate(user=chw)
        # Missing required fields — should return 400 validation error
        resp = client.post(reverse('ml-predict-malnutrition'), {}, format='json')
        assert resp.status_code in [400, 422]

    def test_predict_validates_ranges(self, client, chw, child):
        client.force_authenticate(user=chw)
        # weight_kg out of range (max=30)
        resp = client.post(reverse('ml-predict-malnutrition'), {
            'child_id': str(child.id),
            'age_months': 12,
            'sex': 'M',
            'weight_kg': 50.0,
            'height_cm': 72.0,
        }, format='json')
        assert resp.data['success'] is False


@pytest.mark.django_db
class TestGrowthPrediction:
    def test_predict_growth_needs_2_records(self, client, chw, child):
        client.force_authenticate(user=chw)
        resp = client.post(reverse('ml-predict-growth'), {
            'child_id': str(child.id),
        }, format='json')
        # Should fail gracefully with insufficient data
        assert resp.status_code in [200, 422]

    def test_predict_growth_with_records(self, client, chw, child):
        # Create 2 health records for the child
        HealthRecordFactory(
            child=child,
            measurement_date=date.today() - timedelta(days=30),
            weight_kg=7.5, height_cm=68.0,
            weight_for_height_z=-1.0,
        )
        HealthRecordFactory(
            child=child,
            measurement_date=date.today(),
            weight_kg=8.0, height_cm=70.0,
            weight_for_height_z=-0.5,
        )
        client.force_authenticate(user=chw)
        resp = client.post(reverse('ml-predict-growth'), {
            'child_id': str(child.id),
        }, format='json')
        assert resp.status_code == 200
        assert resp.data['success'] is True
        data = resp.data['data']
        assert 'predicted_whz_30d' in data
        assert 'risk_flag' in data
        assert data['method'] in ['linear_extrapolation', 'neural_network', 'rf_regression']


@pytest.mark.django_db
class TestVaccinationPrediction:
    def test_predict_vaccination_requires_auth(self, client, child):
        resp = client.post(reverse('ml-predict-vaccination'), {
            'child_id': str(child.id),
            'vaccine_id': '00000000-0000-0000-0000-000000000001',
        }, format='json')
        assert resp.status_code == 401

    def test_predict_vaccination_validates_input(self, client, chw):
        client.force_authenticate(user=chw)
        resp = client.post(reverse('ml-predict-vaccination'), {}, format='json')
        assert resp.data['success'] is False


@pytest.mark.django_db
class TestMLPredictionLog:
    def test_prediction_log_model(self):
        from apps.ml_engine.models import MLPredictionLog
        child = ChildFactory()
        log = MLPredictionLog.objects.create(
            child=child,
            model_name='malnutrition',
            model_version='v1',
            input_data={'test': True},
            output_data={'predicted_status': 'NORMAL'},
            predicted_label='NORMAL',
            confidence=0.95,
        )
        assert log.id is not None
        assert log.model_name == 'malnutrition'
        assert log.confidence == 0.95
