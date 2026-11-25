"""
Forgotten-password flow using a one-time code.

request_reset()  — issues a 6-digit code by email (or SMS when configured).
confirm_reset()  — checks the code and sets the new password.

Both are written so a caller cannot learn whether an account exists.
"""
import logging
import secrets
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.db.models import Q
from django.utils import timezone

from .models import CustomUser, PasswordResetCode
from .security import clear_failed_logins, revoke_user_tokens

logger = logging.getLogger(__name__)

CODE_TTL = timedelta(minutes=10)


class ResetError(Exception):
    """Raised with a user-facing message when a reset cannot be completed."""


def _find_user(identifier):
    identifier = (identifier or '').strip()
    if not identifier:
        return None
    return (
        CustomUser.objects
        .filter(Q(email__iexact=identifier) | Q(phone_number=identifier), is_active=True)
        .first()
    )


def _deliver(user, code):
    from apps.notifications.sms import send_sms_text
    text = f'Your Ikibondo password reset code is {code}. It expires in 10 minutes. Never share this code.'
    # Prefer SMS for parents and field staff without reliable email; fall back to email
    if user.phone_number and send_sms_text(user.phone_number, text):
        return
    if user.email:
        try:
            from apps.notifications.tasks import send_email_task
            send_email_task.delay(
                to=user.email,
                template='password_reset',
                subject='Your Ikibondo password reset code',
                context={'full_name': user.full_name, 'code': code, 'minutes': 10},
                language=user.preferred_language or 'en',
            )
        except Exception:  # noqa: BLE001
            logger.warning('Password reset email could not be queued for user %s', user.id)


def request_reset(identifier):
    """Issue a code if the account exists. Silent either way."""
    user = _find_user(identifier)
    if user is None:
        return
    now = timezone.now()
    # Only the newest code is valid
    PasswordResetCode.objects.filter(user=user, used_at__isnull=True).update(used_at=now)
    code = f'{secrets.randbelow(1_000_000):06d}'
    PasswordResetCode.objects.create(user=user, code_hash=make_password(code), expires_at=now + CODE_TTL)
    _deliver(user, code)


def confirm_reset(identifier, code, new_password):
    """Set `new_password` if `code` is valid. Raises ResetError otherwise."""
    invalid = ResetError('That code is wrong or has expired. Request a new code and try again.')
    user = _find_user(identifier)
    if user is None:
        raise invalid
    entry = (
        PasswordResetCode.objects
        .filter(user=user, used_at__isnull=True, expires_at__gt=timezone.now())
        .first()
    )
    if entry is None or entry.attempts >= PasswordResetCode.MAX_ATTEMPTS:
        raise invalid

    entry.attempts += 1
    entry.save(update_fields=['attempts'])
    if not check_password(str(code or '').strip(), entry.code_hash):
        raise invalid

    from django.core.exceptions import ValidationError as DjangoValidationError
    try:
        validate_password(new_password, user=user)
    except DjangoValidationError as exc:
        # The code stays valid so the person can pick a stronger password
        raise ResetError(' '.join(exc.messages))

    user.set_password(new_password)
    user.must_change_password = False
    user.save(update_fields=['password', 'must_change_password', 'updated_at'])
    entry.used_at = timezone.now()
    entry.save(update_fields=['used_at'])
    revoke_user_tokens(user)
    clear_failed_logins(user.email)
    if user.phone_number:
        clear_failed_logins(user.phone_number)
