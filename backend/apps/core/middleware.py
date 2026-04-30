"""
ZoneScopeMiddleware — sets request.scope after JWT auth resolves the user.

request.scope is a dict with:
  role      — the user's role string
  camp_id   — UUID of the user's camp (None for ADMIN)
  zone_ids  — list of UUIDs of zones the user is responsible for
  user_id   — UUID of the authenticated user

Middleware runs last in the stack (after AuthenticationMiddleware) so
request.user is already resolved from the JWT token.
"""
from django.utils.deprecation import MiddlewareMixin


class ZoneScopeMiddleware(MiddlewareMixin):
    def process_request(self, request):
        user = getattr(request, 'user', None)
        if user is None or not user.is_authenticated:
            request.scope = {
                'role': None,
                'camp_id': None,
                'zone_ids': [],
                'user_id': None,
            }
            return

        role = user.role
        camp_id = str(user.camp_id) if user.camp_id else None
        zone_ids = []

        try:
            if role == 'SUPERVISOR':
                from apps.camps.models import ZoneCoordinatorAssignment
                zone_ids = list(
                    ZoneCoordinatorAssignment.objects
                    .filter(user=user, status='active')
                    .values_list('zone_id', flat=True)
                )
                zone_ids = [str(z) for z in zone_ids]
            elif role == 'CHW':
                from apps.camps.models import CHWZoneAssignment
                assignment = CHWZoneAssignment.objects.filter(chw_user=user, status='active').first()
                if assignment:
                    zone_ids = [str(assignment.zone_id)]
        except Exception:
            pass

        request.scope = {
            'role': role,
            'camp_id': camp_id,
            'zone_ids': zone_ids,
            'user_id': str(user.id),
        }
