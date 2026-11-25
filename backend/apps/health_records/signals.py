"""
Signals for health_records app.

post_save on HealthRecord triggers:
1. WHO z-score computation (inline, before ML)
2. Celery task for async ML malnutrition prediction
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import HealthRecord

logger = logging.getLogger(__name__)


@receiver(post_save, sender=HealthRecord)
def trigger_ml_prediction(sender, instance, created, **kwargs):
    """
    After a new HealthRecord is saved, queue the ML prediction task.
    Only fires on creation (not updates) to avoid infinite loops.
    """
    if not created:
        return

    # Compute z-scores inline if not already set
    if instance.weight_for_height_z is None:
        try:
            from .who_zscore import (
                compute_whz, compute_haz, compute_waz,
                classify_nutrition_status,
            )
            child = instance.child
            instance.weight_for_height_z = compute_whz(
                weight_kg=float(instance.weight_kg),
                height_cm=float(instance.height_cm),
                sex=child.sex,
            )
            instance.height_for_age_z = compute_haz(
                age_months=child.age_months,
                height_cm=float(instance.height_cm),
                sex=child.sex,
            )
            instance.weight_for_age_z = compute_waz(
                age_months=child.age_months,
                weight_kg=float(instance.weight_kg),
                sex=child.sex,
            )

            # Auto-classify nutrition status
            instance.nutrition_status = classify_nutrition_status(
                whz=instance.weight_for_height_z,
                muac_cm=float(instance.muac_cm) if instance.muac_cm else None,
                oedema=instance.oedema,
            )
            # Save z-scores without re-triggering signal
            HealthRecord.objects.filter(id=instance.id).update(
                weight_for_height_z=instance.weight_for_height_z,
                height_for_age_z=instance.height_for_age_z,
                weight_for_age_z=instance.weight_for_age_z,
                nutrition_status=instance.nutrition_status,
            )
        except Exception as e:
            logger.warning('Z-score computation failed for record %s: %s', instance.id, e)

    # Queue async ML prediction
    try:
        from .tasks import run_malnutrition_prediction
        run_malnutrition_prediction.delay(str(instance.id))
        logger.info('Queued ML prediction for HealthRecord %s', instance.id)
    except Exception as e:
        logger.warning('Failed to queue ML prediction for %s: %s', instance.id, e)


@receiver(post_save, sender=HealthRecord)
def trigger_dhis2_on_high_risk(sender, instance, created, **kwargs):
    """
    After a HealthRecord is saved with risk_level=HIGH, push child + vaccinations
    to DHIS2 asynchronously.  Fires on update (ML sets risk_level after creation).
    """
    if instance.risk_level != 'HIGH':
        return
    try:
        from apps.integrations.tasks import dhis2_push_high_risk
        dhis2_push_high_risk.apply_async(args=[str(instance.id)], countdown=10)
        logger.info('Queued DHIS2 high-risk push for HealthRecord %s', instance.id)
    except Exception as exc:
        logger.warning('Failed to queue DHIS2 high-risk push for %s: %s', instance.id, exc)
