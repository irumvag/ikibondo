"""
Branded transactional email helper for Ikibondo.

Templates live in  backend/templates/emails/<template_name>/<lang>.html
                               and  backend/templates/emails/<template_name>/<lang>.txt

Supported languages: en, fr, rw
If the user's preferred_language has no template, falls back to 'en'.
"""
import logging
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings

logger = logging.getLogger(__name__)

_SUPPORTED_LANGS = {'en', 'fr', 'rw'}


def send_branded_email(
    to: str | list[str],
    template: str,
    subject: str,
    context: dict,
    language: str = 'en',
) -> bool:
    """
    Render and send a branded HTML+plain-text email.

    Args:
        to:        Recipient address(es).
        template:  Sub-directory under templates/emails/, e.g. 'welcome_staff'.
        subject:   Email subject line (pre-translated by caller).
        context:   Template context dictionary.
        language:  ISO language code ('en', 'fr', 'rw'). Falls back to 'en'.

    Returns:
        True if the email was handed to the mail backend without raising.
    """
    lang = language if language in _SUPPORTED_LANGS else 'en'
    html_tpl = f'emails/{template}/{lang}.html'
    txt_tpl  = f'emails/{template}/{lang}.txt'

    # Inject shared branding context
    base_ctx = {
        'frontend_url': getattr(settings, 'FRONTEND_URL', 'http://localhost:3000'),
        'app_name': 'Ikibondo',
        **context,
    }

    try:
        html_body = render_to_string(html_tpl, base_ctx)
        txt_body  = render_to_string(txt_tpl,  base_ctx)
    except Exception:
        # Fall back to English if the requested language template is missing
        try:
            html_body = render_to_string(f'emails/{template}/en.html', base_ctx)
            txt_body  = render_to_string(f'emails/{template}/en.txt',  base_ctx)
        except Exception:
            logger.exception('Email template not found: %s (lang=%s)', template, lang)
            return False

    recipients = [to] if isinstance(to, str) else to
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@ikibondo.rw')

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=txt_body,
            from_email=from_email,
            to=recipients,
        )
        msg.attach_alternative(html_body, 'text/html')
        msg.send(fail_silently=False)
        logger.info('Email "%s" sent to %s', template, recipients)
        return True
    except Exception:
        logger.exception('Failed to send email "%s" to %s', template, recipients)
        return False
