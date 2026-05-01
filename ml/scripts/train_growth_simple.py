"""
Train Growth Trajectory Predictor — Lightweight version (no TensorFlow).

Uses a pure NumPy feedforward neural network to predict risk_flag from
the last 3 measurements of a child. This is the production-friendly
alternative to the LSTM (train_growth.py) that runs without TensorFlow.

Usage:
    python ml/scripts/train_growth_simple.py

Output:
    ml/models/growth_nn_v1.pkl            — Trained neural network
    ml/models/growth_nn_v1_metadata.json  — Architecture + metrics
"""
import json
import pickle
import sys
import numpy as np
import pandas as pd
from pathlib import Path

_scripts_dir = str(Path(__file__).parent)
if _scripts_dir not in sys.path:
    sys.path.insert(0, _scripts_dir)
from pipeline_classes import GrowthNeuralNetwork, GrowthPipeline  # noqa: F401

DATA_DIR = Path(__file__).parent.parent / 'data' / 'processed'
MODELS_DIR = Path(__file__).parent.parent / 'models'
MODELS_DIR.mkdir(exist_ok=True)

SEQUENCE_FEATURES = ['age_months', 'sex_binary', 'weight_kg', 'height_cm', 'whz']
SEQ_LEN = 3




def load_and_prepare_data():
    path = DATA_DIR / 'growth_series_synthetic.csv'
    if not path.exists():
        raise FileNotFoundError(f'Data not found at {path}. Run generate_synthetic_data.py first.')

    df = pd.read_csv(path)
    print(f'Loaded {len(df)} growth records')

    X_seqs, y_labels = [], []

    for child_id, group in df.groupby('child_id'):
        group = group.sort_values('measurement_seq')
        if len(group) < SEQ_LEN + 1:
            continue

        features = group[SEQUENCE_FEATURES].values
        labels = group['risk_flag'].values

        for i in range(len(group) - SEQ_LEN):
            # Flatten sequence into single feature vector
            seq = features[i:i + SEQ_LEN].flatten()
            X_seqs.append(seq)
            y_labels.append(labels[i + SEQ_LEN - 1])

    X = np.array(X_seqs, dtype=np.float64)
    y = np.array(y_labels, dtype=np.float64)
    print(f'Sequences: {X.shape} | Risk rate: {y.mean():.1%}')
    return X, y


def roc_auc(y_true, y_score):
    desc = np.argsort(y_score)[::-1]
    yt = y_true[desc]
    pos = yt.sum()
    neg = len(yt) - pos
    if pos == 0 or neg == 0:
        return 0.5
    tpr = np.cumsum(yt) / pos
    fpr = np.cumsum(1 - yt) / neg
    return abs(float(np.trapezoid(tpr, fpr)))


def main():
    print('=' * 50)
    print('Ikibondo — Growth Risk Predictor (Lightweight NN)')
    print('=' * 50 + '\n')

    X, y = load_and_prepare_data()

    # Split
    rng = np.random.default_rng(42)
    idx = rng.permutation(len(X))
    train_end = int(len(X) * 0.70)
    val_end = int(len(X) * 0.85)
    X_train, y_train = X[idx[:train_end]], y[idx[:train_end]]
    X_val, y_val = X[idx[train_end:val_end]], y[idx[train_end:val_end]]
    X_test, y_test = X[idx[val_end:]], y[idx[val_end:]]

    print(f'Train: {len(X_train)} | Val: {len(X_val)} | Test: {len(X_test)}\n')

    # Train
    pipeline = GrowthPipeline()
    pipeline.fit(X_train, y_train, epochs=150, batch_size=64, verbose=True)

    # Evaluate on test set
    print('\n=== Test Set Evaluation ===')
    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]

    accuracy = float(np.mean(y_pred == y_test))
    auc = roc_auc(y_test, y_proba)

    tp = np.sum((y_pred == 1) & (y_test == 1))
    fp = np.sum((y_pred == 1) & (y_test == 0))
    fn = np.sum((y_pred == 0) & (y_test == 1))
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0

    print(f'Accuracy:  {accuracy:.4f}')
    print(f'ROC-AUC:   {auc:.4f}')
    print(f'Precision: {precision:.4f}')
    print(f'Recall:    {recall:.4f}')

    # Save
    model_path = MODELS_DIR / 'growth_nn_v1.pkl'
    metadata_path = MODELS_DIR / 'growth_nn_v1_metadata.json'

    with open(model_path, 'wb') as f:
        pickle.dump(pipeline, f)
    print(f'\nModel saved: {model_path} ({model_path.stat().st_size} bytes)')

    metadata = {
        'model_name': 'growth_nn_v1',
        'algorithm': 'Feedforward Neural Network (pure numpy, 15→32→16→1)',
        'sequence_length': SEQ_LEN,
        'input_features': SEQUENCE_FEATURES,
        'flattened_input_dim': SEQ_LEN * len(SEQUENCE_FEATURES),
        'output': 'risk_flag (binary: 1 = at risk of WHZ deterioration)',
        'test_accuracy': round(accuracy, 4),
        'test_auc': round(auc, 4),
        'test_precision': round(precision, 4),
        'test_recall': round(recall, 4),
    }
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f'Metadata saved: {metadata_path}')
    print('\nGrowth model training complete.')


if __name__ == '__main__':
    main()
