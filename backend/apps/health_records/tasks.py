"""
Celery tasks for health_records app.

run_malnutrition_prediction is triggered every time a new HealthRecord is saved.
It runs the ML model and writes the prediction back to the record.
"""
from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def run_malnutrition_prediction(self, health_record_id: str):
    """
    Load the malnutrition ML model, run inference on the given health record,
    and save the prediction (ml_predicted_status, ml_confidence) back to the record.

    This task is intentionally decoupled from the request/response cycle so that
    slow model loading never blocks the CHW's mobile app.
    """
    try:
        from .models import HealthRecord
        record = HealthRecord.objects.select_related('child').get(id=health_record_id)

        # ml_engine app's loader manages models in memory
        from apps.ml_engine.loader import ModelLoader
        model = ModelLoader.get('malnutrition')

        if model is None:
            logger.warning('Malnutrition model not loaded — skipping prediction for %s', health_record_id)
            return

        child = record.child
        features = {
            'age_months': child.age_months,
            'sex': 1 if child.sex == 'M' else 0,
            'weight_kg': float(record.weight_kg),
            'height_cm': float(record.height_cm),
            'muac_cm': float(record.muac_cm) if record.muac_cm else 0.0,
            'weight_for_height_z': float(record.weight_for_height_z) if record.weight_for_height_z else 0.0,
            'height_for_age_z': float(record.height_for_age_z) if record.height_for_age_z else 0.0,
        }

        import pandas as pd
        X = pd.DataFrame([features])
        predicted_class = model.predict(X)[0]
        probabilities = model.predict_proba(X)[0]
        confidence = float(max(probabilities))

        HealthRecord.objects.filter(id=health_record_id).update(
            ml_predicted_status=predicted_class,
            ml_confidence=round(confidence, 3),
        )

        # Alert if SAM detected
        if predicted_class == 'SAM':
            from apps.notifications.tasks import send_sam_alert
            send_sam_alert.delay(str(child.id), health_record_id)

        logger.info('ML prediction complete for record %s: %s (%.1f%%)',
                    health_record_id, predicted_class, confidence * 100)

    except HealthRecord.DoesNotExist:
        logger.error('HealthRecord %s not found for ML prediction', health_record_id)
    except Exception as exc:
        logger.exception('ML prediction failed for %s: %s', health_record_id, exc)
        raise self.retry(exc=exc)
