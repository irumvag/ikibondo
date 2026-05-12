import uuid
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from apps.core.models import BaseModel
from .who_zscore import compute_whz, compute_haz, compute_waz, classify_nutrition_status


class NutritionStatus(models.TextChoices):
    SAM = 'SAM', 'Severe Acute Malnutrition'
    MAM = 'MAM', 'Moderate Acute Malnutrition'
    NORMAL = 'NORMAL', 'Normal'
    OVERWEIGHT = 'OVERWEIGHT', 'Overweight'


class HealthRecord(BaseModel):
    """
    A single clinical measurement session for a child.

    Raw measurements (weight, height, MUAC) are recorded by the health worker.
    Z-scores and nutrition status are computed automatically on save using
    WHO 2006 Child Growth Standards.

    Both raw AND computed values are stored so:
    - Auditors can verify the classification
    - If WHO reference tables are updated, we can recompute without re-measuring
    - ML models can train on both feature types
    """
    child = models.ForeignKey(
        'children.Child',
        on_delete=models.CASCADE,
        related_name='health_records'
    )
    recorded_by = models.ForeignKey(
        'accounts.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    zone = models.ForeignKey(
        'camps.CampZone',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='health_records',
    )
    measurement_date = models.DateField()

    # --- Raw measurements ---
    weight_kg = models.DecimalField(max_digits=5, decimal_places=2,
                                     help_text='Weight in kilograms')
    height_cm = models.DecimalField(max_digits=5, decimal_places=1,
                                     help_text='Height/length in centimetres')
    muac_cm = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True,
                                   help_text='Mid-Upper Arm Circumference in cm')
    oedema = models.BooleanField(default=False,
                                  help_text='Bilateral nutritional oedema present?')

    # --- Computed WHO z-scores (auto-filled on save) ---
    weight_for_height_z = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    height_for_age_z = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    weight_for_age_z = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    # --- Classified status (auto-filled on save) ---
    nutrition_status = models.CharField(
        max_length=20,
        choices=NutritionStatus.choices,
        blank=True
    )

    # --- Additional anthropometrics ---
    head_circumference_cm = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    bmi_z = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    # --- Vital signs (manual entry or BLE IoT device) ---
    temperature_c = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True,
                                        help_text='Body temperature in °C')
    respiratory_rate = models.PositiveSmallIntegerField(null=True, blank=True,
                                                         help_text='Breaths per minute')
    heart_rate = models.PositiveSmallIntegerField(null=True, blank=True,
                                                   help_text='Beats per minute')
    spo2 = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True,
                                help_text='Blood oxygen saturation %')

    # --- Clinical symptoms ---
    symptom_flags = models.JSONField(
        default=list,
        blank=True,
        help_text='List of active symptoms: fever, cough, diarrhea, vomiting, rash, difficulty_breathing, lethargy, poor_feeding',
    )

    # --- ML risk classification (populated synchronously on POST) ---
    risk_level = models.CharField(
        max_length=10,
        choices=[('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High')],
        null=True,
        blank=True,
    )
    risk_factors = models.JSONField(default=list, blank=True,
                                    help_text='Top 5 SHAP factors from ML prediction')
    model_version = models.CharField(max_length=30, blank=True)

    # --- Legacy ML fields (kept for backward-compat) ---
    ml_predicted_status = models.CharField(max_length=20, null=True, blank=True)
    ml_confidence = models.DecimalField(max_digits=4, decimal_places=3, null=True, blank=True)
    ml_risk_flags = models.JSONField(default=dict, blank=True)

    # --- Metadata ---
    data_source = models.CharField(
        max_length=10,
        choices=[('manual', 'Manual'), ('iot', 'IoT/BLE Device')],
        default='manual',
    )

    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-measurement_date', '-created_at']
        verbose_name = 'Health Record'

    def __str__(self):
        return f'{self.child.full_name} — {self.measurement_date} — {self.nutrition_status}'

    def save(self, *args, **kwargs):
        """Auto-compute z-scores, nutrition status, and zone from child before saving."""
        from .who_zscore import compute_bmi_z
        child = self.child
        age_months = child.age_months
        sex = child.sex

        whz = compute_whz(float(self.weight_kg), float(self.height_cm), sex)
        haz = compute_haz(age_months, float(self.height_cm), sex)
        waz = compute_waz(age_months, float(self.weight_kg), sex)
        bmi = float(self.weight_kg) / ((float(self.height_cm) / 100) ** 2) if self.height_cm else None
        bmi_z_val = compute_bmi_z(age_months, bmi, sex) if bmi else None

        self.weight_for_height_z = whz
        self.height_for_age_z = haz
        self.weight_for_age_z = waz
        self.bmi_z = bmi_z_val
        self.nutrition_status = classify_nutrition_status(
            whz,
            float(self.muac_cm) if self.muac_cm else None,
            self.oedema
        )
        # Denormalize zone from child for fast zone-level queries
        if not self.zone_id and child.zone_id:
            self.zone_id = child.zone_id
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# Clinical Notes
# ---------------------------------------------------------------------------

