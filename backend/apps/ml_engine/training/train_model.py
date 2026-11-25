"""
Ikibondo Risk Classifier — training pipeline.

Random Forest + SMOTE-Tomek, threshold tuning to hit:
  - Macro F1 >= 0.60
  - HIGH-risk recall >= 0.75

Usage:
    python -m apps.ml_engine.training.train_model
"""
import json
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

# Resolve paths so this runs from the backend dir or repo root
_HERE = Path(__file__).resolve()
_BACKEND = _HERE.parents[3]   # backend/
_ML_ENGINE = _HERE.parents[1]  # apps/ml_engine/
sys.path.insert(0, str(_BACKEND))

DATA_FILE = _ML_ENGINE / 'data' / 'ikibondo_dataset_100k.csv'
SAVED_MODELS_DIR = _ML_ENGINE / 'saved_models'
SAVED_MODELS_DIR.mkdir(exist_ok=True)

try:
    from apps.ml_engine.features import FEATURE_NAMES
except ImportError:
    from apps.ml_engine.features import FEATURE_NAMES  # retry after path fix


def train():
    # -- 1. Load data ----------------------------------------------------------
    if not DATA_FILE.exists():
        print(f'Dataset not found at {DATA_FILE}')
        print('Run: python -m apps.ml_engine.data.generate_dataset')
        sys.exit(1)

    print(f'Loading dataset from {DATA_FILE}...')
    df = pd.read_csv(DATA_FILE)
    print(f'  Shape: {df.shape}')
    print(f'  Classes: {df["risk_label"].value_counts().to_dict()}')

    X = df[FEATURE_NAMES].values.astype(np.float32)
    y = df['risk_label'].values

    # -- 2. Train/val/test split (70/15/15, stratified) ------------------------
    from sklearn.model_selection import train_test_split
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.30, stratify=y, random_state=42
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, stratify=y_temp, random_state=42
    )
    print(f'\nSplit: train={len(X_train)} val={len(X_val)} test={len(X_test)}')

    # -- 3. SMOTE-Tomek on training set only ----------------------------------─
    print('\nApplying SMOTE-Tomek to training set...')
    try:
        from imblearn.combine import SMOTETomek
        smt = SMOTETomek(random_state=42)
        X_train_res, y_train_res = smt.fit_resample(X_train, y_train)
        print(f'  Resampled: {len(X_train_res)} rows')
        import collections
        print(f'  Class counts: {dict(collections.Counter(y_train_res))}')
    except ImportError:
        print('  imbalanced-learn not installed — skipping SMOTE, using class_weight=balanced_subsample')
        X_train_res, y_train_res = X_train, y_train

    # -- 4. Train Random Forest ------------------------------------------------
    from sklearn.ensemble import RandomForestClassifier
    print('\nTraining Random Forest (n_estimators=300, max_depth=20)...')
    rf = RandomForestClassifier(
        n_estimators=300,
        max_depth=20,
        min_samples_leaf=5,
        class_weight='balanced_subsample',
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X_train_res, y_train_res)
    print('  Training complete.')

    # -- 5. Evaluate on test set ----------------------------------------------─
    from sklearn.metrics import classification_report, confusion_matrix, f1_score, recall_score
    print('\n-- Test set evaluation --')
    y_pred = rf.predict(X_test)
    report = classification_report(y_test, y_pred, output_dict=True)
    print(classification_report(y_test, y_pred))

    macro_f1 = f1_score(y_test, y_pred, average='macro')
    classes = list(rf.classes_)
    high_idx = classes.index('HIGH') if 'HIGH' in classes else -1
    high_recall = recall_score(y_test, y_pred, labels=['HIGH'], average='macro') if 'HIGH' in classes else 0.0

    print(f'Macro F1:      {macro_f1:.3f}  (target >= 0.60)')
    print(f'HIGH recall:   {high_recall:.3f}  (target >= 0.75)')

    # -- 6. Threshold tuning if HIGH recall < 0.75 ----------------------------
    thresholds = {'LOW': 0.5, 'MEDIUM': 0.5, 'HIGH': 0.3}  # default (low HIGH threshold)
    if high_recall < 0.75:
        print('\nTuning HIGH threshold on validation set to improve recall...')
        thresholds = _tune_thresholds(rf, X_val, y_val, classes)
        # Re-evaluate with tuned thresholds
        y_pred_tuned = _apply_thresholds_batch(rf.predict_proba(X_test), classes, thresholds)
        high_recall_tuned = recall_score(y_test, y_pred_tuned, labels=['HIGH'], average='macro')
        macro_f1_tuned = f1_score(y_test, y_pred_tuned, average='macro')
        print(f'After threshold tuning:')
        print(f'  Macro F1:    {macro_f1_tuned:.3f}')
        print(f'  HIGH recall: {high_recall_tuned:.3f}')
        high_recall = high_recall_tuned
        macro_f1 = macro_f1_tuned

    # Warn but don't fail — dataset is synthetic
    if macro_f1 < 0.60:
        print(f'\nWARNING: Macro F1 {macro_f1:.3f} is below target 0.60')
    if high_recall < 0.75:
        print(f'WARNING: HIGH recall {high_recall:.3f} is below target 0.75')

    # -- 7. Save artifacts ----------------------------------------------------─
    import joblib

    model_path = SAVED_MODELS_DIR / 'ikibondo_rf_pipeline.joblib'
    joblib.dump(rf, model_path)
    print(f'\nModel saved -> {model_path}')

    thresholds_path = SAVED_MODELS_DIR / 'thresholds.joblib'
    joblib.dump(thresholds, thresholds_path)
    print(f'Thresholds saved -> {thresholds_path}')

    feature_names_path = SAVED_MODELS_DIR / 'feature_names.json'
    with open(feature_names_path, 'w') as f:
        json.dump(FEATURE_NAMES, f, indent=2)
    print(f'Feature names saved -> {feature_names_path}')

    metadata = {
        'version': f'v{datetime.now().strftime("%Y%m%d")}',
        'trained_at': datetime.now().isoformat(),
        'n_train': int(len(X_train_res)),
        'n_test': int(len(X_test)),
        'macro_f1': round(float(macro_f1), 4),
        'high_recall': round(float(high_recall), 4),
        'class_report': report,
        'feature_names': FEATURE_NAMES,
    }
    metadata_path = SAVED_MODELS_DIR / 'model_metadata.json'
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f'Metadata saved -> {metadata_path}')

    print('\nOK Training complete.')
    return rf, thresholds


