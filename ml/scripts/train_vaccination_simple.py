"""
Lightweight Vaccination Dropout Predictor — numpy/pandas only, no sklearn.

Uses a bootstrap ensemble of decision trees (same approach as the malnutrition
classifier) instead of logistic regression for higher AUC on imbalanced data.

Classes are defined in pipeline_classes.py for reliable pickle deserialization.

Usage:
    python ml/scripts/train_vaccination_simple.py

Output:
    ml/models/vaccination_rf_v1.pkl
    ml/models/vaccination_rf_v1_metadata.json
"""
import json, pickle, warnings, sys
import numpy as np
import pandas as pd
from pathlib import Path
warnings.filterwarnings('ignore')

_scripts_dir = str(Path(__file__).parent)
if _scripts_dir not in sys.path:
    sys.path.insert(0, _scripts_dir)
from pipeline_classes import (  # noqa: F401
    _Node, SimpleDecisionTree, VaccinationEnsemblePipeline,
)

DATA_DIR   = Path(__file__).parent.parent / 'data' / 'processed'
MODELS_DIR = Path(__file__).parent.parent / 'models'
MODELS_DIR.mkdir(exist_ok=True)

FEATURE_COLS = [
    'age_months', 'previous_missed_doses', 'distance_km',
    'guardian_age', 'num_siblings', 'nutrition_status', 'days_since_last_visit',
]
N_TREES = 7


def roc_auc_np(y_true, y_score):
    desc = np.argsort(y_score)[::-1]
    yt = y_true[desc]
    pos = yt.sum(); neg = len(yt) - pos
    if pos == 0 or neg == 0:
        return 0.5
    tpr = np.cumsum(yt) / pos
    fpr = np.cumsum(1 - yt) / neg
    return abs(float(np.trapezoid(tpr, fpr)))


def main():
    print('=== Ikibondo — Vaccination Dropout Predictor (Ensemble Trees) ===\n')

    data_path = DATA_DIR / 'vaccination_synthetic.csv'
    if not data_path.exists():
        raise FileNotFoundError(f'Run generate_synthetic_data.py first. Missing: {data_path}')

    df = pd.read_csv(data_path)
    X_raw = df[FEATURE_COLS].values.astype(float)
    y_str = np.where(df['missed'].values.astype(float) == 1, 'missed', 'on_time')
    classes = np.array(['missed', 'on_time'])
    print(f'Loaded {len(df)} records. Dropout rate: {df["missed"].mean():.1%}')

    rng = np.random.default_rng(42)
    idx = rng.permutation(len(df))
    n_test = int(len(df) * 0.20)
    train_idx, test_idx = idx[n_test:], idx[:n_test]
    X_train, y_train = X_raw[train_idx], y_str[train_idx]
    X_test,  y_test  = X_raw[test_idx],  y_str[test_idx]
    print(f'Train: {len(X_train)} | Test: {len(X_test)}')

    mean = X_train.mean(axis=0)
    std  = X_train.std(axis=0)
    X_train_s = (X_train - mean) / (std + 1e-8)
    X_test_s  = (X_test  - mean) / (std + 1e-8)

    # Balanced class weights — penalise missed-dose misses more
    counts  = {c: np.sum(y_train == c) for c in classes}
    total   = len(y_train)
    weights = {c: total / (len(classes) * cnt) for c, cnt in counts.items()}
    weights['missed'] *= 1.5
    print(f'Class weights: { {k: round(v,2) for k,v in weights.items()} }')

    print(f'\nTraining ensemble of {N_TREES} decision trees...')
    trees, preds_list = [], []
    for seed in range(N_TREES):
        rng2 = np.random.default_rng(seed + 10)
        boot_idx = rng2.choice(len(X_train_s), len(X_train_s), replace=True)
        Xb, yb = X_train_s[boot_idx], y_train[boot_idx]
        tree = SimpleDecisionTree(max_depth=10, min_samples_split=20, class_weight=weights)
        tree.fit(Xb, yb)
        trees.append(tree)
        preds_list.append(tree.predict_proba(X_test_s))
        print(f'  Tree {seed+1}/{N_TREES} trained')

    avg_proba = np.mean(preds_list, axis=0)
    missed_idx = np.where(classes == 'missed')[0][0]
    y_pred = classes[np.argmax(avg_proba, axis=1)]

    # Metrics
    tp = np.sum((y_pred == 'missed') & (y_test == 'missed'))
    fp = np.sum((y_pred == 'missed') & (y_test == 'on_time'))
    fn = np.sum((y_pred == 'on_time') & (y_test == 'missed'))
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    accuracy  = float(np.mean(y_pred == y_test))
    auc = roc_auc_np((y_test == 'missed').astype(float), avg_proba[:, missed_idx])

    print(f'\n  Accuracy:  {accuracy:.4f}')
    print(f'  Precision: {precision:.4f}')
    print(f'  Recall:    {recall:.4f}')
    print(f'  ROC-AUC:   {auc:.4f}')

    dropout_proba = avg_proba[:, missed_idx]
    tiers = pd.cut(dropout_proba, bins=[-0.01, 0.35, 0.65, 1.01], labels=['LOW', 'MEDIUM', 'HIGH'])
    print(f'\n  Risk tiers: {dict(tiers.value_counts())}')

    pipeline = VaccinationEnsemblePipeline(
        trees=trees, feature_names=FEATURE_COLS,
        classes=classes, mean=mean, std=std,
    )

    sample = pd.DataFrame([{col: X_test[0][i] for i, col in enumerate(FEATURE_COLS)}])
    p = pipeline.predict_proba(sample)[0, missed_idx]
    print(f'\nPipeline check: dropout_prob={p:.3f}  label={pipeline.predict(sample)[0]}')

    model_path = MODELS_DIR / 'vaccination_rf_v1.pkl'
    with open(model_path, 'wb') as f:
        pickle.dump(pipeline, f)
    print(f'Model saved: {model_path}')

    metadata = {
        'model_name':    'vaccination_rf_v1',
        'algorithm':     f'Ensemble Decision Tree (pure numpy, {N_TREES} trees, balanced weights)',
        'feature_names': FEATURE_COLS,
        'classes':       classes.tolist(),
        'risk_tiers':    {'LOW': '< 0.35', 'MEDIUM': '0.35-0.65', 'HIGH': '> 0.65'},
        'test_roc_auc':  round(float(auc), 4),
        'test_accuracy': round(float(accuracy), 4),
        'test_precision': round(float(precision), 4),
        'test_recall':   round(float(recall), 4),
    }
    with open(MODELS_DIR / 'vaccination_rf_v1_metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)
    print('Metadata saved.')
    print('\nVaccination model training complete.')


if __name__ == '__main__':
    main()
