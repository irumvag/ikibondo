"""
Train Malnutrition Detection Classifier — Model 1

Algorithm: XGBoost with class weighting to maximise SAM recall.
Target: SAM recall >= 0.90 (missing SAM is worse than a false positive).

Usage:
    python ml/scripts/train_malnutrition.py

Output:
    ml/models/malnutrition_v1.pkl          — sklearn Pipeline (scaler + XGBoost)
    ml/models/malnutrition_v1_metadata.json — feature names, classes, test metrics
"""
import json
import warnings
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from xgboost import XGBClassifier
warnings.filterwarnings('ignore')

DATA_DIR = Path(__file__).parent.parent / 'data' / 'processed'
MODELS_DIR = Path(__file__).parent.parent / 'models'
MODELS_DIR.mkdir(exist_ok=True)

FEATURE_COLS = [
    'age_months', 'sex_binary', 'camp_id',
    'weight_kg', 'height_cm', 'muac_cm', 'oedema',
    'whz', 'haz',
]
TARGET_COL = 'nutrition_status'
SAM_RECALL_THRESHOLD = 0.90


def load_data():
    path = DATA_DIR / 'children_synthetic.csv'
    if not path.exists():
        raise FileNotFoundError(
            f'Synthetic data not found at {path}. '
            'Run ml/scripts/generate_synthetic_data.py first.'
        )
    df = pd.read_csv(path)
    print(f'Loaded {len(df)} records. Class distribution:')
    print(df[TARGET_COL].value_counts())
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add derived features that help the model distinguish edge cases."""
    df = df.copy()
    df['age_group'] = pd.cut(df['age_months'],
                              bins=[0, 6, 12, 24, 36, 60],
                              labels=['0-6m', '6-12m', '12-24m', '24-36m', '36-60m'])
    df['age_group'] = df['age_group'].cat.codes  # encode to int
    df['wasting'] = (df['whz'] < -2).astype(int)
    df['severe_wasting'] = (df['whz'] < -3).astype(int)
    df['muac_low'] = (df['muac_cm'] < 12.5).astype(int)
    df['muac_critical'] = (df['muac_cm'] < 11.5).astype(int)
    return df


def compute_class_weights(y):
    """Give SAM higher weight so the model doesn't undercount it."""
    counts = pd.Series(y).value_counts()
    total = len(y)
    weights = {cls: total / (len(counts) * count) for cls, count in counts.items()}
    # Boost SAM weight further — missing SAM is clinically critical
    if 'SAM' in weights:
        weights['SAM'] *= 2.0
    return weights


def train_model(X_train, y_train, class_weights: dict):
    """Train XGBoost classifier with class weighting."""
    le = LabelEncoder()
    y_enc = le.fit_transform(y_train)

    # Map string class weights to integer-encoded weights per sample
    sample_weights = np.array([class_weights[c] for c in y_train])

    model = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        eval_metric='mlogloss',
        verbosity=0,
    )

    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('model', model),
    ])

    pipeline.fit(X_train, y_enc, model__sample_weight=sample_weights)

    # Attach label encoder to pipeline for convenience
    pipeline.le_ = le
    pipeline.classes_ = le.classes_

    return pipeline


def evaluate_model(pipeline, X_test, y_test):
    y_pred_enc = pipeline.predict(X_test)
    y_pred = pipeline.le_.inverse_transform(y_pred_enc)

    print('\n=== Classification Report ===')
    print(classification_report(y_test, y_pred, target_names=pipeline.classes_))

    print('=== Confusion Matrix ===')
    cm = confusion_matrix(y_test, y_pred, labels=pipeline.classes_)
    cm_df = pd.DataFrame(cm, index=pipeline.classes_, columns=pipeline.classes_)
    print(cm_df)

    # Per-class metrics
    report = classification_report(y_test, y_pred, output_dict=True)
    sam_recall = report.get('SAM', {}).get('recall', 0)
    mam_recall = report.get('MAM', {}).get('recall', 0)
    accuracy = report['accuracy']

    print(f'\nSAM recall: {sam_recall:.3f} (target >= {SAM_RECALL_THRESHOLD})')
    print(f'MAM recall: {mam_recall:.3f}')
    print(f'Overall accuracy: {accuracy:.3f}')

    return report, sam_recall


def save_model(pipeline, metrics: dict, feature_cols: list):
    model_path = MODELS_DIR / 'malnutrition_v1.pkl'
    metadata_path = MODELS_DIR / 'malnutrition_v1_metadata.json'

    joblib.dump(pipeline, model_path)
    print(f'\nModel saved: {model_path}')

    metadata = {
        'model_name': 'malnutrition_v1',
        'algorithm': 'XGBoost + StandardScaler Pipeline',
        'feature_names': feature_cols,
        'classes': pipeline.classes_.tolist(),
        'test_metrics': {
            k: {m: round(v, 4) for m, v in vals.items() if isinstance(v, float)}
            for k, vals in metrics.items()
            if isinstance(vals, dict)
        },
        'overall_accuracy': round(metrics['accuracy'], 4),
        'sam_recall': round(metrics.get('SAM', {}).get('recall', 0), 4),
    }
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f'Metadata saved: {metadata_path}')


def main():
    print('=== Ikibondo — Malnutrition Classifier Training ===\n')

    df = load_data()
    df = engineer_features(df)

    extended_features = FEATURE_COLS + ['age_group', 'wasting', 'severe_wasting', 'muac_low', 'muac_critical']
    X = df[extended_features]
    y = df[TARGET_COL]

    # Stratified split to preserve class ratios
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.15, stratify=y, random_state=42
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_train, y_train, test_size=0.15, stratify=y_train, random_state=42
    )

    print(f'Train: {len(X_train)} | Val: {len(X_val)} | Test: {len(X_test)}')

    class_weights = compute_class_weights(y_train)
    print(f'Class weights: {class_weights}')

    print('\nTraining XGBoost model...')
    pipeline = train_model(X_train, y_train, class_weights)

    report, sam_recall = evaluate_model(pipeline, X_test, y_test)

    # Hard assertion — training fails if SAM recall is below threshold
    if sam_recall < SAM_RECALL_THRESHOLD:
        raise ValueError(
            f'SAM recall {sam_recall:.3f} is below required threshold {SAM_RECALL_THRESHOLD}. '
            f'Adjust class weights or model parameters before deployment.'
        )

    print(f'\n✓ SAM recall check PASSED ({sam_recall:.3f} >= {SAM_RECALL_THRESHOLD})')
    save_model(pipeline, report, extended_features)
    print('\n✓ Training complete.')


if __name__ == '__main__':
    main()
