"""Role-based permission classes for Ikibondo API views."""
from rest_framework.permissions import BasePermission
from .models import UserRole


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
