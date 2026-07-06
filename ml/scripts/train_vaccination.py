"""
Train Vaccination Dropout Predictor — Model 3

Algorithm: Random Forest with calibrated probabilities.
Predicts whether a child will miss their next scheduled vaccination dose.

Usage:
    python ml/scripts/train_vaccination.py

Output:
    ml/models/vaccination_rf_v1.pkl          — CalibratedClassifierCV (Random Forest)
    ml/models/vaccination_rf_v1_metadata.json
"""
import json
import warnings
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    classification_report, roc_auc_score,
    precision_recall_curve, average_precision_score
)
warnings.filterwarnings('ignore')

DATA_DIR = Path(__file__).parent.parent / 'data' / 'processed'
MODELS_DIR = Path(__file__).parent.parent / 'models'
MODELS_DIR.mkdir(exist_ok=True)

FEATURE_COLS = [
    'age_months',
    'previous_missed_doses',
    'distance_km',
    'guardian_age',
    'num_siblings',
    'nutrition_status',
    'days_since_last_visit',
]
TARGET_COL = 'missed'


def load_data():
    path = DATA_DIR / 'vaccination_synthetic.csv'
    if not path.exists():
        raise FileNotFoundError(
            f'Vaccination data not found at {path}. '
            'Run ml/scripts/generate_synthetic_data.py first.'
        )
    df = pd.read_csv(path)
    print(f'Loaded {len(df)} vaccination records')
    print(f'Dropout rate: {df[TARGET_COL].mean():.1%}')
    return df


def main():
    print('=== Ikibondo — Vaccination Dropout Predictor Training ===\n')

    df = load_data()
    X = df[FEATURE_COLS]
    y = df[TARGET_COL]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, stratify=y, random_state=42
    )
    print(f'Train: {len(X_train)} | Test: {len(X_test)}')

    # Random Forest with class_weight='balanced' to handle class imbalance
    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=12,
        min_samples_leaf=10,
        class_weight='balanced',
        random_state=42,
        n_jobs=-1,
    )

    # Calibrate probabilities for more reliable risk scores
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('model', CalibratedClassifierCV(rf, cv=5, method='isotonic')),
    ])

    print('Training Random Forest with probability calibration...')
    pipeline.fit(X_train, y_train)

    # Evaluation
    y_proba = pipeline.predict_proba(X_test)[:, 1]
    y_pred = (y_proba >= 0.5).astype(int)

    auc = roc_auc_score(y_test, y_proba)
    avg_precision = average_precision_score(y_test, y_proba)

    print('\n=== Classification Report ===')
    print(classification_report(y_test, y_pred, target_names=['On time', 'Missed']))
    print(f'ROC-AUC: {auc:.4f}')
    print(f'Average Precision: {avg_precision:.4f}')

    # Feature importance (from base RF before calibration)
    try:
        base_rf = pipeline.named_steps['model'].calibrated_classifiers_[0].estimator
        importances = pd.Series(base_rf.feature_importances_, index=FEATURE_COLS)
        print('\n=== Feature Importance ===')
        print(importances.sort_values(ascending=False).to_string())
    except Exception:
        pass

    # Risk tier distribution on test set
    tier_labels = pd.cut(y_proba, bins=[-0.01, 0.35, 0.65, 1.01], labels=['LOW', 'MEDIUM', 'HIGH'])
    print('\n=== Risk Tier Distribution (test set) ===')
    print(tier_labels.value_counts())

    # Save
    model_path = MODELS_DIR / 'vaccination_rf_v1.pkl'
    metadata_path = MODELS_DIR / 'vaccination_rf_v1_metadata.json'

    joblib.dump(pipeline, model_path)
    print(f'\nModel saved: {model_path}')

    metadata = {
        'model_name': 'vaccination_rf_v1',
        'algorithm': 'Random Forest + Isotonic Calibration',
        'feature_names': FEATURE_COLS,
        'classes': ['on_time', 'missed'],
        'risk_tiers': {'LOW': '< 0.35', 'MEDIUM': '0.35-0.65', 'HIGH': '> 0.65'},
        'test_roc_auc': round(float(auc), 4),
        'test_avg_precision': round(float(avg_precision), 4),
    }
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f'Metadata saved: {metadata_path}')
    print('\n✓ Vaccination dropout model training complete.')


if __name__ == '__main__':
    main()
