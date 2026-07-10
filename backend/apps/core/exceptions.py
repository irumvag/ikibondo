"""
Global DRF exception handler.

Views normally return the standard envelope via apps.core.responses
(success_response / error_response). Exceptions raised inside views —
ValidationError, PermissionDenied, NotAuthenticated, Http404, throttling —
would otherwise bubble out in DRF's default shape ({"detail": ...} or a
field-error dict), leaving clients with two response formats to handle.

This handler rewraps every DRF-handled exception into the same envelope:

    {"success": false, "error": "<human message>", "code": "<CODE>",
     "details": <original DRF payload, when it carries field errors>}

Unhandled (non-API) exceptions still propagate so Django can return a 500
and the error is logged/reported normally.
"""
import logging

from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)

# Map DRF default codes to stable, client-facing error codes.
_CODE_MAP = {
    'authentication_failed': 'AUTHENTICATION_FAILED',
    'not_authenticated': 'NOT_AUTHENTICATED',
    'permission_denied': 'PERMISSION_DENIED',
    'not_found': 'NOT_FOUND',
    'method_not_allowed': 'METHOD_NOT_ALLOWED',
    'throttled': 'THROTTLED',
    'parse_error': 'PARSE_ERROR',
    'invalid': 'VALIDATION_ERROR',
}


def _flatten_message(data):
    """Extract one human-readable message from a DRF error payload."""
    if isinstance(data, str):
        return data
    if isinstance(data, list) and data:
        return _flatten_message(data[0])
    if isinstance(data, dict):
        # {"detail": "..."} — the common non-field case
        if 'detail' in data:
            return _flatten_message(data['detail'])
        # Field errors: report the first one as "field: message"
        for field, errors in data.items():
            msg = _flatten_message(errors)
            if msg:
                return f'{field}: {msg}'
    return 'An error occurred.'


def envelope_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        # Not a DRF-handled exception — let Django's 500 handling take over.
        return None

    # Already enveloped (e.g. a view raised after building error_response data).
    if isinstance(response.data, dict) and 'success' in response.data:
        return response

    default_code = getattr(getattr(exc, 'detail', None), 'code', None) or \
        getattr(exc, 'default_code', 'error')
    payload = {
        'success': False,
        'error': _flatten_message(response.data),
        'code': _CODE_MAP.get(default_code, str(default_code).upper()),
    }
    # Preserve field-level errors so form clients can highlight inputs.
    if isinstance(response.data, dict) and 'detail' not in response.data:
        payload['details'] = response.data

    response.data = payload
    return response