def _tune_thresholds(model, X_val, y_val, classes):
    """Lower the HIGH threshold until recall >= 0.75 or we hit 0.15."""
    from sklearn.metrics import recall_score
    probas = model.predict_proba(X_val)
    best_thresholds = {'LOW': 0.5, 'MEDIUM': 0.5, 'HIGH': 0.30}
    for high_thresh in np.arange(0.25, 0.10, -0.05):
        t = {'LOW': 0.5, 'MEDIUM': 0.5, 'HIGH': round(high_thresh, 2)}
        y_pred = _apply_thresholds_batch(probas, classes, t)
        rec = recall_score(y_val, y_pred, labels=['HIGH'], average='macro', zero_division=0)
        print(f'  HIGH thresh={high_thresh:.2f} -> recall={rec:.3f}')
        best_thresholds = t
        if rec >= 0.75:
            break
    return best_thresholds


def _apply_thresholds_batch(probas, classes, thresholds):
    """Apply per-class thresholds to a batch of probability arrays."""
    results = []
    for row in probas:
        proba_dict = {c: float(p) for c, p in zip(classes, row)}
        pred = 'LOW'
        for cls in ['HIGH', 'MEDIUM', 'LOW']:
            if proba_dict.get(cls, 0.0) >= thresholds.get(cls, 0.5):
                pred = cls
                break
        results.append(pred)
    return np.array(results)


if __name__ == '__main__':
    train()
