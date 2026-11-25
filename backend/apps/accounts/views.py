import logging
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, throttle_classes

logger = logging.getLogger(__name__)
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings
from drf_spectacular.utils import extend_schema
from drf_spectacular.openapi import OpenApiTypes


class LoginThrottle(AnonRateThrottle):
    """Stricter rate limit for login attempts — 10/minute per IP."""
    scope = 'auth_login'


class RegistrationThrottle(AnonRateThrottle):
    """Rate limit for public self-registration — 10/hour per IP.

    Registration creates DB rows and sends two emails per request, so it
    needs a much tighter cap than the global anon throttle (60/minute).
    """
    scope = 'auth_register'

from apps.core.responses import success_response, created_response, error_response
from .serializers import (
    CustomTokenObtainPairSerializer,
    IdentifierAuthSerializer,
    UserProfileSerializer,
    UserCreateSerializer,
    UserRegistrationSerializer,
    ApproveUserSerializer,
    UserAdminUpdateSerializer,
    ChangePasswordSerializer,
    OrganizationSerializer,
)
from .permissions import IsAdminUser, IsSupervisorOrAdmin, IsStaffCreator, IsStaffCreatorOrNurse, IsNurseOrSupervisorOrAdmin
from .models import CustomUser, UserRole, ConsentRecord
from .security import revoke_user_tokens


