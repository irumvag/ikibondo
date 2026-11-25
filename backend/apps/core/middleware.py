"""
Core middleware for Ikibondo.

ZoneScopeMiddleware — sets request.scope after JWT auth resolves the user.
AuditLogMiddleware  — records every mutation request (POST/PUT/PATCH/DELETE)
                      to the AuditLog table with user, IP, path, and body.
"""
import json
import logging

from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)

# Fields whose values must never be stored in the audit log
_SENSITIVE_KEYS = frozenset({
    'password', 'new_password', 'old_password', 'confirm_password',
    'token', 'access', 'refresh', 'secret', 'api_key',
})

_MUTATION_METHODS = frozenset({'POST', 'PUT', 'PATCH', 'DELETE'})

# Paths that carry credentials and must never be body-logged
_SKIP_BODY_PATHS = ('/auth/login/', '/auth/token/', '/auth/token/refresh/')


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


class AuditLogMiddleware(MiddlewareMixin):
    """
    Records every mutation (POST/PUT/PATCH/DELETE) to the AuditLog table.

    Body is captured in process_request (before DRF reads request.data and
    consumes the stream) and stored on the request object. process_response
    then writes the full entry including the HTTP status code.

    Non-blocking: any error during audit write is caught and logged, never
    propagated to the caller.
    """

    def _get_ip(self, request):
        xff = request.META.get('HTTP_X_FORWARDED_FOR')
        if xff:
            return xff.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')

    def _sanitise_body(self, body_bytes, path):
        """Parse JSON body and strip sensitive keys. Returns dict or None."""
        if any(path.startswith(p) for p in _SKIP_BODY_PATHS):
            return None
        if not body_bytes:
            return None
        try:
            data = json.loads(body_bytes)
            if isinstance(data, dict):
                return {
                    k: '***' if k.lower() in _SENSITIVE_KEYS else v
                    for k, v in data.items()
                }
            return data
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None

    def _action_from_method(self, method):
        if method == 'POST':
            return 'CREATE'
        if method in ('PUT', 'PATCH'):
            return 'UPDATE'
        if method == 'DELETE':
            return 'DELETE'
        return method

    def process_request(self, request):
        """Cache body bytes before DRF consumes the stream."""
        if request.method in _MUTATION_METHODS:
            try:
                # Reading request.body here forces Django to cache it so
                # DRF's _load_data_and_files() will still work afterwards.
                request._audit_body = request.body
            except Exception:
                request._audit_body = b''

    def process_response(self, request, response):
        method = request.method
        if method not in _MUTATION_METHODS:
            return response

        try:
            from apps.core.models import AuditLog

            user = getattr(request, 'user', None)
            user_obj = user if (user and user.is_authenticated) else None
            user_email = getattr(user_obj, 'email', '') or ''

            body_bytes = getattr(request, '_audit_body', b'')
            body = self._sanitise_body(body_bytes, request.path)

            AuditLog.objects.create(
                user=user_obj,
                user_email=user_email,
                action=self._action_from_method(method),
                method=method,
                path=request.path[:500],
                status_code=response.status_code,
                ip_address=self._get_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:300],
                request_body=body,
            )
        except Exception as exc:
            logger.warning('AuditLogMiddleware: failed to write audit entry: %s', exc)

        return response
