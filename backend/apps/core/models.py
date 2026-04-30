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