class LoginView(TokenObtainPairView):
    """POST /api/v1/auth/login/ — returns JWT access + refresh + user profile."""
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [LoginThrottle]

    def post(self, request, *args, **kwargs):
        from rest_framework.exceptions import AuthenticationFailed, ValidationError
        from .security import is_locked_out, record_failed_login, clear_failed_logins

        login_id = request.data.get('identifier') or request.data.get('email') or ''
        if is_locked_out(login_id):
            return error_response(
                'Too many failed sign-in attempts. Wait 15 minutes and try again, '
                'or ask your supervisor to reset your password.',
                'LOCKED_OUT',
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # Support both the standard email/password and identifier/password flows.
        # If 'identifier' is in the payload, authenticate via PhoneOrEmailBackend first.
        if 'identifier' in request.data:
            auth_serializer = IdentifierAuthSerializer(
                data=request.data, context={'request': request}
            )
            if not auth_serializer.is_valid():
                record_failed_login(login_id)
                errors = auth_serializer.errors
                message = (errors.get('non_field_errors') or ['Enter your email or phone number and password.'])[0]
                return error_response(str(message), 'AUTH_FAILED', status_code=status.HTTP_401_UNAUTHORIZED)
            clear_failed_logins(login_id)
            user = auth_serializer.validated_data['user']
            token = CustomTokenObtainPairSerializer.get_token(user)
            data = {
                'access': str(token.access_token),
                'refresh': str(token),
                'user': UserProfileSerializer(user).data,
            }
            return success_response(data=data, message='Login successful.')

        try:
            response = super().post(request, *args, **kwargs)
        except (AuthenticationFailed, ValidationError):
            record_failed_login(login_id)
            raise
        clear_failed_logins(login_id)
        return success_response(data=response.data, message='Login successful.')


@extend_schema(exclude=True)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """POST /api/v1/auth/logout/ — blacklists the refresh token."""
    try:
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return error_response('Refresh token is required.', 'MISSING_TOKEN')
        token = RefreshToken(refresh_token)
        token.blacklist()
        return success_response(message='Logged out successfully.')
    except Exception:
        return error_response('Invalid or expired token.', 'INVALID_TOKEN')


@extend_schema(exclude=True)
@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def me_view(request):
    """
    GET  /api/v1/auth/me/ — current user profile.
    PATCH /api/v1/auth/me/ — update preferred_language or theme_preference.
    """
    if request.method == 'PATCH':
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return success_response(data=serializer.data, message='Profile updated.')
        return error_response(str(serializer.errors), 'VALIDATION_ERROR')
    return success_response(data=UserProfileSerializer(request.user).data)


@extend_schema(exclude=True)
@api_view(['POST'])
@permission_classes([AllowAny])  # public by design; throttled below
@throttle_classes([RegistrationThrottle])
def register_view(request):
    """
    POST /api/v1/auth/register/ — public self-registration.
    Regardless of the 'role' field in the payload, the account is always created as PARENT.
    Sends a 'pending' confirmation email to the registrant and an alert to supervisors/admins.
    """
    data = request.data.copy()
    # Enforce PARENT-only self-signup
    if data.get('role') and data['role'] != UserRole.PARENT:
        return error_response(
            'Self-registration is only available for parents/guardians. '
            'Health workers must be created by a supervisor or admin.',
            'ROLE_FORBIDDEN',
            status_code=status.HTTP_403_FORBIDDEN,
        )
    data['role'] = UserRole.PARENT

    serializer = UserRegistrationSerializer(data=data)
    if serializer.is_valid():
        user = serializer.save()

        # Async email: confirm to the registrant
        _send_parent_pending_email(user)

        # Async email: alert camp supervisors + all admins
        _send_pending_review_emails(user)

        return created_response(
            data=UserProfileSerializer(user).data,
            message='Registration successful. Your account is pending approval.',
        )
    return error_response(str(serializer.errors), 'VALIDATION_ERROR')


def _send_parent_pending_email(user):
    """Fire-and-forget: notify the parent their account is awaiting approval."""
    if not user.email:
        return
    try:
        from apps.accounts.emails import send_branded_email
        from apps.notifications.tasks import send_email_task
        lang = user.preferred_language or 'en'
        ctx = {'full_name': user.full_name, 'email': user.email}
        # With CELERY_TASK_ALWAYS_EAGER (dev) this runs synchronously;
        # in production Celery executes it async.
        try:
            send_email_task.delay(
                to=user.email,
                template='parent_pending',
                subject='Registration received — Ikibondo',
                context=ctx,
                language=lang,
            )
        except Exception:
            # Celery not available — send directly so dev always works
            send_branded_email(
                to=user.email,
                template='parent_pending',
                subject='Registration received — Ikibondo',
                context=ctx,
                language=lang,
            )
    except Exception:
        logger.exception('Failed to send parent_pending email to %s', user.email)


def _send_pending_review_emails(user):
    """Notify camp supervisors + all admins that a new parent needs review."""
    try:
        from apps.accounts.emails import send_branded_email
        from apps.notifications.tasks import send_email_task
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        approvals_url = f'{frontend_url}/supervisor/users'
        ctx = {
            'applicant_name': user.full_name,
            'applicant_email': user.email,
            'camp_name': user.camp.name if user.camp else '',
            'approvals_url': approvals_url,
        }
        # Supervisors in the same camp
        recipients = list(
            CustomUser.objects.with_role(UserRole.SUPERVISOR).filter(
                is_active=True, camp=user.camp
            ).values_list('email', flat=True)
        ) if user.camp else []
        # All admins
        recipients += list(
            CustomUser.objects.with_role(UserRole.ADMIN).filter(
                is_active=True
            ).values_list('email', flat=True)
        )
        for email in set(recipients):
            if not email:
                continue
            try:
                send_email_task.delay(
                    to=email,
                    template='pending_review',
                    subject='New account pending approval — Ikibondo',
                    context=ctx,
                    language='en',
                )
            except Exception:
                send_branded_email(
                    to=email,
                    template='pending_review',
                    subject='New account pending approval — Ikibondo',
                    context=ctx,
                    language='en',
                )
    except Exception:
        logger.exception('Failed to send pending_review emails for user %s', user.id)


@extend_schema(exclude=True)
@api_view(['GET', 'POST'])
@permission_classes([IsStaffCreatorOrNurse])
def create_user_view(request):
    """
    GET  /api/v1/auth/users/ — list all active users; ?role= filter supported.
                                Supervisors only see their own camp. Nurses see PARENT accounts in their camp.
    POST /api/v1/auth/users/ — create a new user account.
                                Admin: any role.
                                Supervisor: CHW or NURSE in their own camp only.
                                Nurse: PARENT only, auto-approved, scoped to nurse's camp.
    """
    if request.method == 'GET':
        include_suspended = request.query_params.get('include_suspended') == 'true'
        # Admins can view suspended accounts; others always see active only
        if request.user.role == UserRole.ADMIN and include_suspended:
            qs = CustomUser.objects.all().order_by('-date_joined')
        else:
            qs = CustomUser.objects.filter(is_active=True).order_by('-date_joined')
        if request.user.role == UserRole.NURSE:
            # Nurses see PARENT accounts in their camp
            if not request.user.camp_id:
                return success_response(data=[])
            qs = qs.with_role(UserRole.PARENT).filter(camp=request.user.camp)
        elif request.user.role == UserRole.SUPERVISOR:
            if not request.user.camp_id:
                return success_response(data=[])
            qs = qs.filter(camp=request.user.camp)
        role = request.query_params.get('role')
        if role:
            qs = qs.with_role(role)
        search = request.query_params.get('search', '').strip()
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(full_name__icontains=search) |
                Q(phone_number__icontains=search) |
                Q(email__icontains=search)
            )
        return success_response(data=UserProfileSerializer(qs, many=True).data)

    # --- POST: create user ---
    requested_role = request.data.get('role', '')
    creator_role = request.user.role

    if creator_role == UserRole.NURSE:
        # Nurses can only create PARENT accounts, auto-approved, scoped to their camp
        if requested_role != UserRole.PARENT:
            return error_response(
                'Nurses can only create parent accounts.',
                'ROLE_FORBIDDEN',
                status_code=status.HTTP_403_FORBIDDEN,
            )
        if not request.user.camp_id:
            return error_response('Your account has no camp assigned. Contact an admin.',
                                  'FORBIDDEN', status_code=status.HTTP_403_FORBIDDEN)
        data = request.data.copy()
        data['camp'] = str(request.user.camp_id)
        # A nurse may only link a guardian whose children are in her camp
        guardian_id = data.get('guardian_id')
        if guardian_id:
            from apps.children.models import Guardian
            in_camp = Guardian.objects.filter(
                id=guardian_id, children__camp_id=request.user.camp_id,
            ).exists()
            if not in_camp:
                return error_response('Guardian not found.', 'NOT_FOUND', status_code=status.HTTP_404_NOT_FOUND)
        # The nurse never chooses or sees the parent's password: the parent sets it from a link
        data.pop('password', None)
        data.pop('roles', None)  # only admins grant extra roles
        if not (data.get('email') or '').strip():
            from .account_setup import placeholder_email
            data['email'] = placeholder_email()
        serializer = UserCreateSerializer(data=data)
        if serializer.is_valid():
            user = serializer.save(is_approved=True)
            user.set_unusable_password()
            user.must_change_password = False
            user.save(update_fields=['password', 'must_change_password', 'updated_at'])
            return created_response(
                data=_with_setup_delivery(user, request.user),
                message='Parent account created. They will set their own password from the link.',
            )
        return error_response(str(serializer.errors), 'VALIDATION_ERROR')

    if creator_role == UserRole.SUPERVISOR:
        # Supervisors can only create CHW / NURSE in their own camp
        allowed_roles = (UserRole.CHW, UserRole.NURSE)
        if requested_role not in allowed_roles:
            return error_response(
                'Supervisors can only create CHW or NURSE accounts.',
                'ROLE_FORBIDDEN',
                status_code=status.HTTP_403_FORBIDDEN,
            )
        requested_camp = request.data.get('camp')
        supervisor_camp = str(request.user.camp_id) if request.user.camp_id else None
        if str(requested_camp) != supervisor_camp:
            return error_response(
                'You can only create staff for your own camp.',
                'CAMP_FORBIDDEN',
                status_code=status.HTTP_403_FORBIDDEN,
            )

    if creator_role != UserRole.ADMIN and request.data.get('roles'):
        return error_response('Only admins can give an account several roles.', 'ROLE_FORBIDDEN',
                              status_code=status.HTTP_403_FORBIDDEN)
    serializer = UserCreateSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        user = serializer.save()
        temp_password = getattr(user, '_generated_password', None)

        # Send welcome email with credentials
        _send_welcome_staff_email(user, temp_password)

        return created_response(
            data=UserProfileSerializer(user).data,
            message='User created successfully. A welcome email has been sent.',
        )
    return error_response(str(serializer.errors), 'VALIDATION_ERROR')


