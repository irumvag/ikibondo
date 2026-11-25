"""Direct SMS sending via Africa's Talking, for messages that must not be stored or logged (e.g. one-time codes)."""
import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def sms_configured() -> bool:
    return bool(getattr(settings, 'AFRICASTALKING_USERNAME', '') and getattr(settings, 'AFRICASTALKING_API_KEY', ''))


def send_sms_text(phone: str, text: str) -> bool:
    """Send `text` to `phone`. Returns False when no provider is configured or sending fails. Never logs `text`."""
    if not phone or not sms_configured():
        return False
    try:
        import africastalking
        africastalking.initialize(settings.AFRICASTALKING_USERNAME, settings.AFRICASTALKING_API_KEY)
        africastalking.SMS.send(text, [phone])
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("Africa's Talking SMS failed: %s", exc)
        return False
