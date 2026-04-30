"""
ScopedQuerySetMixin — filters viewset querysets by role from request.scope.

Subclass this mixin in any viewset whose model has camp/zone/chw/guardian FKs.
Override `apply_scope_filter` for models with non-standard FK names.
"""
from django.db import models


class ScopedQuerySetMixin:
    """
    Automatically narrows querysets based on the authenticated user's role:
      ADMIN     — no filter (sees everything)
      NURSE     — filtered to camp
      SUPERVISOR— filtered to zone(s)
      CHW       — filtered to their own caseload (registered_by / chw)
      PARENT    — filtered to their own children (via Guardian.user)
    """

    def get_queryset(self):
        qs = super().get_queryset()
        scope = getattr(self.request, 'scope', {})
        return self.apply_scope_filter(qs, scope)

    def apply_scope_filter(self, qs, scope):
        role = scope.get('role')
        if not role:
            return qs.none()

        if role == 'ADMIN':
            return qs

        if role == 'NURSE':
            camp_id = scope.get('camp_id')
            if camp_id and hasattr(qs.model, 'camp'):
                return qs.filter(camp_id=camp_id)
            if camp_id and hasattr(qs.model, 'child'):
                return qs.filter(child__camp_id=camp_id)
            return qs

        if role == 'SUPERVISOR':
            zone_ids = scope.get('zone_ids', [])
            if not zone_ids:
                return qs.none()
            if hasattr(qs.model, 'zone'):
                return qs.filter(zone_id__in=zone_ids)
            if hasattr(qs.model, 'child'):
                return qs.filter(child__zone_id__in=zone_ids)
            return qs

        if role == 'CHW':
            user_id = scope.get('user_id')
            if user_id:
                if hasattr(qs.model, 'registered_by'):
                    return qs.filter(registered_by_id=user_id)
                if hasattr(qs.model, 'recorded_by'):
                    return qs.filter(recorded_by_id=user_id)
                if hasattr(qs.model, 'child'):
                    return qs.filter(child__registered_by_id=user_id)
            return qs

        if role == 'PARENT':
            user_id = scope.get('user_id')
            if user_id:
                if hasattr(qs.model, 'guardian'):
                    return qs.filter(guardian__user_id=user_id)
                if hasattr(qs.model, 'child'):
                    return qs.filter(child__guardian__user_id=user_id)
            return qs

        return qs