def _send_welcome_staff_email(user, temp_password: str):
    """Send welcome email with login credentials to a newly created staff user."""
    try:
        from apps.notifications.tasks import send_email_task
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        lang = user.preferred_language or 'en'
        send_email_task.delay(
            to=user.email,
            template='welcome_staff',
            subject='Your Ikibondo account has been created',
            context={
                'full_name': user.full_name,
                'email': user.email,
                'temp_password': temp_password or '(see your supervisor)',
                'login_url': f'{frontend_url}/login',
            },
            language=lang,
        )
    except Exception:
        pass


def _with_setup_delivery(user, nurse):
    """
    Send the parent's set-password link and describe the outcome for the nurse.
    The link itself is only returned when neither SMS nor email went out, so the
    nurse can show it as a QR code for the parent to open on their own phone.
    """
    from .account_setup import send_setup_link, setup_link
    camp = getattr(nurse, 'camp', None)
    sent = send_setup_link(user, camp_name=getattr(camp, 'name', ''))
    data = UserProfileSerializer(user).data
    data['setup_delivery'] = sent
    if not (sent['sms'] or sent['email']):
        data['setup_link'] = setup_link(user)
    return data


@extend_schema(exclude=True)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    """POST /api/v1/auth/change-password/ — authenticated user changes their own password."""
    serializer = ChangePasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return error_response(str(serializer.errors), 'VALIDATION_ERROR')

    user = request.user
    if not user.check_password(serializer.validated_data['old_password']):
        return error_response(
            'Current password is incorrect.',
            'INVALID_PASSWORD',
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError as DjangoValidationError
    try:
        validate_password(serializer.validated_data['new_password'], user=user)
    except DjangoValidationError as exc:
        return error_response(' '.join(exc.messages), 'WEAK_PASSWORD')

    user.set_password(serializer.validated_data['new_password'])
    user.must_change_password = False
    user.save(update_fields=['password', 'must_change_password', 'updated_at'])

    # Sign out every other session, then hand this one a fresh pair so the user stays signed in
    revoke_user_tokens(user)
    token = CustomTokenObtainPairSerializer.get_token(user)
    return success_response(
        data={'access': str(token.access_token), 'refresh': str(token)},
        message='Password changed successfully. Other devices have been signed out.',
    )


@extend_schema(exclude=True)
@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAdminUser])
def manage_user_view(request, user_id):
    """
    PATCH  /api/v1/auth/users/<user_id>/ — admin edits any user's profile fields.
    DELETE /api/v1/auth/users/<user_id>/ — soft-deactivate a user (sets is_active=False).
    """
    try:
        user = CustomUser.objects.get(id=user_id, is_active=True)
    except CustomUser.DoesNotExist:
        return error_response('User not found.', 'NOT_FOUND', status_code=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        if user == request.user:
            return error_response(
                'Cannot deactivate your own account.',
                'FORBIDDEN',
                status_code=status.HTTP_403_FORBIDDEN,
            )
        user.is_active = False
        user.save(update_fields=['is_active', 'updated_at'])
        revoke_user_tokens(user)
        return success_response(message=f'{user.full_name} has been deactivated.')

    serializer = UserAdminUpdateSerializer(user, data=request.data, partial=True,
                                           context={'request': request})
    if serializer.is_valid():
        serializer.save()
        for role in getattr(user, '_granted_roles', []):
            _notify_role_granted(user, role)
        return success_response(
            data=UserProfileSerializer(user).data,
            message='User updated successfully.',
        )
    return error_response(str(serializer.errors), 'VALIDATION_ERROR')


def _notify_role_granted(user, role):
    """Tell the person a role was added and how to use it (in-app + push when available)."""
    try:
        from apps.notifications.models import (
            Notification, NotificationChannel, NotificationStatus, NotificationType,
        )
        from apps.notifications.tasks import send_push
        label = UserRole(role).label
        notif = Notification.objects.create(
            recipient=user,
            notification_type=NotificationType.ROLE_GRANTED,
            channel=NotificationChannel.PUSH,
            message=f'You now also have {label} access. Use the role switcher at the top of the screen '
                    f'(or your profile) to open the {label} pages.',
            status=NotificationStatus.PENDING,
        )
        send_push.delay(str(notif.id))
    except Exception:  # noqa: BLE001 — a missed notification must not undo the change
        logger.exception('Role-granted notification failed for user %s', user.id)


@extend_schema(exclude=True)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def switch_role_view(request):
    """
    POST /api/v1/auth/switch-role/  {"role": "PARENT", "refresh": "<current refresh token>"}
    Returns a new token pair acting as `role` (which the person must hold) and their profile.
    The old refresh token is blacklisted.
    """
    role = request.data.get('role')
    if not role or not request.user.has_role(role):
        return error_response('You do not have that role.', 'FORBIDDEN', status_code=status.HTTP_403_FORBIDDEN)
    old_refresh = request.data.get('refresh')
    if old_refresh:
        try:
            RefreshToken(old_refresh).blacklist()
        except Exception:  # noqa: BLE001 — an already-invalid token is fine here
            pass
    user = request.user
    token = CustomTokenObtainPairSerializer.get_token(user, active_role=role)
    return success_response(
        data={
            'access': str(token.access_token),
            'refresh': str(token),
            'user': UserProfileSerializer(user).data,
        },
        message=f'Now acting as {UserRole(role).label}.',
    )


@extend_schema(exclude=True)
@api_view(['GET'])
@permission_classes([IsNurseOrSupervisorOrAdmin])
def pending_approvals_view(request):
    """GET /api/v1/auth/pending-approvals/ — list unapproved users in the requester's camp."""
    qs = CustomUser.objects.filter(is_approved=False, is_active=True)
    # Nurse/Supervisor only see their own camp's pending users
    if request.user.role in ('NURSE', 'SUPERVISOR'):
        if not request.user.camp_id:
            # A nurse/supervisor without a camp assignment (e.g. camp deleted via SET_NULL)
            # must not see any pending users — return 403 to prevent global enumeration.
            return error_response('Your account has no camp assigned. Contact an admin.', 'FORBIDDEN', status_code=status.HTTP_403_FORBIDDEN)
        qs = qs.filter(camp=request.user.camp)
    serializer = UserProfileSerializer(qs, many=True)
    return success_response(data=serializer.data)


@extend_schema(exclude=True)
@api_view(['PATCH'])
@permission_classes([IsNurseOrSupervisorOrAdmin])
def approve_user_view(request, user_id):
    """PATCH /api/v1/auth/approve/<user_id>/ — approve a pending user."""
    try:
        user = CustomUser.objects.get(id=user_id, is_active=True)
    except CustomUser.DoesNotExist:
        return error_response('User not found.', 'NOT_FOUND', status_code=status.HTTP_404_NOT_FOUND)

    # Nurse/Supervisor can only approve users in their own camp.
    # Guard against null camp_id: None != None evaluates False, which would incorrectly
    # allow a camp-less nurse to approve camp-less users.
    if request.user.role in ('NURSE', 'SUPERVISOR'):
        if not request.user.camp_id or user.camp_id != request.user.camp_id:
            return error_response('Permission denied.', 'FORBIDDEN', status_code=status.HTTP_403_FORBIDDEN)

    user.is_approved = True
    user.save(update_fields=['is_approved', 'updated_at'])

    # Send approval notification email
    _send_account_approved_email(user)

    return success_response(
        data=UserProfileSerializer(user).data,
        message=f'{user.full_name} approved successfully.',
    )


@extend_schema(exclude=True)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def suspend_user_view(request, user_id):
    """
    POST /api/v1/auth/users/<user_id>/suspend/
    Body: {"reason": "...", "suspended": true|false}
    Admin only. Toggles account suspension.
    """
    if request.user.role != UserRole.ADMIN:
        return error_response('Admin only.', 'FORBIDDEN', status_code=403)
    try:
        target = CustomUser.objects.get(id=user_id)
    except CustomUser.DoesNotExist:
        return error_response('User not found.', 'NOT_FOUND', status_code=404)

    suspended = request.data.get('suspended', True)
    from django.utils import timezone
    if suspended:
        target.suspended_at = timezone.now()
        target.suspension_reason = request.data.get('reason', '')
        target.suspended_by = request.user
        target.is_active = False
        revoke_user_tokens(target)
    else:
        target.suspended_at = None
        target.suspension_reason = ''
        target.suspended_by = None
        target.is_active = True
    target.save(update_fields=['suspended_at', 'suspension_reason', 'suspended_by', 'is_active', 'updated_at'])
    return success_response(
        data=UserProfileSerializer(target).data,
        message='User suspension status updated.',
    )


@extend_schema(exclude=True)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_suspend_view(request):
    """
    POST /api/v1/auth/users/bulk-suspend/
    Body: {"user_ids": ["<uuid>", ...], "reason": "...", "suspended": true}
    Admin only.
    """
    if request.user.role != UserRole.ADMIN:
        return error_response('Admin only.', 'FORBIDDEN', status_code=403)
    user_ids = request.data.get('user_ids', [])
    reason = request.data.get('reason', '')
    suspended = request.data.get('suspended', True)
    from django.utils import timezone
    count = 0
    for uid in user_ids[:100]:
        try:
            target = CustomUser.objects.get(id=uid)
            if suspended:
                target.suspended_at = timezone.now()
                target.suspension_reason = reason
                target.suspended_by = request.user
                target.is_active = False
                revoke_user_tokens(target)
            else:
                target.suspended_at = None
                target.suspension_reason = ''
                target.suspended_by = None
                target.is_active = True
            target.save(update_fields=['suspended_at', 'suspension_reason', 'suspended_by', 'is_active', 'updated_at'])
            count += 1
        except CustomUser.DoesNotExist:
            pass
    return success_response(data={'affected': count}, message=f'{count} user(s) updated.')


@extend_schema(exclude=True)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_onboarding_view(request):
    """POST /api/v1/auth/onboarding/complete/ — mark onboarding done for the current user."""
    from django.utils import timezone
    user = request.user
    if user.onboarded_at:
        return success_response(message='Already onboarded.', data=UserProfileSerializer(user).data)
    user.onboarded_at = timezone.now()
    user.save(update_fields=['onboarded_at', 'updated_at'])
    return success_response(data=UserProfileSerializer(user).data, message='Onboarding complete.')


@extend_schema(exclude=True)
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def consent_view(request):
    """
    GET  /api/v1/auth/consent/ — list current user's consent records.
    POST /api/v1/auth/consent/ — grant consent (body: {scope, version}).
    """
    if request.method == 'POST':
        scope = request.data.get('scope', 'data_collection')
        version = request.data.get('version', '1.0')
        record = ConsentRecord.objects.create(
            user=request.user, scope=scope, version=version, granted=True
        )
        return created_response(
            data={
                'id': str(record.id),
                'scope': record.scope,
                'version': record.version,
                'granted': record.granted,
                'granted_at': record.granted_at.isoformat(),
                'withdrawn_at': None,
            },
            message='Consent recorded.',
        )
    records = ConsentRecord.objects.filter(user=request.user)
    data = [
        {
            'id': str(r.id),
            'scope': r.scope,
            'version': r.version,
            'granted': r.granted,
            'granted_at': r.granted_at.isoformat(),
            'withdrawn_at': r.withdrawn_at.isoformat() if r.withdrawn_at else None,
        }
        for r in records
    ]
    return success_response(data=data)


@extend_schema(exclude=True)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def consent_withdraw_view(request, consent_id):
    """POST /api/v1/auth/consent/<consent_id>/withdraw/ — withdraw a consent record."""
    from django.utils import timezone
    try:
        record = ConsentRecord.objects.get(id=consent_id, user=request.user)
    except ConsentRecord.DoesNotExist:
        return error_response('Consent record not found.', 'NOT_FOUND', status_code=404)
    if record.withdrawn_at:
        return error_response('Already withdrawn.', 'ALREADY_WITHDRAWN')
    record.withdrawn_at = timezone.now()
    record.granted = False
    record.save(update_fields=['withdrawn_at', 'granted'])
    return success_response(message='Consent withdrawn.')


def _send_account_approved_email(user):
    """Notify the user that their account has been approved."""
    try:
        from apps.notifications.tasks import send_email_task
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        lang = user.preferred_language or 'en'
        send_email_task.delay(
            to=user.email,
            template='account_approved',
            subject='Your Ikibondo account has been approved',
            context={
                'full_name': user.full_name,
                'login_url': f'{frontend_url}/login',
            },
            language=lang,
        )
    except Exception:
        pass


# ── Forgotten password ────────────────────────────────────────────────────────

class PasswordResetRequestThrottle(ScopedRateThrottle):
    scope = 'auth_otp'


class PasswordResetConfirmThrottle(ScopedRateThrottle):
    scope = 'auth_otp_confirm'


@extend_schema(exclude=True)
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetRequestThrottle])
def password_reset_request_view(request):
    """
    POST /api/v1/auth/password-reset/request/  Body: {"identifier": "<email or phone>"}
    Always answers the same way so the endpoint cannot be used to discover accounts.
    """
    from .password_reset import request_reset
    request_reset(request.data.get('identifier', ''))
    return success_response(
        message='If an account matches, a reset code has been sent. It expires in 10 minutes.',
    )


