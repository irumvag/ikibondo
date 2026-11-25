"""Retraining learns next-visit outcomes, registers shadow models, and promotion switches the loaded model."""
from datetime import date, timedelta

import pytest
from django.core.management import call_command

from apps.camps.tests.factories import CampFactory
from apps.children.tests.factories import ChildFactory
from apps.health_records.models import HealthRecord
from apps.health_records.tests.factories import HealthRecordFactory
from apps.ml_engine.management.commands.retrain_model import build_outcome_dataset
from apps.ml_engine.models import MLModelVersion
from apps.ml_engine.prediction_service import PredictionService, _apply_thresholds


def _visit(child, days_ago, status):
    rec = HealthRecordFactory(child=child, measurement_date=date.today() - timedelta(days=days_ago))
    # Set the WHO status directly; save() would recompute it from the factory's measurements
    HealthRecord.objects.filter(pk=rec.pk).update(nutrition_status=status)
    return rec


@pytest.fixture
def isolated_models_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(PredictionService, '_models_dir', lambda: tmp_path)
    yield tmp_path
    # Leave the singleton to lazily reload the real model for other tests
    PredictionService._loaded = False
    PredictionService._model = None


@pytest.mark.django_db
class TestOutcomeDataset:
    def test_label_is_next_visit_status(self):
        child = ChildFactory(camp=CampFactory())
        _visit(child, 90, 'NORMAL')
        _visit(child, 45, 'SAM')
        rows, labels, groups = build_outcome_dataset()
        assert labels == ['HIGH']          # features from day -90, outcome from day -45
        assert groups == [str(child.id)]

    def test_pairs_outside_window_are_skipped(self):
        child = ChildFactory(camp=CampFactory())
        _visit(child, 200, 'NORMAL')
        _visit(child, 195, 'MAM')          # 5 days later: too soon to be an outcome
        _visit(child, 10, 'NORMAL')        # 185 days later: too far
        assert build_outcome_dataset()[1] == []

    def test_never_uses_model_predictions_as_labels(self):
        child = ChildFactory(camp=CampFactory())
        a = _visit(child, 90, 'NORMAL')
        b = _visit(child, 45, 'NORMAL')
        HealthRecord.objects.filter(pk__in=[a.pk, b.pk]).update(risk_level='HIGH')
        assert build_outcome_dataset()[1] == ['LOW']


@pytest.mark.django_db
def test_retrain_registers_shadow_then_promotion_loads_it(isolated_models_dir):
    camp = CampFactory()
    for i in range(12):
        child = ChildFactory(camp=camp)
        outcome = ['SAM', 'MAM', 'NORMAL'][i % 3]
        _visit(child, 100, 'NORMAL')
        _visit(child, 60, outcome)
        _visit(child, 20, outcome)

    call_command('retrain_model', '--force', '--min-examples', '1')

    version = MLModelVersion.objects.get(model_name='malnutrition')
    assert version.deployed is False                      # shadow until an admin promotes it
    assert (isolated_models_dir / version.file_path).exists()
    assert (isolated_models_dir / version.file_path).with_suffix('.json').exists()

    version.promote()
    PredictionService.reload()
    assert PredictionService.is_loaded
    assert PredictionService._model_version == version.version


def test_threshold_prefers_high_when_it_meets_its_lower_bar():
    assert _apply_thresholds({'HIGH': 0.35, 'MEDIUM': 0.4, 'LOW': 0.25}, {'HIGH': 0.3, 'MEDIUM': 0.5, 'LOW': 0.5}) == 'HIGH'


@pytest.mark.django_db
def test_shap_direction_matches_predicted_class(isolated_models_dir):
    """A factor pushing towards HIGH must be reported as increasing risk (it was inverted)."""
    import numpy as np

    class FakeExplainer:
        def shap_values(self, X):
            return np.array([[[0.0, 0.0, 0.4]]])  # one sample, one feature, classes [HIGH?]

    svc = PredictionService
    svc._explainer = FakeExplainer()
    svc._feature_names = ['waz']

    class FakeModel:
        classes_ = ['LOW', 'MEDIUM', 'HIGH']

    svc._model = FakeModel()
    factors = svc._explain(None, {'waz': -3.1}, 'HIGH')
    assert factors[0]['direction'] == 'increases_risk'


@pytest.mark.django_db
def test_export_includes_only_consented_children_and_no_identifiers(tmp_path):
    import csv
    from apps.accounts.models import ConsentRecord, UserRole
    from apps.accounts.tests.factories import UserFactory

    camp = CampFactory()
    consented = ChildFactory(camp=camp, full_name='Consented Child')
    parent = UserFactory(role=UserRole.PARENT)
    consented.guardian.user = parent
    consented.guardian.save(update_fields=['user'])
    ConsentRecord.objects.create(user=parent, granted=True)
    HealthRecordFactory(child=consented)

    other = ChildFactory(camp=camp, full_name='No Consent Child')  # no parent account → no consent
    HealthRecordFactory(child=other)

    out = tmp_path / 'visits.csv'
    call_command('export_training_data', '--out', str(out), '--salt', 'a-long-random-salt-value')
    text = out.read_text()
    rows = list(csv.DictReader(text.splitlines()))

    assert len(rows) == 1
    assert 'Consented Child' not in text and 'No Consent Child' not in text
    assert consented.guardian.phone_number not in text
    assert str(consented.id) not in text
    assert len(rows[0]['birth_month']) == 7  # YYYY-MM only
