"""
SHAP TreeExplainer wrapper for the Ikibondo risk classifier.

Usage:
    python -m apps.ml_engine.explainability.shap_explainer
    -> generates shap_summary.png and shap_bar.png in figures/
"""
import json
import sys
from pathlib import Path

_HERE = Path(__file__).resolve()
_BACKEND = _HERE.parents[3]   # backend/
sys.path.insert(0, str(_BACKEND))

_ML_ENGINE = _HERE.parents[1]  # apps/ml_engine/
SAVED_MODELS_DIR = _ML_ENGINE / 'saved_models'
FIGURES_DIR = _ML_ENGINE / 'figures'
FIGURES_DIR.mkdir(exist_ok=True)


def load_explainer():
    import joblib
    import shap
    model_path = SAVED_MODELS_DIR / 'ikibondo_rf_pipeline.joblib'
    if not model_path.exists():
        raise FileNotFoundError(f'Model not found: {model_path}')
    model = joblib.load(model_path)
    explainer = shap.TreeExplainer(model)
    return model, explainer


def explain_prediction(features_dict: dict) -> dict:
    """
    Given a feature dict, returns:
    {
      risk_level, confidence,
      top_factors: [{feature, value, impact, direction}, ...]
    }
    """
    import pandas as pd
    import numpy as np
    from apps.ml_engine.prediction_service import PredictionService

    # Use the singleton so we don't re-load the model
    return PredictionService.predict(features_dict)


def generate_summary_plots():
    """Generate SHAP summary and bar plots from a sample of the dataset."""
    import pandas as pd
    import shap
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    data_dir = _ML_ENGINE / 'data'
    sample_file = data_dir / 'ikibondo_dataset_1k.csv'
    if not sample_file.exists():
        print(f'Sample file not found: {sample_file}')
        print('Run: python -m apps.ml_engine.data.generate_dataset')
        return

    from apps.ml_engine.features import FEATURE_NAMES
    df = pd.read_csv(sample_file)
    X = df[FEATURE_NAMES]

    model, explainer = load_explainer()
    print('Computing SHAP values...')
    shap_values = explainer.shap_values(X)

    # For multiclass RF, shap_values is a list — use HIGH class (index 0 or find it)
    classes = list(model.classes_)
    high_idx = classes.index('HIGH') if 'HIGH' in classes else 0
    sv_high = shap_values[high_idx] if isinstance(shap_values, list) else shap_values

    # Summary plot
    fig, ax = plt.subplots(figsize=(10, 8))
    shap.summary_plot(sv_high, X, feature_names=FEATURE_NAMES, show=False)
    plt.tight_layout()
    summary_path = FIGURES_DIR / 'shap_summary.png'
    plt.savefig(summary_path, dpi=150, bbox_inches='tight')
    plt.close()
    print(f'SHAP summary plot -> {summary_path}')

    # Bar plot (mean |SHAP|)
    fig, ax = plt.subplots(figsize=(10, 6))
    shap.summary_plot(sv_high, X, feature_names=FEATURE_NAMES, plot_type='bar', show=False)
    plt.tight_layout()
    bar_path = FIGURES_DIR / 'shap_bar.png'
    plt.savefig(bar_path, dpi=150, bbox_inches='tight')
    plt.close()
    print(f'SHAP bar plot -> {bar_path}')


if __name__ == '__main__':
    generate_summary_plots()
