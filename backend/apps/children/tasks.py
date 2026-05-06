"""
Celery tasks for the children app.
"""
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


@shared_task(name='children.purge_scheduled_deletions')
def purge_scheduled_deletions():
    """
    Permanently delete children whose 3-day grace period has expired.
    Scheduled via Celery Beat to run daily.

    Children with deletion_requested_at set more than 3 days ago are hard-deleted.
    All related records (health records, vaccinations, notes, etc.) are CASCADE-deleted
    by the database because the child FK is defined with on_delete=CASCADE on those models.
    """
    from .models import Child

    cutoff = timezone.now() - timedelta(days=3)
    due_for_deletion = Child.objects.filter(
        deletion_requested_at__isnull=False,
        deletion_requested_at__lte=cutoff,
    )

    count = due_for_deletion.count()
    if count == 0:
        logger.info('purge_scheduled_deletions: nothing to purge.')
        return 0

    names = list(due_for_deletion.values_list('full_name', 'registration_number'))
    due_for_deletion.delete()

    logger.info(
        'purge_scheduled_deletions: permanently deleted %d children: %s',
        count, names,
    )
    return count
