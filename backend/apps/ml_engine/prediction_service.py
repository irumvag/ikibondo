"""
PredictionService — thread-safe singleton that loads the Ikibondo risk model
and SHAP TreeExplainer once at Django startup.

Usage:
    from apps.ml_engine.prediction_service import PredictionService
    result = PredictionService.predict(feature_dict)
    # result: {risk_level, confidence, top_factors, model_version} or None on failure
"""
import json
import logging
import threading
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

_RISK_CLASSES = ['LOW', 'MEDIUM', 'HIGH']
_DEFAULT_THRESHOLDS = {'LOW': 0.5, 'MEDIUM': 0.5, 'HIGH': 0.3}


class _PredictionServiceImpl:
    def __init__(self):
        self._lock = threading.Lock()
        self._model = None
        self._explainer = None
        self._feature_names: List[str] = []
        self._thresholds: Dict[str, float] = _DEFAULT_THRESHOLDS
        self._model_version = 'unknown'
        self._loaded = False

    def _models_dir(self) -> Path:
        return Path(__file__).resolve().parent / 'saved_models'

    def load(self):
        with self._lock:
            if self._loaded:
                return
            self._do_load()

    def reload(self):
        """Drop the loaded model and load whatever is deployed now (after promote / rollback)."""
        with self._lock:
            self._model = None
            self._explainer = None
            self._feature_names = []
            self._thresholds = _DEFAULT_THRESHOLDS
            self._model_version = 'unknown'
            self._loaded = False
            self._do_load()

    def _deployed_artifact(self, models_dir: Path):
        """
        The model file chosen in the registry (MLModelVersion, model_name='malnutrition').
        Returns (model_path, metadata_path, version) or None to use the bundled default.
        """
        try:
            from .models import MLModelVersion
            v = MLModelVersion.objects.filter(model_name='malnutrition', deployed=True, is_active=True).first()
        except Exception:  # table missing during migrations / tests without DB
            return None
        if v is None or not v.file_path:
            return None
        model_path = (models_dir / v.file_path).resolve()
        # Only files inside saved_models/ may be loaded
        if models_dir.resolve() not in model_path.parents or not model_path.exists():
            logger.error('Deployed model %s points at a missing or invalid file: %s', v.version, v.file_path)
            return None
        return model_path, model_path.with_suffix('.json'), v.version

    def _do_load(self):
        models_dir = self._models_dir()
        pipeline_path = models_dir / 'ikibondo_rf_pipeline.joblib'
        thresholds_path = models_dir / 'thresholds.joblib'
        feature_names_path = models_dir / 'feature_names.json'
        metadata_path = models_dir / 'model_metadata.json'

        deployed = self._deployed_artifact(models_dir)
        if deployed is not None:
            pipeline_path, version_meta, self._model_version = deployed
            if version_meta.exists():
                # A registered model carries its own thresholds and column order
                try:
                    with open(version_meta) as f:
                        meta = json.load(f)
                    self._thresholds = meta.get('thresholds', _DEFAULT_THRESHOLDS)
                    self._feature_names = meta.get('feature_names', [])
                except Exception:
                    pass
            # Skip the bundled default's side files; the registered model's own metadata was read above
            thresholds_path = feature_names_path = metadata_path = Path('/nonexistent')

        if not pipeline_path.exists():
            logger.warning(
                'Risk model not found at %s. Predictions will be skipped until '
                'you run: python -m apps.ml_engine.training.train_model', pipeline_path
            )
            return

        try:
            import joblib
            self._model = joblib.load(pipeline_path)
            logger.info('Risk model loaded from %s', pipeline_path)
        except Exception as e:
            logger.error('Failed to load risk model: %s', e)
            return

        # Load thresholds (optional — fall back to defaults)
        if thresholds_path.exists():
            try:
                import joblib
                self._thresholds = joblib.load(thresholds_path)
            except Exception:
                pass

        # Load feature names
        if feature_names_path.exists():
            try:
                with open(feature_names_path) as f:
                    self._feature_names = json.load(f)
            except Exception:
                pass

        if not self._feature_names:
            from apps.ml_engine.features import FEATURE_NAMES
            self._feature_names = FEATURE_NAMES

        # Load model metadata for version string
        if metadata_path.exists():
            try:
                with open(metadata_path) as f:
                    meta = json.load(f)
                    self._model_version = meta.get('version', 'v1')
            except Exception:
                pass

        # Build SHAP explainer (TreeExplainer is efficient for RF)
        try:
            import shap
            self._explainer = shap.TreeExplainer(self._model)
            logger.info('SHAP TreeExplainer initialised.')
        except ImportError:
            logger.warning('shap not installed — SHAP explanations disabled.')
        except Exception as e:
            logger.warning('SHAP init failed: %s', e)

        self._loaded = True

    def predict(self, features: Dict[str, float]) -> Optional[Dict]:
        if not self._loaded:
            self.load()
        if self._model is None:
            return None

        try:
            import pandas as pd
            import numpy as np

            # Build input row aligned to feature_names
            row = {f: features.get(f, 0.0) for f in self._feature_names}
            X = pd.DataFrame([row])[self._feature_names]

            proba = self._model.predict_proba(X)[0]
            classes = list(self._model.classes_)

            # Map probabilities to our standard risk classes
            proba_dict = {}
            for cls, p in zip(classes, proba):
                proba_dict[str(cls)] = float(p)

            # Apply custom thresholds (lower HIGH threshold to boost recall)
            risk_level = _apply_thresholds(proba_dict, self._thresholds)
            confidence = proba_dict.get(risk_level, float(max(proba)))

            top_factors = self._explain(X, features, risk_level)

            return {
                'risk_level': risk_level,
                'confidence': round(confidence, 3),
                'top_factors': top_factors,
                'model_version': self._model_version,
            }
        except Exception as e:
            logger.exception('Prediction error: %s', e)
            return None

    def _explain(self, X, original_features: Dict, risk_level: str) -> List[Dict]:
        if self._explainer is None:
            return []
        try:
            import numpy as np
            shap_values = self._explainer.shap_values(X)

            # For multiclass RF, SHAP 0.40+ returns ndarray (n_samples, n_features, n_classes)
            # Older versions returned list of (n_samples, n_features) per class.
            import numpy as np
            classes = list(self._model.classes_)
            class_idx = classes.index(risk_level) if risk_level in classes else 0
            if isinstance(shap_values, list):
                # Old SHAP API: list of arrays, one per class
                sv = shap_values[class_idx][0]
            elif len(np.array(shap_values).shape) == 3:
                # New SHAP API: (n_samples, n_features, n_classes)
                sv = shap_values[0, :, class_idx]
            else:
                sv = shap_values[0]

            feature_names = self._feature_names
            top_n = sorted(
                zip(feature_names, sv, [original_features.get(f, 0.0) for f in feature_names]),
                key=lambda x: abs(x[1]),
                reverse=True,
            )[:5]

            # SHAP values are for the predicted class: a positive value pushes towards it.
            # For HIGH/MEDIUM that means more risk; for LOW it means less.
            towards_risk = risk_level in ('HIGH', 'MEDIUM')
            return [
                {
                    'feature': name,
                    'value': float(val),
                    'impact': round(float(shap_val), 4),
                    'direction': 'increases_risk' if (shap_val > 0) == towards_risk else 'decreases_risk',
                }
                for name, shap_val, val in top_n
            ]
        except Exception as e:
            logger.debug('SHAP explanation failed: %s', e)
            return []

    @property
    def is_loaded(self) -> bool:
        return self._loaded and self._model is not None


def _apply_thresholds(proba_dict: Dict[str, float], thresholds: Dict[str, float]) -> str:
    """Pick the highest-priority risk class that meets its threshold."""
    for cls in ['HIGH', 'MEDIUM', 'LOW']:
        if proba_dict.get(cls, 0.0) >= thresholds.get(cls, 0.5):
            return cls
    # Fallback: argmax
    return max(proba_dict, key=proba_dict.get)


# Module-level singleton
PredictionService = _PredictionServiceImpl()
