from django.db import models
from apps.core.models import BaseModel


class ReferralStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    ACCEPTED = 'ACCEPTED', 'Accepted at facility'
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'


class Referral(BaseModel):
    """
    A child referral from a CHW or nurse to another facility.
    outcome is filled in once the referred facility confirms the visit.
    """
    child = models.ForeignKey(
        'children.Child',
        on_delete=models.CASCADE,
        related_name='referrals',
    )
    referring_user = models.ForeignKey(
        'accounts.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        related_name='issued_referrals',
    )
    target_facility = models.CharField(max_length=255, help_text='Name or identifier of receiving facility')
    reason = models.TextField()
    status = models.CharField(
        max_length=10, choices=ReferralStatus.choices, default=ReferralStatus.PENDING
    )
    outcome = models.TextField(blank=True)
    referred_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-referred_at']

    def __str__(self):
        return f'Referral({self.child}, {self.target_facility}, {self.status})'
