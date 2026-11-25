"""
Role/camp data scoping shared by every child-related view.

Rules (fail closed — an unknown role or a camp-scoped user without a camp sees nothing):
  ADMIN              — everything
  NURSE / SUPERVISOR — children in their own camp
  CHW                — children whose guardian is assigned to them
  PARENT             — children whose guardian record is linked to their account
"""
from django.db.models import Q

from apps.accounts.models import UserRole


def child_scope_q(user, prefix=''):
    """
    Return a Q object restricting a queryset to children `user` may access,
    or None when the user may access everything (ADMIN).

    `prefix` is the lookup path from the queryset's model to Child,
    e.g. 'child__' for HealthRecord, '' for Child itself.
    """
    role = getattr(user, 'role', None)
    if role == UserRole.ADMIN:
        return None
    if role in (UserRole.NURSE, UserRole.SUPERVISOR):
        if not user.camp_id:
            return Q(pk__in=[])
        return Q(**{f'{prefix}camp_id': user.camp_id})
    if role == UserRole.CHW:
        return Q(**{f'{prefix}guardian__assigned_chw': user})
    if role == UserRole.PARENT:
        return Q(**{f'{prefix}guardian__user': user})
    return Q(pk__in=[])


def scope_children(qs, user, prefix=''):
    """Filter `qs` to rows whose child `user` may access."""
    q = child_scope_q(user, prefix)
    return qs if q is None else qs.filter(q)


def scope_camp(qs, user, field='camp_id'):
    """
    Filter a camp-owned queryset (e.g. ClinicSession) to the user's camp.
    ADMIN sees all; everyone else is limited to their own camp, none if unassigned.
    """
    if getattr(user, 'role', None) == UserRole.ADMIN:
        return qs
    if not getattr(user, 'camp_id', None):
        return qs.none()
    return qs.filter(**{field: user.camp_id})


def can_access_child(user, child):
    """True when `user` may read `child`'s records."""
    from apps.children.models import Child
    return scope_children(Child.objects.filter(pk=child.pk), user).exists()
