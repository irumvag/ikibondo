"""
Train Growth Trajectory Predictor — Model 2

Architecture: LSTM (Keras) trained on time-series sequences of child measurements.
Predicts next-step WHZ and flags children at risk of significant deterioration.

Fallback for children with < 3 measurements: linear regression on last 2 points.

Usage:
    python ml/scripts/train_growth.py

Output:
    ml/models/growth_lstm_v1.h5            — Keras LSTM model
    ml/models/growth_lstm_v1_scaler.pkl    — input feature scaler
    ml/models/growth_lstm_v1_metadata.json — architecture + metrics
"""
import json
import warnings
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
warnings.filterwarnings('ignore')

# Lazy imports for optional TF dependency
try:
    import tensorflow as tf
    from tensorflow import keras
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    print('TensorFlow not available. Install with: pip install tensorflow>=2.15')

DATA_DIR = Path(__file__).parent.parent / 'data' / 'processed'
MODELS_DIR = Path(__file__).parent.parent / 'models'
MODELS_DIR.mkdir(exist_ok=True)

SEQUENCE_FEATURES = ['age_months', 'sex_binary', 'weight_kg', 'height_cm', 'whz']
TARGET_COL = 'risk_flag'
SEQ_LEN = 3          # Use last 3 measurements as input sequence
BATCH_SIZE = 64
EPOCHS = 50


def load_data():
    path = DATA_DIR / 'growth_series_synthetic.csv'
    if not path.exists():
        raise FileNotFoundError(
            f'Growth series data not found at {path}. '
            'Run ml/scripts/generate_synthetic_data.py first.'
        )
    df = pd.read_csv(path)
    print(f'Loaded {len(df)} growth series records')
    return df


def build_sequences(df: pd.DataFrame, seq_len: int = SEQ_LEN):
    """
    Convert per-child time-series into fixed-length input sequences for the LSTM.

    For each child with >= seq_len measurements, we create overlapping windows
    of length seq_len, each predicting the risk_flag of the last step.
    """
    X_seqs, y_labels = [], []

    for child_id, group in df.groupby('child_id'):
        group = group.sort_values('measurement_seq')
        if len(group) < seq_len + 1:
            continue

        features = group[SEQUENCE_FEATURES].values
        labels = group[TARGET_COL].values

        for i in range(len(group) - seq_len):
            X_seqs.append(features[i:i + seq_len])
            y_labels.append(labels[i + seq_len - 1])

    X = np.array(X_seqs, dtype=np.float32)
    y = np.array(y_labels, dtype=np.float32)
    return X, y


def build_lstm_model(seq_len: int, n_features: int) -> 'keras.Model':
    """
    Two-layer LSTM with dropout for regularisation.
    Output: sigmoid probability for risk_flag (binary).
    """
    model = keras.Sequential([
        keras.layers.LSTM(64, return_sequences=True,
                          input_shape=(seq_len, n_features)),
        keras.layers.Dropout(0.2),
        keras.layers.LSTM(32, return_sequences=False),
        keras.layers.Dropout(0.2),
        keras.layers.Dense(16, activation='relu'),
        keras.layers.Dense(1, activation='sigmoid'),
    ])
    model.compile(
        optimizer='adam',
        loss='binary_crossentropy',
        metrics=['accuracy', keras.metrics.AUC(name='auc')]
    )
    return model


def main():
    print('=== Ikibondo — Growth Trajectory LSTM Training ===\n')

    if not TF_AVAILABLE:
        print('TensorFlow not installed. Skipping LSTM training.')
        print('Install: pip install tensorflow>=2.15')
        return

    df = load_data()
    X, y = build_sequences(df)
    print(f'Sequences: {X.shape} | Risk rate: {y.mean():.1%}')

    # Normalise input features
    from sklearn.preprocessing import StandardScaler
    n_samples, seq_len, n_features = X.shape
    X_flat = X.reshape(-1, n_features)
    scaler = StandardScaler()
    X_scaled_flat = scaler.fit_transform(X_flat)
    X_scaled = X_scaled_flat.reshape(n_samples, seq_len, n_features)

    # Train/val/test split
    n = len(X_scaled)
    idx = np.random.default_rng(42).permutation(n)
    train_end = int(n * 0.70)
    val_end = int(n * 0.85)
    X_train = X_scaled[idx[:train_end]]
    y_train = y[idx[:train_end]]
    X_val = X_scaled[idx[train_end:val_end]]
    y_val = y[idx[train_end:val_end]]
    X_test = X_scaled[idx[val_end:]]
    y_test = y[idx[val_end:]]

    print(f'Train: {len(X_train)} | Val: {len(X_val)} | Test: {len(X_test)}')

    model = build_lstm_model(seq_len, n_features)
    model.summary()

    early_stop = keras.callbacks.EarlyStopping(
        monitor='val_auc', patience=8, mode='max', restore_best_weights=True
    )

    print('\nTraining LSTM...')
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        callbacks=[early_stop],
        verbose=1,
    )

    # Evaluate
    print('\n=== Test Set Evaluation ===')
    test_results = model.evaluate(X_test, y_test, verbose=0)
    test_loss, test_acc, test_auc = test_results
    print(f'Loss: {test_loss:.4f} | Accuracy: {test_acc:.4f} | AUC: {test_auc:.4f}')

    # Save model and scaler
    model_path = MODELS_DIR / 'growth_lstm_v1.h5'
    scaler_path = MODELS_DIR / 'growth_lstm_v1_scaler.pkl'
    metadata_path = MODELS_DIR / 'growth_lstm_v1_metadata.json'

    model.save(str(model_path))
    joblib.dump(scaler, scaler_path)
    print(f'\nModel saved: {model_path}')
    print(f'Scaler saved: {scaler_path}')

    metadata = {
        'model_name': 'growth_lstm_v1',
        'algorithm': 'LSTM (2 layers: 64, 32 units)',
        'sequence_length': seq_len,
        'input_features': SEQUENCE_FEATURES,
        'output': 'risk_flag (binary: 1 = at risk of WHZ drop > 0.8 SD)',
        'test_accuracy': round(float(test_acc), 4),
        'test_auc': round(float(test_auc), 4),
        'epochs_trained': len(history.history['loss']),
    }
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f'Metadata saved: {metadata_path}')
    print('\n✓ Growth model training complete.')


if __name__ == '__main__':
    main()
