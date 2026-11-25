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

One person may hold several roles (e.g. a nurse who is also a parent). `role` is the
primary role stored on the account; `RoleGrant` rows list every role the person holds
(the primary role included). During a request `user.role` is the role the person is
currently acting as, taken from the token (see accounts/authentication.py), so every
permission check and data scope follows the active role.
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


class CustomUserQuerySet(models.QuerySet):
    def with_role(self, role):
        """Users who hold `role`, as their primary role or an extra grant."""
        return self.filter(models.Q(role=role) | models.Q(role_grants__role=role)).distinct()


class CustomUserManager(BaseUserManager.from_queryset(CustomUserQuerySet)):
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
    national_id = models.CharField(max_length=50, blank=True, null=True, unique=True, db_index=True)

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

    # ── Multiple roles ────────────────────────────────────────────────────────
    @property
    def primary_role(self):
        """The stored role, even while the user is acting as another one."""
        return getattr(self, '_primary_role', None) or self.role

    @property
    def roles(self):
        """Every role this person holds, primary first."""
        cached = getattr(self, '_roles_cache', None)
        if cached is None:
            granted = set(self.role_grants.values_list('role', flat=True)) if self.pk else set()
            others = sorted(r for r in granted if r != self.primary_role)
            cached = [self.primary_role, *others]
            self._roles_cache = cached
        return list(cached)

    def has_role(self, role):
        return role in self.roles

    def act_as(self, role):
        """Switch the in-memory active role for this request (never persisted)."""
        if role and role != self.role and self.has_role(role):
            self._primary_role = self.primary_role
            self.role = role

    def save(self, *args, **kwargs):
        # A request may have switched `role` to the active role; never write that back
        active = None
        if getattr(self, '_primary_role', None) and self._primary_role != self.role:
            active, self.role = self.role, self._primary_role
        try:
            super().save(*args, **kwargs)
        finally:
            if active:
                self.role = active
        if self.pk and not RoleGrant.objects.filter(user_id=self.pk, role=self.primary_role).exists():
            RoleGrant.objects.get_or_create(user_id=self.pk, role=self.primary_role)
            self._roles_cache = None

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


class RoleGrant(models.Model):
    """One role a person holds. Every user has a grant for their primary role."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='role_grants')
    role = models.CharField(max_length=20, choices=UserRole.choices)
    granted_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='+')
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'role')
        ordering = ['granted_at']

    def __str__(self):
        return f'{self.user_id}: {self.role}'


class ConsentRecord(models.Model):
    """
    Consent v1: single-scope "data collection & use under UNHCR policy".
    Granular consent (research, DHIS2 sharing) deferred to backlog.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='consent_records',
    )
    scope = models.CharField(
        max_length=50,
        default='data_collection',
        help_text='Consent scope identifier',
    )
    version = models.CharField(max_length=10, default='1.0')
    granted = models.BooleanField(default=True)
    granted_at = models.DateTimeField(auto_now_add=True)
    withdrawn_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-granted_at']
        verbose_name = 'Consent Record'

    def __str__(self):
        state = 'granted' if self.granted and not self.withdrawn_at else 'withdrawn'
        return f'{self.user.full_name} — {self.scope} — {state}'


class PasswordResetCode(models.Model):
    """
    One-time code for resetting a forgotten password (web and mobile).
    Only a hash of the code is stored; codes expire, are single-use, and lock after too many guesses.
    """
    MAX_ATTEMPTS = 5

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='password_reset_codes')
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Password reset for {self.user_id} ({"used" if self.used_at else "open"})'
