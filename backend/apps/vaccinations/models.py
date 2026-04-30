from django.db import models
from apps.core.models import BaseModel


class DoseStatus(models.TextChoices):
    SCHEDULED = 'SCHEDULED', 'Scheduled'
    DONE = 'DONE', 'Done'
    MISSED = 'MISSED', 'Missed'
    SKIPPED = 'SKIPPED', 'Skipped (contraindicated)'


class Vaccine(BaseModel):
    """Master reference table for all vaccines in the Rwanda EPI schedule."""
    name = models.CharField(max_length=100)
    short_code = models.CharField(max_length=30)
    dose_number = models.PositiveSmallIntegerField(default=1)
    recommended_age_weeks = models.PositiveSmallIntegerField(default=0)
    min_interval_days = models.PositiveIntegerField(
        default=0,
        help_text='Minimum days between this dose and the previous dose of the same vaccine.'
    )
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['recommended_age_weeks', 'short_code']
        unique_together = [['short_code', 'dose_number']]
        verbose_name = 'Vaccine'

    def __str__(self):
        return f'{self.name} (Dose {self.dose_number})'


class VaccinationRecord(BaseModel):
    """
    A single scheduled or administered vaccination for a child.

    Records are created automatically when a child is registered using the
    Rwanda EPI schedule (see schedule.py). Health workers update status
    to DONE or MISSED as doses are administered or missed.
    """
    child = models.ForeignKey(
        'children.Child',
        on_delete=models.CASCADE,
        related_name='vaccinations'
    )
    vaccine = models.ForeignKey(
        Vaccine,
        on_delete=models.PROTECT,
        related_name='records'
    )
    scheduled_date = models.DateField()
    administered_date = models.DateField(null=True, blank=True)
    administered_by = models.ForeignKey(
        'accounts.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    status = models.CharField(
        max_length=20,
        choices=DoseStatus.choices,
        default=DoseStatus.SCHEDULED
    )
    batch_number = models.CharField(max_length=50, blank=True)

    # ML dropout prediction fields (populated by vaccination dropout model)
    dropout_probability = models.DecimalField(max_digits=4, decimal_places=3, null=True, blank=True)
    dropout_risk_tier = models.CharField(
        max_length=10,
        choices=[('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High')],
        null=True, blank=True
    )

    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['scheduled_date']
        verbose_name = 'Vaccination Record'

    def __str__(self):
        return f'{self.child.full_name} — {self.vaccine.name} — {self.status}'

    @property
    def is_overdue(self):
        from django.utils import timezone
        if self.status == DoseStatus.SCHEDULED:
            return self.scheduled_date < timezone.now().date()
        return False
