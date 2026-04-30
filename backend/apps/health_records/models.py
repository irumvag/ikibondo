from django.db import models
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
        """Auto-compute z-scores, nutrition status, zone from child before saving."""
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
