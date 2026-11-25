"""
First-time password setup for accounts a nurse creates for a parent.

The nurse never sees or chooses the parent's password. The account is created
with no usable password, and the parent receives a link (SMS and/or email) to
set their own. The link uses Django's password-reset token, so it:
  - expires after settings.PASSWORD_RESET_TIMEOUT (3 days by default), and
  - stops working as soon as a password is set (the token is bound to the
    current password hash).
"""
import logging

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from .models import CustomUser
from .security import revoke_user_tokens

logger = logging.getLogger(__name__)


# Parents often have no email; the model needs a unique one, so they get an
# address on a reserved, undeliverable domain (RFC 2606) and sign in by phone.
PLACEHOLDER_EMAIL_DOMAIN = 'no-email.ikibondo.invalid'


def placeholder_email():
    import secrets
    return f'parent-{secrets.token_hex(8)}@{PLACEHOLDER_EMAIL_DOMAIN}'


def has_real_email(user_or_email):
    email = getattr(user_or_email, 'email', user_or_email) or ''
    return bool(email) and not email.lower().endswith('@' + PLACEHOLDER_EMAIL_DOMAIN)


class SetupError(Exception):
    """Raised with a user-facing message when the setup cannot be completed."""


def setup_link(user):
    base = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f'{base}/set-password?uid={uid}&token={token}'


def needs_setup(user):
    """True while the parent has not chosen a password yet."""
    return not user.has_usable_password()


def send_setup_link(user, camp_name=''):
    """
    Deliver a fresh setup link. Returns {'sms': bool, 'email': bool} describing
    what was handed to a provider. The link itself is never logged.
    """
    from apps.notifications.sms import send_sms_text
    link = setup_link(user)
    sent = {'sms': False, 'email': False}
    if user.phone_number:
        sent['sms'] = send_sms_text(
            user.phone_number,
            f'Ikibondo: your account is ready. Set your password here (valid 3 days): {link}',
        )
    if has_real_email(user):
        try:
            from apps.notifications.tasks import send_email_task
            send_email_task.delay(
                to=user.email,
                template='account_setup',
                subject='Set your Ikibondo password',
                context={'full_name': user.full_name, 'setup_url': link, 'camp_name': camp_name or 'your camp'},
                language=user.preferred_language or 'en',
            )
            sent['email'] = True
        except Exception:  # noqa: BLE001
            logger.warning('Account setup email could not be queued for user %s', user.id)
    return sent


def complete_setup(uid, token, new_password):
    """Set the first password. Raises SetupError on a bad/expired link or weak password."""
    invalid = SetupError('This link is invalid or has expired. Ask the nurse to send a new one.')
    try:
        user = CustomUser.objects.get(pk=force_str(urlsafe_base64_decode(uid or '')), is_active=True)
    except (CustomUser.DoesNotExist, ValueError, TypeError, OverflowError):
        raise invalid
    if not default_token_generator.check_token(user, token or ''):
        raise invalid

    from django.core.exceptions import ValidationError as DjangoValidationError
    try:
        validate_password(new_password, user=user)
    except DjangoValidationError as exc:
        # The link stays valid so the person can pick a stronger password
        raise SetupError(' '.join(exc.messages))

    user.set_password(new_password)
    user.must_change_password = False
    user.save(update_fields=['password', 'must_change_password', 'updated_at'])
    revoke_user_tokens(user)
    return user
