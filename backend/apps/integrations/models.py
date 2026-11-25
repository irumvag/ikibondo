from django.db import models

from apps.core.models import BaseModel


class DHIS2SyncFailure(BaseModel):
    """
    A child or vaccination that could not be pushed to DHIS2. Kept until a later
    push succeeds, so admins can see what is missing nationally and retry it.
    """
    OBJECT_CHILD = 'child'
    OBJECT_VACCINATION = 'vaccination'

    object_type = models.CharField(max_length=20, choices=[(OBJECT_CHILD, 'Child'), (OBJECT_VACCINATION, 'Vaccination')])
    object_id = models.UUIDField()
    label = models.CharField(max_length=200)
    error = models.TextField()
    attempts = models.PositiveIntegerField(default=1)
    last_attempt_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-last_attempt_at']
        indexes = [models.Index(fields=['object_type', 'object_id'])]

    def __str__(self):
        return f'{self.object_type} {self.label}: {self.error[:60]}'
