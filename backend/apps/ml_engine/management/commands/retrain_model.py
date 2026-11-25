"""
python manage.py retrain_model

Pulls HealthRecords with a confirmed risk_level, retrains the classifier,
compares metrics against the previous model, and replaces saved_models/ files
if the new model is at least as good.
"""
import logging
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Retrain the risk classifier using confirmed health record data'

    def add_arguments(self, parser):
        parser.add_argument('--min-records', type=int, default=500,
                            help='Minimum records needed before retraining (default 500)')
        parser.add_argument('--force', action='store_true',
                            help='Retrain even if record count is below minimum')

    def handle(self, *args, **options):
        from apps.health_records.models import HealthRecord
        from apps.ml_engine.features import FEATURE_NAMES, build_feature_vector

        qs = HealthRecord.objects.filter(risk_level__isnull=False, is_active=True).select_related('child')
        count = qs.count()
        self.stdout.write(f'Found {count} labelled health records.')

        if count < options['min_records'] and not options['force']:
            self.stdout.write(self.style.WARNING(
                f'Not enough records ({count} < {options["min_records"]}). '
                'Use --force to retrain anyway.'
            ))
            return

        # Build feature matrix from real records
        import numpy as np
        rows, labels = [], []
        for record in qs:
            fv = build_feature_vector(record)
            if fv is None:
                continue
            rows.append([fv[f] for f in FEATURE_NAMES])
            labels.append(record.risk_level)

        if len(rows) < 50:
            self.stdout.write(self.style.ERROR('Too few valid feature vectors. Aborting.'))
            return

        X = np.array(rows, dtype=np.float32)
        y = np.array(labels)
        self.stdout.write(f'Built feature matrix: {X.shape}')

        # Load old metrics for comparison
        import json
        from pathlib import Path
        saved_dir = Path(__file__).resolve().parents[4] / 'saved_models'
        old_metrics = {}
        meta_path = saved_dir / 'model_metadata.json'
        if meta_path.exists():
            with open(meta_path) as f:
                old_metrics = json.load(f)
            self.stdout.write(f'Old model: macro_f1={old_metrics.get("macro_f1")} high_recall={old_metrics.get("high_recall")}')

        # Retrain
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import f1_score, recall_score
        from datetime import datetime

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, stratify=y, random_state=42)
        rf = RandomForestClassifier(n_estimators=300, max_depth=20, min_samples_leaf=5,
                                    class_weight='balanced_subsample', random_state=42, n_jobs=-1)
        rf.fit(X_train, y_train)

        y_pred = rf.predict(X_test)
        macro_f1 = f1_score(y_test, y_pred, average='macro')
        high_recall = recall_score(y_test, y_pred, labels=['HIGH'], average='macro', zero_division=0)

        self.stdout.write(f'New model: macro_f1={macro_f1:.3f} high_recall={high_recall:.3f}')

        old_f1 = float(old_metrics.get('macro_f1', 0))
        if macro_f1 < old_f1 - 0.05:
            self.stdout.write(self.style.WARNING(
                f'New model is worse (F1 {macro_f1:.3f} vs {old_f1:.3f}). Not replacing.'
            ))
            return

        import joblib
        version = f'v{datetime.now().strftime("%Y%m%d-%H%M")}'
        joblib.dump(rf, saved_dir / 'ikibondo_rf_pipeline.joblib')
        metadata = {
            'version': version,
            'trained_at': datetime.now().isoformat(),
            'n_train': int(len(X_train)),
            'macro_f1': round(float(macro_f1), 4),
            'high_recall': round(float(high_recall), 4),
            'source': 'real_records',
        }
        with open(meta_path, 'w') as f:
            json.dump(metadata, f, indent=2)

        # Reload the singleton
        from apps.ml_engine.prediction_service import PredictionService
        PredictionService._loaded = False
        PredictionService.load()

        self.stdout.write(self.style.SUCCESS(f'Model retrained and loaded (version: {version})'))
