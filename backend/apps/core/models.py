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


class FAQItem(BaseModel):
    """
    Frequently-asked question shown on the public landing page.
    Supports three languages: English (default), Kinyarwanda (rw), French (fr).
    """

    question    = models.CharField(max_length=500, help_text='English')
    answer      = models.TextField(help_text='English')
    question_rw = models.CharField(max_length=500, blank=True, help_text='Kinyarwanda')
    answer_rw   = models.TextField(blank=True,                help_text='Kinyarwanda')
    question_fr = models.CharField(max_length=500, blank=True, help_text='French')
    answer_fr   = models.TextField(blank=True,                help_text='French')
    order        = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'created_at']
        verbose_name = 'FAQ Item'

    def __str__(self):
        return self.question[:80]

    def get_question(self, lang='en'):
        """Return question in `lang` (en/rw/fr), falling back to English."""
        if lang == 'rw' and self.question_rw:
            return self.question_rw
        if lang == 'fr' and self.question_fr:
            return self.question_fr
        return self.question

    def get_answer(self, lang='en'):
        """Return answer in `lang` (en/rw/fr), falling back to English."""
        if lang == 'rw' and self.answer_rw:
            return self.answer_rw
        if lang == 'fr' and self.answer_fr:
            return self.answer_fr
        return self.answer


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


class AuditLog(models.Model):
    """
    Request-level audit log for all mutation API calls.

    Captures: who did what, to which resource, from which IP, and when.
    Populated by AuditLogMiddleware for every POST/PUT/PATCH/DELETE request.
    Read-only — never modified or deleted after creation.
    """

    METHOD_CREATE = 'CREATE'
    METHOD_UPDATE = 'UPDATE'
    METHOD_DELETE = 'DELETE'
    METHOD_CHOICES = [
        (METHOD_CREATE, 'Create'),
        (METHOD_UPDATE, 'Update'),
        (METHOD_DELETE, 'Delete'),
    ]

    user = models.ForeignKey(
        'accounts.CustomUser',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='audit_logs',
        db_index=True,
    )
    user_email = models.EmailField(blank=True, help_text='Denormalised for fast display')
    action     = models.CharField(max_length=10, choices=METHOD_CHOICES, db_index=True)
    method     = models.CharField(max_length=10)         # raw HTTP method
    path       = models.CharField(max_length=500, db_index=True)
    status_code = models.PositiveSmallIntegerField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True)
    request_body = models.JSONField(null=True, blank=True,
                                    help_text='Sanitised request body (passwords/tokens stripped)')
    timestamp  = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'Audit Log'
        indexes = [
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['path', 'timestamp']),
        ]

    def __str__(self):
        return f'{self.action} {self.path} by {self.user_email} @ {self.timestamp}'
