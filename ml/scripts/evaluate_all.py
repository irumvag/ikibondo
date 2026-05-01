"""
Evaluate all trained Ikibondo ML models and print a summary report.

Usage:
    python ml/scripts/evaluate_all.py
"""
import json
import sys
import pickle
import numpy as np
import pandas as pd
from pathlib import Path

_SCRIPTS_DIR = Path(__file__).parent
sys.path.insert(0, str(_SCRIPTS_DIR))
import train_malnutrition_simple as _tm
import train_vaccination_simple as _tv
import __main__ as _main
for _a in ('MalnutritionPipeline', 'SimpleDecisionTree', '_Node', 'engineer_features'):
    setattr(_main, _a, getattr(_tm, _a))
for _a in ('VaccinationPipeline', 'LogisticRegressionNP'):
    setattr(_main, _a, getattr(_tv, _a))
try:
    import train_growth_simple as _tg
    for _a in ('GrowthPipeline', 'GrowthNeuralNetwork'):
        setattr(_main, _a, getattr(_tg, _a))
except ImportError:
    pass

MODELS_DIR = Path(__file__).parent.parent / 'models'
DATA_DIR = Path(__file__).parent.parent / 'data' / 'processed'


def _load_pickle(path):
    with open(path, 'rb') as f:
        return pickle.load(f)


def clf_report(y_true, y_pred, classes):
    report = {}
    for c in classes:
        tp = np.sum((y_pred == c) & (y_true == c))
        fp = np.sum((y_pred == c) & (y_true != c))
        fn = np.sum((y_pred != c) & (y_true == c))
        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0.0
        report[c] = {'precision': float(prec), 'recall': float(rec),
                     'f1': float(f1), 'support': int(tp + fn)}
    report['accuracy'] = float(np.mean(y_pred == y_true))
    return report


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


def evaluate_malnutrition():
    print('\n[1] Malnutrition Classifier')
    pkl = MODELS_DIR / 'malnutrition_v1.pkl'
    if not pkl.exists():
        print('    WARNING: malnutrition_v1.pkl not found.')
        return None
    model = _load_pickle(pkl)
    df = _tm.engineer_features(pd.read_csv(DATA_DIR / 'children_synthetic.csv'))
    features = ['age_months', 'sex_binary', 'camp_id', 'weight_kg', 'height_cm',
                'muac_cm', 'oedema', 'whz', 'haz',
                'age_group', 'wasting', 'severe_wasting', 'muac_low', 'muac_critical']
    y_all = df['nutrition_status'].values
    classes = np.unique(y_all)
    rng = np.random.default_rng(42)
    test_idx = []
    for c in classes:
        idx = np.where(y_all == c)[0]
        rng.shuffle(idx)
        test_idx.extend(idx[:int(len(idx) * 0.15)])
    test_idx = np.array(test_idx)
    X_test = df[features].iloc[test_idx]
    y_test = y_all[test_idx]
    y_pred = model.predict(X_test)
    report = clf_report(y_test, y_pred, classes)
    sam_recall = report.get('SAM', {}).get('recall', 0.0)
    acc = report['accuracy']
    pass_str = 'PASS' if sam_recall >= 0.90 else 'FAIL'
    print('    Accuracy:   %.3f' % acc)
    print('    SAM Recall: %.3f  (%s target>=0.90)' % (sam_recall, pass_str))
    for c in sorted(classes):
        r = report[c]
        print('      %-8s  P=%.3f  R=%.3f  F1=%.3f  n=%d' % (c, r['precision'], r['recall'], r['f1'], r['support']))
    return {'sam_recall': sam_recall, 'pass': sam_recall >= 0.90, 'accuracy': acc}


def check_growth():
    print('\n[2] Growth Trajectory Predictor')
    nn_pkl = MODELS_DIR / 'growth_nn_v1.pkl'
    if nn_pkl.exists():
        nn_meta_path = MODELS_DIR / 'growth_nn_v1_metadata.json'
        if nn_meta_path.exists():
            meta = json.load(open(nn_meta_path))
            print('    Model:         %s' % meta['algorithm'])
            print('    Test Accuracy: %.4f' % meta['test_accuracy'])
            print('    Test AUC:      %.4f' % meta['test_auc'])
            print('    Precision:     %s' % meta.get('test_precision', 'n/a'))
            print('    Recall:        %s' % meta.get('test_recall', 'n/a'))
            return meta
    h5 = MODELS_DIR / 'growth_lstm_v1.h5'
    if not h5.exists():
        print('    WARNING: No growth model found.')
        return None
    meta = json.load(open(MODELS_DIR / 'growth_lstm_v1_metadata.json'))
    print('    Test Accuracy: %.4f' % meta['test_accuracy'])
    print('    Test AUC:      %.4f' % meta['test_auc'])
    return meta


def evaluate_vaccination():
    print('\n[3] Vaccination Dropout Predictor')
    pkl = MODELS_DIR / 'vaccination_rf_v1.pkl'
    if not pkl.exists():
        print('    WARNING: vaccination_rf_v1.pkl not found.')
        return None
    model = _load_pickle(pkl)
    df = pd.read_csv(DATA_DIR / 'vaccination_synthetic.csv')
    features = ['age_months', 'previous_missed_doses', 'distance_km',
                'guardian_age', 'num_siblings', 'nutrition_status', 'days_since_last_visit']
    y_all = df['missed'].values.astype(float)
    rng = np.random.default_rng(42)
    idx = rng.permutation(len(df))
    test_idx = idx[:int(len(df) * 0.20)]
    X_test = df[features].iloc[test_idx]
    y_test = y_all[test_idx]
    y_proba = model.predict_proba(X_test)[:, 1]
    y_pred = (y_proba >= 0.5).astype(int)
    auc = roc_auc(y_test, y_proba)
    acc = float(np.mean(y_pred == y_test))
    tp = np.sum((y_pred == 1) & (y_test == 1))
    fp = np.sum((y_pred == 1) & (y_test == 0))
    fn = np.sum((y_pred == 0) & (y_test == 1))
    prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    print('    Accuracy:   %.4f' % acc)
    print('    Precision:  %.4f' % prec)
    print('    Recall:     %.4f' % rec)
    print('    ROC-AUC:    %.4f' % auc)
    return {'auc': auc, 'accuracy': acc}


def main():
    print('=' * 50)
    print('Ikibondo ML Models - Evaluation Report')
    print('=' * 50)
    m = evaluate_malnutrition()
    g = check_growth()
    v = evaluate_vaccination()
    print('\n' + '=' * 50)
    print('SUMMARY')
    print('=' * 50)
    ok = True
    if m:
        status = 'READY' if m['pass'] else 'NEEDS RETRAINING'
        print('Malnutrition model: %s  (SAM recall=%.3f, acc=%.3f)' % (status, m['sam_recall'], m['accuracy']))
        if not m['pass']:
            ok = False
    else:
        print('Malnutrition model: NOT TRAINED')
        ok = False
    if g:
        print('Growth model:       READY (AUC=%.3f)' % g['test_auc'])
    else:
        print('Growth model:       NOT TRAINED')
    if v:
        print('Vaccination model:  READY (AUC=%.3f, acc=%.3f)' % (v['auc'], v['accuracy']))
    else:
        print('Vaccination model:  NOT TRAINED')
        ok = False
    print()
    if ok:
        print('All critical models ready for deployment.')
        sys.exit(0)
    else:
        print('Some critical models failed or are not trained yet.')
        sys.exit(1)


if __name__ == '__main__':
    main()
