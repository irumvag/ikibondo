"""
Full evaluation suite for the trained Ikibondo risk classifier.

Generates:
  - confusion_matrix.png
  - roc_curves.png
  - pr_curves.png
  - feature_importance.png
  - class_distribution.png
  - evaluation_report.json

Usage:
    python -m apps.ml_engine.evaluation.evaluate_model
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

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


def evaluate():
    import joblib
    from sklearn.metrics import (
        classification_report, confusion_matrix,
        f1_score, recall_score, roc_auc_score,
        roc_curve, precision_recall_curve,
    )
    from sklearn.preprocessing import label_binarize

    # Load model
    model_path = SAVED_MODELS_DIR / 'ikibondo_rf_pipeline.joblib'
    if not model_path.exists():
        print(f'Model not found: {model_path}')
        sys.exit(1)
    model = joblib.load(model_path)

    # Load dataset
    data_dir = _ML_ENGINE / 'data'
    dataset_path = data_dir / 'ikibondo_dataset_100k.csv'
    if not dataset_path.exists():
        print(f'Dataset not found: {dataset_path}')
        sys.exit(1)

    from apps.ml_engine.features import FEATURE_NAMES
    df = pd.read_csv(dataset_path)
    from sklearn.model_selection import train_test_split
    _, X_temp, _, y_temp = train_test_split(
        df[FEATURE_NAMES].values, df['risk_label'].values,
        test_size=0.30, stratify=df['risk_label'].values, random_state=42
    )
    _, X_test, _, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, stratify=y_temp, random_state=42
    )

    classes = list(model.classes_)
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)

    # -- Metrics --------------------------------------------------------------─
    report = classification_report(y_test, y_pred, output_dict=True)
    macro_f1 = f1_score(y_test, y_pred, average='macro')
    weighted_f1 = f1_score(y_test, y_pred, average='weighted')
    high_recall = recall_score(y_test, y_pred, labels=['HIGH'], average='macro', zero_division=0)

    print('-- Evaluation Report --')
    print(classification_report(y_test, y_pred))
    print(f'Macro F1:      {macro_f1:.3f}')
    print(f'Weighted F1:   {weighted_f1:.3f}')
    print(f'HIGH Recall:   {high_recall:.3f}')

    # -- 1. Confusion matrix --------------------------------------------------─
    cm = confusion_matrix(y_test, y_pred, labels=classes)
    import seaborn as sns
    fig, ax = plt.subplots(figsize=(7, 5))
    sns.heatmap(cm, annot=True, fmt='d', xticklabels=classes, yticklabels=classes, cmap='Blues', ax=ax)
    ax.set_xlabel('Predicted')
    ax.set_ylabel('Actual')
    ax.set_title('Confusion Matrix')
    plt.tight_layout()
    cm_path = FIGURES_DIR / 'confusion_matrix.png'
    plt.savefig(cm_path, dpi=150)
    plt.close()
    print(f'Confusion matrix -> {cm_path}')

    # -- 2. ROC curves --------------------------------------------------------─
    y_bin = label_binarize(y_test, classes=classes)
    fig, ax = plt.subplots(figsize=(8, 6))
    auc_scores = {}
    for i, cls in enumerate(classes):
        fpr, tpr, _ = roc_curve(y_bin[:, i], y_proba[:, i])
        auc = roc_auc_score(y_bin[:, i], y_proba[:, i])
        auc_scores[cls] = round(float(auc), 4)
        ax.plot(fpr, tpr, label=f'{cls} (AUC={auc:.3f})')
    ax.plot([0, 1], [0, 1], 'k--')
    ax.set_xlabel('False Positive Rate')
    ax.set_ylabel('True Positive Rate')
    ax.set_title('ROC Curves')
    ax.legend()
    plt.tight_layout()
    roc_path = FIGURES_DIR / 'roc_curves.png'
    plt.savefig(roc_path, dpi=150)
    plt.close()
    print(f'ROC curves -> {roc_path}')

    # -- 3. Precision-Recall curves --------------------------------------------─
    fig, ax = plt.subplots(figsize=(8, 6))
    for i, cls in enumerate(classes):
        prec, rec, _ = precision_recall_curve(y_bin[:, i], y_proba[:, i])
        ax.plot(rec, prec, label=cls)
    ax.set_xlabel('Recall')
    ax.set_ylabel('Precision')
    ax.set_title('Precision-Recall Curves')
    ax.legend()
    plt.tight_layout()
    pr_path = FIGURES_DIR / 'pr_curves.png'
    plt.savefig(pr_path, dpi=150)
    plt.close()
    print(f'PR curves -> {pr_path}')

    # -- 4. Feature importance ------------------------------------------------─
    importances = model.feature_importances_
    indices = np.argsort(importances)[::-1][:15]
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.bar(range(len(indices)), importances[indices])
    ax.set_xticks(range(len(indices)))
    ax.set_xticklabels([FEATURE_NAMES[i] for i in indices], rotation=45, ha='right')
    ax.set_title('Top 15 Feature Importances')
    plt.tight_layout()
    fi_path = FIGURES_DIR / 'feature_importance.png'
    plt.savefig(fi_path, dpi=150)
    plt.close()
    print(f'Feature importance -> {fi_path}')

    # -- 5. Class distribution ------------------------------------------------─
    from collections import Counter
    counts = Counter(y_test)
    fig, ax = plt.subplots(figsize=(6, 4))
    ax.bar(counts.keys(), counts.values())
    ax.set_title('Test Set Class Distribution')
    plt.tight_layout()
    cd_path = FIGURES_DIR / 'class_distribution.png'
    plt.savefig(cd_path, dpi=150)
    plt.close()
    print(f'Class distribution -> {cd_path}')

    # -- Save report JSON ------------------------------------------------------
    eval_report = {
        'macro_f1': round(float(macro_f1), 4),
        'weighted_f1': round(float(weighted_f1), 4),
        'high_recall': round(float(high_recall), 4),
        'auc_roc': auc_scores,
        'classification_report': report,
    }
    report_path = SAVED_MODELS_DIR / 'evaluation_report.json'
    with open(report_path, 'w') as f:
        json.dump(eval_report, f, indent=2)
    print(f'\nEvaluation report -> {report_path}')

    print(f'\n-- Final summary --')
    print(f'Macro F1:    {macro_f1:.3f}  {"PASS" if macro_f1 >= 0.60 else "FAIL below target 0.60"}')
    print(f'HIGH recall: {high_recall:.3f}  {"PASS" if high_recall >= 0.75 else "FAIL below target 0.75"}')

    return eval_report


if __name__ == '__main__':
    evaluate()
