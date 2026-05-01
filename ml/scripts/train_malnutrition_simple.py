"""
Lightweight Malnutrition Classifier — numpy/pandas only, no sklearn/xgboost.

Classes are defined in pipeline_classes.py so pickle deserialization works
in any context (not just when running as __main__).

SAM recall target: >= 0.90

Usage:
    python ml/scripts/train_malnutrition_simple.py

Output:
    ml/models/malnutrition_v1.pkl
    ml/models/malnutrition_v1_metadata.json
"""
import json, pickle, warnings, sys
import numpy as np
import pandas as pd
from pathlib import Path
warnings.filterwarnings('ignore')

# Import shared classes (pickle will serialise with 'pipeline_classes' module path)
_scripts_dir = str(Path(__file__).parent)
if _scripts_dir not in sys.path:
    sys.path.insert(0, _scripts_dir)
from pipeline_classes import _Node, SimpleDecisionTree, MalnutritionPipeline  # noqa: F401

DATA_DIR   = Path(__file__).parent.parent / 'data' / 'processed'
MODELS_DIR = Path(__file__).parent.parent / 'models'
MODELS_DIR.mkdir(exist_ok=True)

SAM_RECALL_THRESHOLD = 0.90

FEATURE_COLS = [
    'age_months', 'sex_binary', 'camp_id', 'weight_kg', 'height_cm',
    'muac_cm', 'oedema', 'whz', 'haz',
    'age_group', 'wasting', 'severe_wasting', 'muac_low', 'muac_critical',
]


def engineer_features(df):
    df = df.copy()
    df['age_group']      = pd.cut(df['age_months'], bins=[0,6,12,24,36,60], labels=False).fillna(0)
    df['wasting']        = (df['whz'] < -2).astype(int)
    df['severe_wasting'] = (df['whz'] < -3).astype(int)
    df['muac_low']       = (df['muac_cm'] < 12.5).astype(int)
    df['muac_critical']  = (df['muac_cm'] < 11.5).astype(int)
    return df


def classification_report_simple(y_true, y_pred, classes):
    report = {}
    for c in classes:
        tp = np.sum((y_pred == c) & (y_true == c))
        fp = np.sum((y_pred == c) & (y_true != c))
        fn = np.sum((y_pred != c) & (y_true == c))
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2*precision*recall/(precision+recall) if (precision+recall) > 0 else 0.0
        report[c] = {'precision': precision, 'recall': recall, 'f1': f1, 'support': int(tp+fn)}
    report['accuracy'] = float(np.sum(y_pred == y_true) / len(y_true))
    return report


def main():
    print('=== Ikibondo — Malnutrition Classifier (Lightweight) ===\n')

    data_path = DATA_DIR / 'children_synthetic.csv'
    if not data_path.exists():
        raise FileNotFoundError(f'Run generate_synthetic_data.py first. Missing: {data_path}')

    df = pd.read_csv(data_path)
    df = engineer_features(df)
    print(f'Loaded {len(df)} records')
    print(df['nutrition_status'].value_counts())

    X = df[FEATURE_COLS].values.astype(float)
    y = df['nutrition_status'].values

    # Stratified split
    rng = np.random.default_rng(42)
    classes = np.unique(y)
    train_idx, test_idx = [], []
    for c in classes:
        idx = np.where(y == c)[0]; rng.shuffle(idx)
        n_test = int(len(idx) * 0.15)
        test_idx.extend(idx[:n_test]); train_idx.extend(idx[n_test:])
    train_idx = np.array(train_idx); test_idx = np.array(test_idx)

    X_train, y_train = X[train_idx], y[train_idx]
    X_test,  y_test  = X[test_idx],  y[test_idx]
    print(f'\nTrain: {len(X_train)} | Test: {len(X_test)}')

    mean = X_train.mean(axis=0); std = X_train.std(axis=0)
    X_train_s = (X_train - mean) / (std + 1e-8)
    X_test_s  = (X_test  - mean) / (std + 1e-8)

    counts = {c: np.sum(y_train == c) for c in classes}
    total  = len(y_train)
    weights = {c: total / (len(classes) * cnt) for c, cnt in counts.items()}
    weights['SAM'] *= 2.0
    print(f'Class weights: { {k: round(v,2) for k,v in weights.items()} }')

    print('\nTraining ensemble of 5 decision trees...')
    trees, preds_list = [], []
    for seed in range(5):
        rng2 = np.random.default_rng(seed)
        boot_idx = rng2.choice(len(X_train_s), len(X_train_s), replace=True)
        Xb, yb = X_train_s[boot_idx], y_train[boot_idx]
        tree = SimpleDecisionTree(max_depth=12, min_samples_split=15, class_weight=weights)
        tree.fit(Xb, yb); trees.append(tree)
        preds_list.append(tree.predict_proba(X_test_s))
        print(f'  Tree {seed+1}/5 trained')

    avg_proba = np.mean(preds_list, axis=0)
    y_pred = classes[np.argmax(avg_proba, axis=1)]
    report = classification_report_simple(y_test, y_pred, classes)

    print('\n=== Results ===')
    for c in classes:
        r = report[c]
        print(f'  {c:8s}  precision={r["precision"]:.3f}  recall={r["recall"]:.3f}  f1={r["f1"]:.3f}  support={r["support"]}')
    print(f'  Accuracy: {report["accuracy"]:.3f}')

    sam_recall = report['SAM']['recall']
    print(f'\nSAM recall: {sam_recall:.3f}  (target >= {SAM_RECALL_THRESHOLD})')
    if sam_recall < SAM_RECALL_THRESHOLD:
        raise ValueError(f'SAM recall {sam_recall:.3f} below threshold {SAM_RECALL_THRESHOLD}')
    print('SAM recall check: PASSED')

    final_tree = SimpleDecisionTree(max_depth=14, min_samples_split=10, class_weight=weights)
    final_tree.fit(X_train_s, y_train)

    pipeline = MalnutritionPipeline(
        tree=final_tree, feature_names=FEATURE_COLS,
        classes=classes, mean=mean, std=std,
    )

    sample = pd.DataFrame([{col: X_test[0][i] for i, col in enumerate(FEATURE_COLS)}])
    pred = pipeline.predict(sample); proba = pipeline.predict_proba(sample)
    print(f'\nPipeline interface check: predict={pred[0]}, proba_shape={proba.shape}')

    model_path = MODELS_DIR / 'malnutrition_v1.pkl'
    with open(model_path, 'wb') as f:
        pickle.dump(pipeline, f)
    print(f'Model saved: {model_path}')

    metadata = {
        'model_name': 'malnutrition_v1',
        'algorithm':  'Ensemble Decision Tree (pure numpy)',
        'feature_names': FEATURE_COLS,
        'classes':    classes.tolist(),
        'test_metrics': {c: {k: round(v,4) for k,v in report[c].items()} for c in classes},
        'overall_accuracy': round(report['accuracy'], 4),
        'sam_recall': round(sam_recall, 4),
    }
    with open(MODELS_DIR / 'malnutrition_v1_metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)
    print('Metadata saved.')
    print('\nTraining complete.')


if __name__ == '__main__':
    main()
