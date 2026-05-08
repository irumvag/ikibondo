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
    # Broadcast
    BROADCAST = 'BROADCAST', 'Broadcast message'
    # Vaccination lifecycle
    VACCINATION_DONE = 'VACCINATION_DONE', 'Vaccination successfully administered'
    # Visit request lifecycle
    VISIT_REQUEST_CREATED = 'VISIT_REQUEST_CREATED', 'New visit request from parent'
    VISIT_REQUEST_ACCEPTED = 'VISIT_REQUEST_ACCEPTED', 'Visit request accepted by CHW'
    VISIT_REQUEST_DECLINED = 'VISIT_REQUEST_DECLINED', 'Visit request declined'
    VISIT_REQUEST_COMPLETED = 'VISIT_REQUEST_COMPLETED', 'Visit completed'


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


class BroadcastScope(models.TextChoices):
    CAMP = 'CAMP', 'Entire Camp'
    ZONE = 'ZONE', 'Specific Zone'
    ROLE = 'ROLE', 'All users of a role'
    GLOBAL = 'GLOBAL', 'All users (Admin only)'


class Broadcast(BaseModel):
    """
    A message sent to a group of users by a supervisor or admin.
    Deliveries are tracked in BroadcastDelivery.
    """
    created_by = models.ForeignKey(
        'accounts.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        related_name='broadcasts',
    )
    scope_type = models.CharField(max_length=10, choices=BroadcastScope.choices)
    # Optional scope FK — camp ID, zone ID, or role string
    scope_id = models.CharField(max_length=100, blank=True, help_text='Camp/Zone UUID or role string')
    channel = models.CharField(max_length=10, choices=NotificationChannel.choices, default=NotificationChannel.PUSH)
    body = models.TextField()
    scheduled_for = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Broadcast({self.scope_type}, {self.created_at})'


class BroadcastDelivery(BaseModel):
    """One delivery row per recipient per broadcast."""
    broadcast = models.ForeignKey(Broadcast, on_delete=models.CASCADE, related_name='deliveries')
    recipient = models.ForeignKey('accounts.CustomUser', on_delete=models.CASCADE, related_name='received_broadcasts')
    status = models.CharField(max_length=10, choices=NotificationStatus.choices, default=NotificationStatus.PENDING)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [['broadcast', 'recipient']]
