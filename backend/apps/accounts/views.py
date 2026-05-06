from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings


class LoginThrottle(AnonRateThrottle):
    """Stricter rate limit for login attempts — 10/minute per IP."""
    scope = 'auth_login'

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
)
from .permissions import IsAdminUser, IsSupervisorOrAdmin, IsStaffCreator, IsStaffCreatorOrNurse, IsNurseOrSupervisorOrAdmin
from .models import CustomUser, UserRole, ConsentRecord


class LoginView(TokenObtainPairView):
    """POST /api/v1/auth/login/ — returns JWT access + refresh + user profile."""
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [LoginThrottle]

    def post(self, request, *args, **kwargs):
        # Support both the standard email/password and identifier/password flows.
        # If 'identifier' is in the payload, authenticate via PhoneOrEmailBackend first.
        if 'identifier' in request.data:
            auth_serializer = IdentifierAuthSerializer(
                data=request.data, context={'request': request}
            )
            if not auth_serializer.is_valid():
                return error_response(str(auth_serializer.errors), 'AUTH_FAILED', status_code=status.HTTP_401_UNAUTHORIZED)
            user = auth_serializer.validated_data['user']
            token = CustomTokenObtainPairSerializer.get_token(user)
            data = {
                'access': str(token.access_token),
                'refresh': str(token),
                'user': UserProfileSerializer(user).data,
            }
            return success_response(data=data, message='Login successful.')

        response = super().post(request, *args, **kwargs)
        return success_response(data=response.data, message='Login successful.')


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


@api_view(['POST'])
@permission_classes([AllowAny])
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
    try:
        from apps.notifications.tasks import send_email_task
        lang = user.preferred_language or 'en'
        send_email_task.delay(
            to=user.email,
            template='parent_pending',
            subject='Registration received — Ikibondo',
            context={'full_name': user.full_name, 'email': user.email},
            language=lang,
        )
    except Exception:
        pass  # Never block the HTTP response on email failure


def _send_pending_review_emails(user):
    """Notify camp supervisors + all admins that a new parent needs review."""
    try:
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
            CustomUser.objects.filter(
                role=UserRole.SUPERVISOR, is_active=True, camp=user.camp
            ).values_list('email', flat=True)
        ) if user.camp else []
        # All admins
        recipients += list(
            CustomUser.objects.filter(
                role=UserRole.ADMIN, is_active=True
            ).values_list('email', flat=True)
        )
        for email in set(recipients):
            send_email_task.delay(
                to=email,
                template='pending_review',
                subject='New account pending approval — Ikibondo',
                context=ctx,
                language='en',  # Admin/supervisor language defaults to English
            )
    except Exception:
        pass


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
        qs = CustomUser.objects.filter(is_active=True).order_by('-date_joined')
        if request.user.role == UserRole.NURSE:
            # Nurses see PARENT accounts in their camp
            qs = qs.filter(role=UserRole.PARENT, camp=request.user.camp)
        elif request.user.role == UserRole.SUPERVISOR and request.user.camp_id:
            qs = qs.filter(camp=request.user.camp)
        role = request.query_params.get('role')
        if role:
            qs = qs.filter(role=role)
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
        data = request.data.copy()
        if request.user.camp_id:
            data['camp'] = str(request.user.camp_id)
        serializer = UserCreateSerializer(data=data)
        if serializer.is_valid():
            user = serializer.save(is_approved=True)
            return created_response(
                data=UserProfileSerializer(user).data,
                message='Parent account created and approved.',
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

    serializer = UserCreateSerializer(data=request.data)
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

    user.set_password(serializer.validated_data['new_password'])
    user.must_change_password = False
    user.save(update_fields=['password', 'must_change_password', 'updated_at'])
    return success_response(message='Password changed successfully.')


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
        return success_response(message=f'{user.full_name} has been deactivated.')

    serializer = UserAdminUpdateSerializer(user, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return success_response(
            data=UserProfileSerializer(user).data,
            message='User updated successfully.',
        )
    return error_response(str(serializer.errors), 'VALIDATION_ERROR')


@api_view(['GET'])
@permission_classes([IsNurseOrSupervisorOrAdmin])
def pending_approvals_view(request):
    """GET /api/v1/auth/pending-approvals/ — list unapproved users in the requester's camp."""
    qs = CustomUser.objects.filter(is_approved=False, is_active=True)
    # Nurse/Supervisor only see their own camp's pending users
    if request.user.role in ('NURSE', 'SUPERVISOR') and request.user.camp_id:
        qs = qs.filter(camp=request.user.camp)
    serializer = UserProfileSerializer(qs, many=True)
    return success_response(data=serializer.data)


@api_view(['PATCH'])
@permission_classes([IsNurseOrSupervisorOrAdmin])
def approve_user_view(request, user_id):
    """PATCH /api/v1/auth/approve/<user_id>/ — approve a pending user."""
    try:
        user = CustomUser.objects.get(id=user_id, is_active=True)
    except CustomUser.DoesNotExist:
        return error_response('User not found.', 'NOT_FOUND', status_code=status.HTTP_404_NOT_FOUND)

    # Nurse/Supervisor can only approve users in their own camp
    if request.user.role in ('NURSE', 'SUPERVISOR') and user.camp_id != request.user.camp_id:
        return error_response('Permission denied.', 'FORBIDDEN', status_code=status.HTTP_403_FORBIDDEN)

    user.is_approved = True
    user.save(update_fields=['is_approved', 'updated_at'])

    # Send approval notification email
    _send_account_approved_email(user)

    return success_response(
        data=UserProfileSerializer(user).data,
        message=f'{user.full_name} approved successfully.',
    )


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