class NoteType(models.TextChoices):
    FOLLOW_UP   = 'FOLLOW_UP',   'Follow-Up Required'
    REFERRAL    = 'REFERRAL',    'Referral'
    OBSERVATION = 'OBSERVATION', 'Observation'
    GENERAL     = 'GENERAL',     'General'


class ClinicalNote(BaseModel):
    """
    A structured clinical annotation written by a NURSE or SUPERVISOR.

    Attaches to either a specific visit (health_record FK) or a child
    longitudinally (child FK).  Exactly one target must be set — enforced
    by clean() at the application layer and a DB CHECK constraint in the
    migration as a belt-and-suspenders guard.

    is_pinned surfaces critical follow-up notes at the top of a child's
    record list without losing the chronological view of other notes.
    """
    author = models.ForeignKey(
        'accounts.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='clinical_notes',
    )
    health_record = models.ForeignKey(
        HealthRecord,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='clinical_notes',
    )
    child = models.ForeignKey(
        'children.Child',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='clinical_notes',
    )
    note_type = models.CharField(
        max_length=20,
        choices=NoteType.choices,
        default=NoteType.GENERAL,
    )
    content   = models.TextField()
    is_pinned = models.BooleanField(default=False)

    class Meta:
        ordering = ['-is_pinned', '-created_at']
        verbose_name = 'Clinical Note'
        verbose_name_plural = 'Clinical Notes'
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(health_record__isnull=False, child__isnull=True) |
                    Q(health_record__isnull=True,  child__isnull=False)
                ),
                name='clinicalnote_exactly_one_target',
            )
        ]

    def __str__(self):
        target = f'HR:{self.health_record_id}' if self.health_record_id else f'Child:{self.child_id}'
        author = self.author.full_name if self.author_id else 'unknown'
        return f'[{self.note_type}] {author} → {target}'

    def clean(self):
        has_hr    = self.health_record_id is not None
        has_child = self.child_id is not None
        if has_hr == has_child:
            raise ValidationError(
                'A clinical note must target exactly one of health_record or child, not both or neither.'
            )


class AmendmentLog(models.Model):
    """
    Clinical-record correction log.
    CHW window: 24 h from original record creation.
    Nurse: any time.
    Admin: any time.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Generic FK — points to HealthRecord or VaccinationRecord
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField()
    content_object = GenericForeignKey('content_type', 'object_id')

    amended_by = models.ForeignKey(
        'accounts.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        related_name='amendments',
    )
    reason = models.TextField()
    before_data = models.JSONField(help_text='Snapshot of fields before amendment')
    after_data = models.JSONField(help_text='Snapshot of fields after amendment')
    amended_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-amended_at']
        verbose_name = 'Amendment Log'

    def __str__(self):
        return f'Amendment on {self.content_type.model} {self.object_id} by {self.amended_by}'
