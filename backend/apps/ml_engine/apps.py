from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)


class MlEngineConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.ml_engine'
    label = 'ml_engine'

    def ready(self):
        """Load ML models into memory when Django starts up."""
        from .loader import ModelLoader
        from .prediction_service import PredictionService
        try:
            ModelLoader.load_all()
        except Exception as e:
            logger.warning('Legacy ML models could not be loaded at startup: %s', e)
        try:
            PredictionService.load()
        except Exception as e:
            logger.warning('Risk prediction service could not be loaded at startup: %s', e)
