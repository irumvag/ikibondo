from django.db import models
from django.core.exceptions import ValidationError
from apps.core.models import BaseModel


class Camp(BaseModel):
    """
    A displacement camp. All children and staff are assigned to a camp.
    Camps are subdivided into CampZones for coordinator-level scoping.
    """
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, unique=True, default='')
    district = models.CharField(max_length=100)
    province = models.CharField(max_length=100)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    estimated_population = models.PositiveIntegerField(default=0)
    managing_body = models.CharField(max_length=100, default='MINEMA/UNHCR', blank=True)
    status = models.CharField(
        max_length=20,
        choices=[('active', 'Active'), ('closed', 'Closed'), ('transitioning', 'Transitioning')],
        default='active',
    )
    # Keep capacity for backward-compat with existing queries
    capacity = models.PositiveIntegerField(default=0, help_text='Maximum registered children capacity')

    class Meta:
        ordering = ['name']
        verbose_name = 'Camp'
        verbose_name_plural = 'Camps'

    def __str__(self):
        return f'{self.name} ({self.code})'

    @property
    def active_children_count(self):
        return self.children.filter(is_active=True).count()


class CampZone(BaseModel):
    """A geographic sub-division of a camp. Supervisors are scoped to one or more zones."""
    camp = models.ForeignKey(Camp, on_delete=models.CASCADE, related_name='zones')
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20)
    description = models.TextField(blank=True)
    estimated_households = models.PositiveIntegerField(default=0)
    estimated_population = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=20,
        choices=[('active', 'Active'), ('inactive', 'Inactive')],
        default='active',
    )

    class Meta:
        ordering = ['camp', 'name']
        verbose_name = 'Camp Zone'
        unique_together = [('camp', 'code')]

    def __str__(self):
        return f'{self.camp.name} / {self.name}'


class ZoneCoordinatorAssignment(BaseModel):
    """Links a SUPERVISOR user to one or more zones. One user can supervise multiple zones."""
    user = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.CASCADE, related_name='coordinator_assignments'
    )
    zone = models.ForeignKey(CampZone, on_delete=models.CASCADE, related_name='coordinators')
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.SET_NULL, null=True, related_name='zone_assignments_made'
    )
    status = models.CharField(
        max_length=20,
        choices=[('active', 'Active'), ('inactive', 'Inactive'), ('transferred', 'Transferred')],
        default='active',
    )

    class Meta:
        ordering = ['-assigned_at']
        verbose_name = 'Zone Coordinator Assignment'
        unique_together = [('user', 'zone')]

    def __str__(self):
        return f'{self.user.full_name} → {self.zone}'


class CHWZoneAssignment(BaseModel):
    """Links a CHW to exactly one active zone at a time."""
    chw_user = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.CASCADE, related_name='chw_zone_assignments'
    )
    zone = models.ForeignKey(CampZone, on_delete=models.CASCADE, related_name='chws')
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.SET_NULL, null=True, related_name='chw_assignments_made'
    )
    status = models.CharField(
        max_length=20,
        choices=[('active', 'Active'), ('inactive', 'Inactive'), ('transferred', 'Transferred')],
        default='active',
    )

    class Meta:
        ordering = ['-assigned_at']
        verbose_name = 'CHW Zone Assignment'

    def clean(self):
        if self.status == 'active' and self.pk is None:
            existing = CHWZoneAssignment.objects.filter(chw_user=self.chw_user, status='active')
            if existing.exists():
                raise ValidationError('A CHW can only have one active zone assignment at a time.')

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.chw_user.full_name} → {self.zone}'
