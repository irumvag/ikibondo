import uuid
from django.db import models
from django.utils import timezone
from apps.core.models import BaseModel


class VisitUrgency(models.TextChoices):
    ROUTINE = 'ROUTINE', 'Routine'
    SOON = 'SOON', 'Soon (within a week)'
    URGENT = 'URGENT', 'Urgent (within 24 h)'


class VisitRequestStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    ACCEPTED = 'ACCEPTED', 'Accepted'
    DECLINED = 'DECLINED', 'Declined'
    COMPLETED = 'COMPLETED', 'Completed'


class Guardian(BaseModel):
    """
    The adult responsible for a child. One guardian can have multiple children.
    We store the relationship type because it affects follow-up contact strategies.

    A guardian can optionally have a linked app account (CustomUser with role=PARENT).
    This allows them to log in and view their own children's health records.
    Workflow: Nurse registers child (Guardian created) → Nurse links PARENT user account to guardian.

    assigned_chw: set by a Supervisor to assign this family to a CHW for home visits.
    """
    full_name = models.CharField(max_length=200)
    phone_number = models.CharField(max_length=20)
    relationship = models.CharField(
        max_length=50,
        help_text='e.g. mother, father, grandmother, uncle'
    )
    national_id = models.CharField(max_length=50, blank=True)
    user = models.OneToOneField(
        'accounts.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='guardian_profile',
    )
    assigned_chw = models.ForeignKey(
        'accounts.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_guardians',
        limit_choices_to={'role': 'CHW'},
    )

    class Meta:
        ordering = ['full_name']
        verbose_name = 'Guardian'

    def __str__(self):
        return f'{self.full_name} ({self.relationship})'


class Child(BaseModel):
    """
    A child registered in the Ikibondo system.

    Registration number is auto-generated on save using camp prefix + sequential number.
    Date of birth is stored; age_months is always computed at runtime so it stays accurate.
    """
    registration_number = models.CharField(max_length=30, unique=True, blank=True)
    full_name = models.CharField(max_length=200)
    date_of_birth = models.DateField()
    sex = models.CharField(max_length=1, choices=[('M', 'Male'), ('F', 'Female')])
    camp = models.ForeignKey(
        'camps.Camp',
        on_delete=models.PROTECT,
        related_name='children'
    )
    zone = models.ForeignKey(
        'camps.CampZone',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children',
    )
    guardian = models.ForeignKey(
        Guardian,
        on_delete=models.PROTECT,
        related_name='children'
    )
    registered_by = models.ForeignKey(
        'accounts.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='registered_children'
    )
    photo = models.ImageField(upload_to='children/photos/', null=True, blank=True)
    notes = models.TextField(blank=True)
    qr_code = models.CharField(max_length=64, unique=True, blank=True, db_index=True)

    class Meta:
        ordering = ['full_name']
        verbose_name = 'Child'
        verbose_name_plural = 'Children'

    def __str__(self):
        return f'{self.full_name} ({self.registration_number})'

    @property
    def age_months(self):
        """Compute child's age in complete months from date_of_birth to today."""
        today = timezone.now().date()
        dob = self.date_of_birth
        months = (today.year - dob.year) * 12 + (today.month - dob.month)
        if today.day < dob.day:
            months -= 1
        return max(months, 0)

    @property
    def age_display(self):
        months = self.age_months
        if months < 12:
            return f'{months} months'
        years = months // 12
        rem = months % 12
        return f'{years}y {rem}m' if rem else f'{years} years'

    def save(self, *args, **kwargs):  # noqa: D401
        if not self.qr_code:
            self.qr_code = uuid.uuid4().hex
        if not self.registration_number:
            # Generate: IKB-<CAMP_SHORT>-<YEAR>-<SEQUENCE>
            # Use max existing sequence to avoid UNIQUE collisions on retry or concurrent saves.
            prefix = self.camp.name[:3].upper() if self.camp_id else 'IKB'
            year = timezone.now().year
            import re
            pattern = f'IKB-{prefix}-{year}-'
            existing = Child.objects.filter(
                registration_number__startswith=pattern
            ).values_list('registration_number', flat=True)
            max_seq = 0
            for rn in existing:
                m = re.search(r'-(\d+)$', rn)
                if m:
                    max_seq = max(max_seq, int(m.group(1)))
            self.registration_number = f'IKB-{prefix}-{year}-{max_seq + 1:04d}'
        super().save(*args, **kwargs)


class VisitRequest(BaseModel):
    """
    A parent-initiated request for a home visit by the assigned CHW.
    Lifecycle: PENDING → ACCEPTED / DECLINED → COMPLETED.
    Urgency informs CHW prioritisation; URGENT declined requests notify the supervisor.
    """
    child = models.ForeignKey(
        Child,
        on_delete=models.CASCADE,
        related_name='visit_requests',
    )
    requested_by = models.ForeignKey(
        'accounts.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_visit_requests',
    )
    urgency = models.CharField(
        max_length=10, choices=VisitUrgency.choices, default=VisitUrgency.ROUTINE
    )
    concern_text = models.TextField(blank=True)
    symptom_flags = models.JSONField(default=list, blank=True,
        help_text='List of symptom strings e.g. ["fever","diarrhea"]')
    status = models.CharField(
        max_length=10, choices=VisitRequestStatus.choices, default=VisitRequestStatus.PENDING
    )
    # Set when a CHW accepts
    assigned_chw = models.ForeignKey(
        'accounts.CustomUser',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='accepted_visit_requests',
        limit_choices_to={'role': 'CHW'},
    )
    eta = models.DateTimeField(null=True, blank=True,
        help_text='Estimated time of arrival provided by the CHW')
    decline_reason = models.TextField(blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Visit Request'

    def __str__(self):
        return f'VisitRequest({self.child.full_name}, {self.status}, {self.urgency})'