@extend_schema(exclude=True)
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetConfirmThrottle])
def password_reset_confirm_view(request):
    """
    POST /api/v1/auth/password-reset/confirm/
    Body: {"identifier": "...", "code": "123456", "new_password": "..."}
    """
    from .password_reset import ResetError, confirm_reset
    try:
        confirm_reset(
            request.data.get('identifier', ''),
            request.data.get('code', ''),
            request.data.get('new_password', ''),
        )
    except ResetError as exc:
        return error_response(str(exc), 'RESET_FAILED')
    return success_response(message='Password updated. Sign in with your new password.')


@extend_schema(exclude=True)
@api_view(['POST'])
@permission_classes([IsAuthenticated, IsNurseOrSupervisorOrAdmin])
def resend_setup_link_view(request, user_id):
    """
    POST /api/v1/auth/users/<id>/setup-link/
    Send a parent a new set-password link (only while they have not set one).
    Nurses and supervisors may only do this for parents in their own camp.
    """
    from .account_setup import needs_setup
    qs = CustomUser.objects.with_role(UserRole.PARENT).filter(pk=user_id)
    if request.user.role != UserRole.ADMIN:
        qs = qs.filter(camp_id=request.user.camp_id) if request.user.camp_id else qs.none()
    user = qs.first()
    if user is None:
        return error_response('User not found.', 'NOT_FOUND', status_code=status.HTTP_404_NOT_FOUND)
    if not needs_setup(user):
        return error_response('This parent has already set a password. They can use "Forgot password".',
                              'ALREADY_SET', status_code=status.HTTP_409_CONFLICT)
    return success_response(data=_with_setup_delivery(user, request.user), message='Setup link sent.')


@extend_schema(exclude=True)
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetConfirmThrottle])
def set_password_view(request):
    """
    POST /api/v1/auth/set-password/
    Body: {"uid": "...", "token": "...", "new_password": "..."}
    """
    from .account_setup import SetupError, complete_setup
    try:
        complete_setup(
            request.data.get('uid', ''),
            request.data.get('token', ''),
            request.data.get('new_password', ''),
        )
    except SetupError as exc:
        return error_response(str(exc), 'SETUP_FAILED')
    return success_response(message='Password set. You can sign in now.')


class OrganizationViewSet(viewsets.ModelViewSet):
    """Admin: government bodies and partner organisations, and the camps each one covers."""
    serializer_class = OrganizationSerializer
    permission_classes = [IsAdminUser]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        from .models import Organization
        return Organization.objects.prefetch_related('camps').all()
