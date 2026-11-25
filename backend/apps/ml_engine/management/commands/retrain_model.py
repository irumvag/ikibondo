"""
python manage.py retrain_model

Trains a risk model on real Ikibondo visits and registers it as a *shadow*
version (not deployed). An admin reviews the metrics and promotes it.

What is learned
---------------
Each training example is one visit's features, labelled with the child's
WHO-based nutrition status at their NEXT visit 21–120 days later
(SAM → HIGH, MAM → MEDIUM, NORMAL/OVERWEIGHT → LOW).

This deliberately avoids two traps in the previous version:
  * Training on HealthRecord.risk_level — the model's own predictions — which
    only teaches the model to agree with itself.
  * Labelling a visit with its own z-score status, which the features already
    contain (the model just relearns the WHO cut-offs; see docs/ml-model-card.md).

Children, not visits, are split between train and test so the score reflects
how the model does on children it has never seen.
"""
import json
import logging
from datetime import datetime, timedelta

from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)

LABEL_FROM_STATUS = {'SAM': 'HIGH', 'MAM': 'MEDIUM', 'NORMAL': 'LOW', 'OVERWEIGHT': 'LOW'}
MIN_GAP = timedelta(days=21)
MAX_GAP = timedelta(days=120)


def build_outcome_dataset():
    """
    Returns (rows, labels, groups): feature dicts for visit t, the status at visit t+1,
    and the child id for each row (used to split by child).
    """
    from apps.health_records.models import HealthRecord
    from apps.ml_engine.features import build_feature_vector

    records = (
        HealthRecord.objects.filter(is_active=True)
        .exclude(nutrition_status='')
        .select_related('child')
        .order_by('child_id', 'measurement_date')
    )
    rows, labels, groups = [], [], []
    previous = None
    for rec in records.iterator():
        if previous is not None and previous.child_id == rec.child_id:
            gap = rec.measurement_date - previous.measurement_date
            label = LABEL_FROM_STATUS.get(rec.nutrition_status)
            if label and MIN_GAP <= gap <= MAX_GAP:
                features = build_feature_vector(previous)
                if features is not None:
                    rows.append(features)
                    labels.append(label)
                    groups.append(str(rec.child_id))
        previous = rec
    return rows, labels, groups


class Command(BaseCommand):
    help = 'Train a next-visit risk model on real records and register it as a shadow version'

    def add_arguments(self, parser):
        parser.add_argument('--min-examples', type=int, default=500,
                            help='Minimum visit pairs needed (default 500)')
        parser.add_argument('--force', action='store_true', help='Train even below the minimum')

    def handle(self, *args, **options):
        import numpy as np
        import pandas as pd
        import joblib
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.metrics import average_precision_score, classification_report, f1_score, recall_score
        from sklearn.model_selection import GroupShuffleSplit

        from apps.ml_engine.features import FEATURE_NAMES
        from apps.ml_engine.models import MLModelVersion
        from apps.ml_engine.prediction_service import PredictionService

        rows, labels, groups = build_outcome_dataset()
        n = len(rows)
        self.stdout.write(f'Found {n} visit pairs (visit → next visit within 21–120 days).')
        if n < options['min_examples'] and not options['force']:
            self.stdout.write(self.style.WARNING(
                f'Not enough data ({n} < {options["min_examples"]}). Use --force to train anyway.'))
            return
        if len(set(labels)) < 2:
            self.stdout.write(self.style.ERROR('Every example has the same outcome; nothing to learn yet.'))
            return

        X = pd.DataFrame(rows)[FEATURE_NAMES].astype('float32')
        y = np.array(labels)
        split = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
        train_idx, test_idx = next(split.split(X, y, groups=groups))

        model = RandomForestClassifier(
            n_estimators=300, max_depth=12, min_samples_leaf=5,
            class_weight='balanced_subsample', random_state=42, n_jobs=-1,
        )
        model.fit(X.iloc[train_idx], y[train_idx])
        y_test = y[test_idx]
        y_pred = model.predict(X.iloc[test_idx])

        # Missing a child who will be severely malnourished is the costly error
        high_recall = recall_score(y_test, y_pred, labels=['HIGH'], average='macro', zero_division=0)
        if 'HIGH' in model.classes_ and (y_test == 'HIGH').any():
            proba_high = model.predict_proba(X.iloc[test_idx])[:, list(model.classes_).index('HIGH')]
            pr_auc_high = float(average_precision_score(y_test == 'HIGH', proba_high))
        else:
            pr_auc_high = None
        macro_f1 = float(f1_score(y_test, y_pred, average='macro', zero_division=0))

        version = datetime.now().strftime('v%Y%m%d-%H%M')
        models_dir = PredictionService._models_dir()
        model_file = f'risk_{version}.joblib'
        joblib.dump(model, models_dir / model_file)
        metadata = {
            'version': version,
            'trained_at': datetime.now().isoformat(),
            'task': 'next-visit nutrition status (21–120 days ahead)',
            'n_train': int(len(train_idx)),
            'n_test': int(len(test_idx)),
            'n_children': len(set(groups)),
            'macro_f1': round(macro_f1, 4),
            'high_recall': round(float(high_recall), 4),
            'pr_auc_high': None if pr_auc_high is None else round(pr_auc_high, 4),
            'class_report': classification_report(y_test, y_pred, output_dict=True, zero_division=0),
            'feature_names': FEATURE_NAMES,
            'thresholds': {'HIGH': 0.3, 'MEDIUM': 0.5, 'LOW': 0.5},
            'source': 'real_records',
        }
        with open(models_dir / f'risk_{version}.json', 'w') as f:
            json.dump(metadata, f, indent=2)

        MLModelVersion.objects.create(
            model_name='malnutrition',
            version=version,
            file_path=model_file,
            f1_score=round(macro_f1, 4),
            recall=round(float(high_recall), 4),
            deployed=False,
            notes=(f'Shadow model trained on {n} real visit pairs from {len(set(groups))} children. '
                   f'HIGH recall {high_recall:.2f}, PR-AUC(HIGH) {pr_auc_high}. Review before promoting.'),
        )
        self.stdout.write(self.style.SUCCESS(
            f'Registered {version} as a shadow model: macro F1 {macro_f1:.3f}, HIGH recall {high_recall:.3f}, '
            f'PR-AUC(HIGH) {pr_auc_high}. Promote it from the admin ML page once reviewed.'))
