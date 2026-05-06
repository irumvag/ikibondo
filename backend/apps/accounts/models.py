"""
Custom user model for Ikibondo.

We use email as the unique identifier instead of username because:
- Health workers are identified by their professional email in Rwanda's health system.
- Email is harder to duplicate than a chosen username.

Roles determine what each user can see and do in the system:
- CHW (Community Health Worker): registers children, records measurements in the field.
- NURSE: records clinical measurements, administers vaccinations.
- SUPERVISOR: oversees a camp or district; read-only on all data, write on reports.
- ADMIN: full access including user management.
- PARENT: guardian of a registered child; read-only view of their own children.
"""
import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserRole(models.TextChoices):
    CHW = 'CHW', 'Community Health Worker'
    NURSE = 'NURSE', 'Nurse'
    SUPERVISOR = 'SUPERVISOR', 'Supervisor'
    ADMIN = 'ADMIN', 'Admin'
    PARENT = 'PARENT', 'Parent / Guardian'


class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required.')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', UserRole.ADMIN)
        extra_fields.setdefault('is_approved', True)
        return self.create_user(email, password, **extra_fields)


class CustomUser(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=200)
    role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.CHW)
    phone_number = models.CharField(max_length=20, blank=True, unique=True, null=True, db_index=True)

    # Camp assignment — null for ADMIN users who oversee multiple camps
    camp = models.ForeignKey(
        'camps.Camp',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='staff',
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_approved = models.BooleanField(default=False, help_text='Must be approved by a manager before logging in')
    must_change_password = models.BooleanField(
        default=False,
        help_text='Force the user to change their password on next login (set when admin/supervisor creates the account)',
    )
    preferred_language = models.CharField(
        max_length=5,
        choices=[('rw', 'Kinyarwanda'), ('fr', 'French'), ('en', 'English')],
        default='rw',
    )
    theme_preference = models.CharField(
        max_length=10,
        choices=[('system', 'System'), ('light', 'Light'), ('dark', 'Dark')],
        default='system',
    )
    # Notification preferences: {"sms": {"HIGH_RISK": true, "VAX_REMINDER": true}, "push": {...}}
    notification_prefs = models.JSONField(default=dict, blank=True)
    # Set when a user completes the onboarding wizard for their role
    onboarded_at = models.DateTimeField(null=True, blank=True)
    # Account suspension
    suspended_at = models.DateTimeField(null=True, blank=True)
    suspension_reason = models.TextField(blank=True)
    suspended_by = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='suspended_users',
    )
    date_joined = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['full_name']

    def __str__(self):
        return f'{self.full_name} ({self.get_role_display()})'

    @property
    def is_chw(self):
        return self.role == UserRole.CHW

    @property
    def is_nurse(self):
        return self.role == UserRole.NURSE

    @property
    def is_supervisor(self):
        return self.role == UserRole.SUPERVISOR

    @property
    def is_admin_user(self):
        return self.role == UserRole.ADMIN

    @property
    def is_parent(self):
        return self.role == UserRole.PARENT
