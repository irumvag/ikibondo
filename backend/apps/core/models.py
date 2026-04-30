"""
Shared abstract base model inherited by every model in Ikibondo.

Why UUID primary keys:
  - Safe to expose in URLs without leaking sequential record counts.
  - Merge-safe if multiple databases are ever combined.

Why soft-delete (is_active):
  - Child health records must never be permanently erased for audit/legal reasons.
  - Hard deletes would break referential integrity in health histories.
"""
import uuid
from django.db import models


class BaseModel(models.Model):
    """Abstract base providing UUID PK, timestamps, and soft-delete."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        abstract = True
        ordering = ['-created_at']

    def soft_delete(self):
        """Mark as inactive instead of deleting from the database."""
        self.is_active = False
        self.save(update_fields=['is_active', 'updated_at'])

    def restore(self):
        """Restore a soft-deleted record."""
        self.is_active = True
        self.save(update_fields=['is_active', 'updated_at'])


class SyncOperation(models.Model):
    """
    Idempotency log for offline batch sync operations submitted by CHWs.

    Each operation carries a client-generated UUID. If the same UUID is
    submitted again (e.g. due to network retry), the stored result is
    returned without re-processing.
    """
    OP_CREATE_VISIT = 'create_visit'
    OP_REGISTER_CHILD = 'register_child'
    OP_ADMINISTER_VACCINE = 'administer_vaccine'

    client_id = models.UUIDField(unique=True, db_index=True)
    user = models.ForeignKey(
        'accounts.CustomUser',
        on_delete=models.CASCADE,
        related_name='sync_operations',
    )
    op = models.CharField(max_length=30)
    status = models.CharField(max_length=10)  # ok | conflict | error
    response_data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Sync Operation'
