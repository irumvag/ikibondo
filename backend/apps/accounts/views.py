from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.responses import success_response, created_response, error_response
from .serializers import (
    CustomTokenObtainPairSerializer,
    IdentifierAuthSerializer,
    UserProfileSerializer,
    UserCreateSerializer,
    UserRegistrationSerializer,
    ApproveUserSerializer,
)
from .permissions import IsAdminUser, IsSupervisorOrAdmin
from .models import CustomUser


class LoginView(TokenObtainPairView):
    """POST /api/v1/auth/login/ — returns JWT access + refresh + user profile."""
    serializer_class = CustomTokenObtainPairSerializer

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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    """GET /api/v1/auth/me/ — returns the current user's profile."""
    serializer = UserProfileSerializer(request.user)
    return success_response(data=serializer.data)


@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    """POST /api/v1/auth/register/ — public self-registration; creates unapproved account."""
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        return created_response(
            data=UserProfileSerializer(user).data,
            message='Registration successful. Your account is pending approval.',
        )
    return error_response(str(serializer.errors), 'VALIDATION_ERROR')


@api_view(['POST'])
@permission_classes([IsAdminUser])
def create_user_view(request):
    """POST /api/v1/auth/users/ — admin creates a new staff account (auto-approved)."""
    serializer = UserCreateSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        return created_response(
            data=UserProfileSerializer(user).data,
            message='User created successfully.',
        )
    return error_response(str(serializer.errors), 'VALIDATION_ERROR')


@api_view(['GET'])
@permission_classes([IsSupervisorOrAdmin])
def pending_approvals_view(request):
    """GET /api/v1/auth/pending-approvals/ — list unapproved users in the requester's camp."""
    qs = CustomUser.objects.filter(is_approved=False, is_active=True)
    # Nurse/Supervisor only see their own camp's pending users
    if request.user.role in ('NURSE', 'SUPERVISOR') and request.user.camp_id:
        qs = qs.filter(camp=request.user.camp)
    serializer = UserProfileSerializer(qs, many=True)
    return success_response(data=serializer.data)


@api_view(['PATCH'])
@permission_classes([IsSupervisorOrAdmin])
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
    return success_response(
        data=UserProfileSerializer(user).data,
        message=f'{user.full_name} approved successfully.',
    )
