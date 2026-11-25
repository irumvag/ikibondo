"""
Push notifications through Firebase Cloud Messaging (HTTP v1 API).

One path covers Android and iOS: upload the APNs key to the Firebase project and
iOS devices receive pushes through FCM too. Configure FIREBASE_CREDENTIALS_FILE
with a service-account JSON path; without it, sends are skipped (not faked).
"""
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

_app = None


def push_configured() -> bool:
    return bool(getattr(settings, 'FIREBASE_CREDENTIALS_FILE', ''))


def _firebase_app():
    global _app
    if _app is None:
        import firebase_admin
        from firebase_admin import credentials
        _app = firebase_admin.initialize_app(credentials.Certificate(settings.FIREBASE_CREDENTIALS_FILE))
    return _app


def send_to_user(user, title: str, body: str, data: dict | None = None) -> int:
    """
    Send one notification to every registered device of `user`.
    Returns how many devices accepted it. Tokens Firebase reports as dead are deleted.
    """
    from .models import DeviceToken

    if not push_configured():
        return 0
    tokens = list(DeviceToken.objects.filter(user=user))
    if not tokens:
        return 0

    from firebase_admin import messaging
    payload = {k: str(v) for k, v in (data or {}).items()}  # FCM data values must be strings
    delivered = 0
    for device in tokens:
        message = messaging.Message(
            token=device.token,
            notification=messaging.Notification(title=title, body=body[:200]),
            data=payload,
            apns=messaging.APNSConfig(payload=messaging.APNSPayload(aps=messaging.Aps(sound='default'))),
        )
        try:
            messaging.send(message, app=_firebase_app())
            delivered += 1
        except (messaging.UnregisteredError, messaging.SenderIdMismatchError):
            device.delete()  # app uninstalled or token rotated
        except Exception as exc:  # noqa: BLE001
            logger.warning('FCM send failed for device %s: %s', device.id, exc)
    return delivered
