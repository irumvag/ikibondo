"""
ML model loader — loads trained model artifacts into memory at Django startup.

Models are stored as class variables so they survive across requests without
being reloaded. This is safe because Django's WSGI workers are long-lived.

If a model file doesn't exist (e.g. Phase 2 training not yet done),
the loader skips it silently. Prediction views check for None before calling.
"""
import logging
import sys
from pathlib import Path
from django.conf import settings

logger = logging.getLogger(__name__)


def _ensure_pipeline_classes_importable():
    """
    Add ml/scripts/ to sys.path so that 'pipeline_classes' is importable.
    pickle uses the module name stored in the pkl file ('pipeline_classes')
    to resolve MalnutritionPipeline / VaccinationPipeline at load time.
    Silently skipped if the path is already present or the module is not found.
    """
    try:
        scripts_dir = str(Path(__file__).resolve().parents[3] / 'ml' / 'scripts')
        if scripts_dir not in sys.path:
            sys.path.insert(0, scripts_dir)
        # Eagerly import so the module is cached in sys.modules before pickle needs it
        import pipeline_classes  # noqa: F401
        logger.debug('pipeline_classes registered for pickle deserialization.')
    except Exception as exc:
        logger.debug('pipeline_classes not found (%s) — OK in production with sklearn.', exc)


class ModelLoader:
    _models: dict = {}

    @classmethod
    def load_all(cls):
        """Load all available trained models from ML_MODELS_DIR."""
        # Must happen BEFORE any pickle.load calls
        _ensure_pipeline_classes_importable()

        models_dir = Path(settings.ML_MODELS_DIR)

        # Model 1: Malnutrition classifier (scikit-learn or pure-numpy pipeline)
        cls._load_joblib('malnutrition', models_dir / 'malnutrition_v1.pkl')

        # Model 2: Growth trajectory predictor
        # Try lightweight NN first (no TensorFlow needed), fall back to Keras LSTM
        cls._load_joblib('growth', models_dir / 'growth_nn_v1.pkl')
        if cls._models.get('growth') is None:
            cls._load_keras('growth', models_dir / 'growth_lstm_v1.h5')

        # Model 3: Vaccination dropout predictor (scikit-learn or pure-numpy pipeline)
        cls._load_joblib('vaccination', models_dir / 'vaccination_rf_v1.pkl')

        loaded = [k for k, v in cls._models.items() if v is not None]
        logger.info('ML models loaded: %s', loaded if loaded else 'none (training not yet done)')

    @classmethod
    def _load_joblib(cls, name: str, path: Path):
        """
        Load a .pkl model file. Tries joblib first (preferred for sklearn models),
        falls back to pickle (works for pure-numpy models and when joblib is absent).
        """
        if path.exists():
            try:
                try:
                    import joblib
                    cls._models[name] = joblib.load(path)
                except ImportError:
                    import pickle
                    with open(path, 'rb') as f:
                        cls._models[name] = pickle.load(f)
                logger.info('Loaded %s model from %s', name, path)
            except Exception as e:
                logger.error('Failed to load %s model: %s', name, e)
                cls._models[name] = None
        else:
            cls._models[name] = None
            logger.debug('Model file not found (run training first): %s', path)

    @classmethod
    def _load_keras(cls, name: str, path: Path):
        if path.exists():
            try:
                import tensorflow as tf
                cls._models[name] = tf.keras.models.load_model(str(path))
                logger.info('Loaded %s Keras model from %s', name, path)
            except Exception as e:
                logger.error('Failed to load %s Keras model: %s', name, e)
                cls._models[name] = None
        else:
            cls._models[name] = None
            logger.debug('Keras model file not found (run training first): %s', path)

    @classmethod
    def get(cls, name: str):
        """Return the loaded model, or None if not available."""
        return cls._models.get(name)

    @classmethod
    def is_loaded(cls, name: str) -> bool:
        return cls._models.get(name) is not None
