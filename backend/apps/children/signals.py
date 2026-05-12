"""
Signals for the children app.

post_save on Child → async DHIS2 push for new registrations.
"""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender='children.Child')
def on_child_created(sender, instance, created, **kwargs):
    """Push newly registered children to DHIS2 (non-blocking Celery task)."""
    if not created:
        return
    if instance.dhis2_uid:
        return  # already synced (e.g. pulled from DHIS2)
    try:
        from apps.integrations.tasks import dhis2_push_child
        dhis2_push_child.apply_async(args=[str(instance.id)], countdown=5)
        logger.info('Queued DHIS2 push for child %s', instance.registration_number)
    except Exception as exc:
        # Never crash the registration flow — DHIS2 sync is best-effort
        logger.warning('Failed to queue DHIS2 push for child %s: %s', instance.id, exc)
