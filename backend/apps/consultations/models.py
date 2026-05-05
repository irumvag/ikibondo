from django.db import models
from apps.core.models import BaseModel


class ConsultationStatus(models.TextChoices):
    OPEN = 'OPEN', 'Open'
    RESOLVED = 'RESOLVED', 'Resolved'
    ESCALATED = 'ESCALATED', 'Escalated'


class Consultation(BaseModel):
    """CHW opens a consultation about a child; assigned nurse replies."""
    child = models.ForeignKey(
        'children.Child',
        on_delete=models.CASCADE,
        related_name='consultations',
    )
    opened_by = models.ForeignKey(
        'accounts.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        related_name='opened_consultations',
    )
    assigned_nurse = models.ForeignKey(
        'accounts.CustomUser',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='assigned_consultations',
        limit_choices_to={'role__in': ['NURSE', 'SUPERVISOR', 'ADMIN']},
    )
    status = models.CharField(
        max_length=10, choices=ConsultationStatus.choices, default=ConsultationStatus.OPEN
    )
    helpful_rating = models.PositiveSmallIntegerField(null=True, blank=True)
    disputed_classification = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Consultation({self.child}, {self.status})'


class ConsultationMessage(BaseModel):
    consultation = models.ForeignKey(
        Consultation,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    author = models.ForeignKey(
        'accounts.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        related_name='consultation_messages',
    )
    body = models.TextField()
    attachments = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'Message({self.consultation_id}, {self.author})'
