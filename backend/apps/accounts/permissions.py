"""Role-based permission classes for Ikibondo API views."""
from functools import wraps
from rest_framework.permissions import BasePermission, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework import status
from .models import UserRole


def role_required(*roles):
    """Function-based view decorator that returns 403 unless request.user.role is in roles."""
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not request.user or not request.user.is_authenticated:
                return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
            if request.user.role not in roles:
                return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


class IsCHW(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == UserRole.CHW)


class IsNurse(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == UserRole.NURSE)


class IsSupervisor(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == UserRole.SUPERVISOR)


class IsAdminUser(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == UserRole.ADMIN)


class IsCampStaff(BasePermission):
    """CHW or Nurse — field-level staff who record measurements."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role in (UserRole.CHW, UserRole.NURSE)
        )


class IsSupervisorOrAdmin(BasePermission):
    """Supervisor or Admin — management-level access."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role in (UserRole.SUPERVISOR, UserRole.ADMIN)
        )


class IsParent(BasePermission):
    """Parent / Guardian — read-only access to their own children."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == UserRole.PARENT)


class IsStaffCreator(BasePermission):
    """
    True for ADMIN and SUPERVISOR roles.
    Fine-grained role/camp matrix checks are done inside the view because
    they depend on the request body (role being created, target camp).
    """
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role in (UserRole.ADMIN, UserRole.SUPERVISOR)
        )


class IsNurseOrSupervisorOrAdmin(BasePermission):
    """NURSE, SUPERVISOR, or ADMIN — for approval and management flows."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role in (UserRole.NURSE, UserRole.SUPERVISOR, UserRole.ADMIN)
        )


class IsStaffCreatorOrNurse(BasePermission):
    """ADMIN, SUPERVISOR, and NURSE. Nurses are restricted to creating PARENT accounts only (enforced in the view)."""
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role in (UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE)
        )


class IsAdminOrReadOnly(BasePermission):
    """ADMIN for write operations; all authenticated users for reads."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return request.user.role == UserRole.ADMIN
