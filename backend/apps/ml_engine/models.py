from django.db import models
from apps.core.models import BaseModel


class MLPredictionLog(BaseModel):
    """
    Audit log of every ML prediction made by the system.

    Storing inputs and outputs serves two purposes:
    1. Auditability: clinicians can review what the model saw and decided.
    2. Retraining data: labelled predictions (with eventual ground-truth outcomes)
       become training examples for the next model version.
    """
    MODEL_NAMES = [
        ('malnutrition', 'Malnutrition Classifier'),
        ('growth', 'Growth Trajectory Predictor'),
        ('vaccination', 'Vaccination Dropout Predictor'),
    ]

    child = models.ForeignKey(
        'children.Child',
        on_delete=models.CASCADE,
        related_name='ml_predictions'
    )
    model_name = models.CharField(max_length=50, choices=MODEL_NAMES)
    model_version = models.CharField(max_length=20, default='v1')
    input_data = models.JSONField(help_text='Feature values passed to the model')
    output_data = models.JSONField(help_text='Full prediction output including probabilities')
    predicted_label = models.CharField(max_length=50)
    confidence = models.DecimalField(max_digits=4, decimal_places=3)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'ML Prediction Log'

    def __str__(self):
        return f'{self.child.full_name} — {self.model_name} — {self.predicted_label}'


class MLModelVersion(BaseModel):
    """
    Registry of trained model versions.
    Only one version per model_name can be deployed=True at a time.
    Admins promote/rollback via the API.
    """
    MODEL_NAME_CHOICES = [
        ('malnutrition', 'Malnutrition Classifier'),
        ('growth', 'Growth Trajectory Predictor'),
        ('vaccination', 'Vaccination Dropout Predictor'),
    ]

    model_name = models.CharField(max_length=50, choices=MODEL_NAME_CHOICES)
    version = models.CharField(max_length=20)
    file_path = models.CharField(max_length=500, blank=True, help_text='Relative path inside ml/models/')
    f1_score = models.DecimalField(max_digits=5, decimal_places=4, null=True, blank=True)
    recall = models.DecimalField(max_digits=5, decimal_places=4, null=True, blank=True)
    precision = models.DecimalField(max_digits=5, decimal_places=4, null=True, blank=True)
    deployed = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(
        'accounts.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_ml_versions',
    )

    class Meta:
        ordering = ['-created_at']
        unique_together = [['model_name', 'version']]

    def __str__(self):
        status = '✓' if self.deployed else '○'
        return f'{status} {self.model_name} {self.version}'

    def promote(self):
        """Set this version as the active deployed version (atomic)."""
        MLModelVersion.objects.filter(model_name=self.model_name, deployed=True).exclude(id=self.id).update(deployed=False)
        self.deployed = True
        self.save(update_fields=['deployed', 'updated_at'])
