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
