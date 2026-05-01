from django.db import models
from apps.core.models import BaseModel


class NotificationType(models.TextChoices):
    SAM_ALERT = 'SAM_ALERT', 'SAM Alert — Severe malnutrition detected'
    HIGH_RISK_ALERT = 'HIGH_RISK_ALERT', 'High risk assessment alert'
    VACCINATION_REMINDER = 'VACCINATION_REMINDER', 'Upcoming vaccination reminder'
    VACCINATION_OVERDUE = 'VACCINATION_OVERDUE', 'Vaccination overdue'
    GROWTH_RISK = 'GROWTH_RISK', 'Growth trajectory risk detected'
    MISSED_VISIT = 'MISSED_VISIT', 'Child has not been seen recently'
    ZONE_SUMMARY = 'ZONE_SUMMARY', 'Daily zone KPI summary'
    CHW_INACTIVE = 'CHW_INACTIVE', 'CHW has been inactive'


class NotificationChannel(models.TextChoices):
    SMS = 'SMS', 'SMS'
    PUSH = 'PUSH', 'Push Notification'


class NotificationStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    SENT = 'SENT', 'Sent'
    FAILED = 'FAILED', 'Failed'


class Notification(BaseModel):
    recipient = models.ForeignKey(
        'accounts.CustomUser',
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    child = models.ForeignKey(
        'children.Child',
        on_delete=models.CASCADE,
        related_name='notifications',
        null=True, blank=True
    )
    notification_type = models.CharField(max_length=30, choices=NotificationType.choices)
    channel = models.CharField(
        max_length=10, choices=NotificationChannel.choices, default=NotificationChannel.PUSH
    )
    message = models.TextField()
    status = models.CharField(
        max_length=10, choices=NotificationStatus.choices, default=NotificationStatus.PENDING
    )
    is_read = models.BooleanField(default=False)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Notification'

    def __str__(self):
        return f'{self.notification_type} [{self.channel}] → {self.recipient.full_name}'
