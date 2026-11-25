"""
Account security helpers: session revocation and failed-login lockout.

Lockout state lives in Django's cache. With the default per-process LocMemCache
each worker counts separately; configure a shared cache (Redis) in production
so the limit holds across workers.
"""
from django.core.cache import cache

MAX_FAILED_LOGINS = 5
LOCKOUT_SECONDS = 15 * 60


def revoke_user_tokens(user):
    """Blacklist every outstanding refresh token for `user`, signing them out everywhere."""
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


def _lockout_key(identifier):
    return f'auth:failed:{(identifier or "").strip().lower()}'


def is_locked_out(identifier):
    return cache.get(_lockout_key(identifier), 0) >= MAX_FAILED_LOGINS


def record_failed_login(identifier):
    key = _lockout_key(identifier)
    # add() only sets when absent, so the window starts at the first failure
    cache.add(key, 0, LOCKOUT_SECONDS)
    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, 1, LOCKOUT_SECONDS)


def clear_failed_logins(identifier):
    cache.delete(_lockout_key(identifier))
