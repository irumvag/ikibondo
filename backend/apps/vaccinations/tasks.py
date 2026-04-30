"""Celery tasks for the vaccinations app."""
from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task
def send_vaccination_reminders():
    """
    Daily task (runs at 8am Kigali time) — find upcoming scheduled doses
    and generate notifications for CHWs assigned to those children's camps.

    Also runs the vaccination dropout ML model on each upcoming dose to
    flag high-risk children so CHWs can prioritise outreach.
    """
    from django.utils import timezone
    from datetime import timedelta
    from .models import VaccinationRecord, DoseStatus

    today = timezone.now().date()
    upcoming_window = today + timedelta(days=3)

    upcoming = VaccinationRecord.objects.filter(
        status=DoseStatus.SCHEDULED,
        scheduled_date__gte=today,
        scheduled_date__lte=upcoming_window,
    ).select_related('child__camp', 'vaccine')

    logger.info('Processing %d upcoming vaccinations for reminders', upcoming.count())

    for record in upcoming:
        # Run dropout prediction
        try:
            from apps.ml_engine.loader import ModelLoader
            model = ModelLoader.get('vaccination')
            if model:
                child = record.child
                features = {
                    'age_months': child.age_months,
                    'previous_missed_doses': child.vaccinations.filter(status=DoseStatus.MISSED).count(),
                    'distance_km': _estimate_distance(child),
                    'guardian_age': _guardian_age(child),
                    'num_siblings': _num_siblings(child),
                    'nutrition_status': _nutrition_code(child),
                    'days_since_last_visit': _days_since_last_visit(child),
                }
                import pandas as pd
                X = pd.DataFrame([features])
                prob = float(model.predict_proba(X)[0][1])
                tier = 'HIGH' if prob > 0.65 else ('MEDIUM' if prob > 0.35 else 'LOW')
                VaccinationRecord.objects.filter(id=record.id).update(
                    dropout_probability=round(prob, 3),
                    dropout_risk_tier=tier
                )
                if tier == 'HIGH':
                    _notify_chw_for_vaccination(record, prob)
        except Exception as e:
            logger.warning('Dropout prediction failed for record %s: %s', record.id, e)


def _days_since_last_visit(child) -> int:
    from django.utils import timezone
    last = child.health_records.order_by('-measurement_date').first()
    if not last:
        return 999
    return (timezone.now().date() - last.measurement_date).days


def _estimate_distance(child) -> float:
    """Estimate distance to health facility. Default 3.5km (camp average)."""
    # TODO: Replace with actual distance from Guardian/Camp data when available
    return 3.5


def _guardian_age(child) -> int:
    """Get guardian age estimate. Default 28 if not available."""
    # TODO: Add date_of_birth to Guardian model for accurate calculation
    return 28


def _num_siblings(child) -> int:
    """Count siblings (other children with same guardian in same camp)."""
    if hasattr(child, 'guardian') and child.guardian:
        from apps.children.models import Child
        return Child.objects.filter(
            guardian=child.guardian, is_active=True
        ).exclude(id=child.id).count()
    return 2  # default assumption


def _nutrition_code(child) -> int:
    """Get numeric nutrition status from last health record."""
    last = child.health_records.order_by('-measurement_date').first()
    if not last:
        return 0
    return {'NORMAL': 0, 'MAM': 1, 'SAM': 2}.get(last.nutrition_status, 0)


def _notify_chw_for_vaccination(record, probability: float):
    """Create a notification for the CHW assigned to this child's camp."""
    from apps.notifications.models import Notification, NotificationType
    camp = record.child.camp
    for staff in camp.staff.filter(is_active=True):
        Notification.objects.create(
            recipient=staff,
            child=record.child,
            notification_type=NotificationType.VACCINATION_REMINDER,
            message=(
                f'{record.child.full_name} is due for {record.vaccine.name} on '
                f'{record.scheduled_date}. High dropout risk ({probability:.0%}).'
            )
        )
