"""Celery tasks for Ikibondo notifications."""
import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def send_sam_alert(child_id: str, health_record_id: str):
    """Legacy SAM alert — kept for backward-compat with existing callers."""
    notify_high_risk.delay(health_record_id)


@shared_task
def notify_high_risk(record_id: str):
    """
    Fan out HIGH-risk alert to: parent + assigned CHW + supervisors of the child's zone.
    Creates Notification rows and attempts to deliver via SMS or push.
    """
    from apps.health_records.models import HealthRecord
    from apps.children.models import Child
    from apps.camps.models import ZoneCoordinatorAssignment, CHWZoneAssignment
    from .models import Notification, NotificationType, NotificationChannel, NotificationStatus

    try:
        record = HealthRecord.objects.select_related('child', 'child__guardian', 'child__zone').get(id=record_id)
        child = record.child
        risk_factors_summary = _format_risk_factors(record.risk_factors or [])

        message = (
            f'HIGH RISK: {child.full_name} ({child.registration_number}) '
            f'was assessed as HIGH risk on {record.measurement_date}. '
            f'Key factors: {risk_factors_summary}. Immediate follow-up required.'
        )

        recipients = []

        # Parent
        if child.guardian and child.guardian.user:
            recipients.append((child.guardian.user, NotificationChannel.SMS))

        # CHW
        if record.recorded_by:
            recipients.append((record.recorded_by, NotificationChannel.PUSH))

        # Zone coordinators/supervisors
        if child.zone:
            coord_ids = ZoneCoordinatorAssignment.objects.filter(
                zone=child.zone, status='active'
            ).values_list('user_id', flat=True)
            from apps.accounts.models import CustomUser
            for user in CustomUser.objects.filter(id__in=coord_ids, is_active=True):
                recipients.append((user, NotificationChannel.PUSH))

        for user, channel in recipients:
            notif = Notification.objects.create(
                recipient=user,
                child=child,
                notification_type=NotificationType.HIGH_RISK_ALERT,
                channel=channel,
                message=message,
                status=NotificationStatus.PENDING,
            )
            if channel == NotificationChannel.SMS:
                send_sms.delay(str(notif.id))
            else:
                send_push.delay(str(notif.id))

        logger.info('HIGH risk notifications queued for record %s (%d recipients)', record_id, len(recipients))

    except Exception as e:
        logger.exception('notify_high_risk failed for record %s: %s', record_id, e)


@shared_task
def send_sms(notification_id: str):
    """Send an SMS notification via Africa's Talking API."""
    from .models import Notification, NotificationStatus
    from django.conf import settings

    try:
        notif = Notification.objects.select_related('recipient').get(id=notification_id)
        phone = notif.recipient.phone_number
        if not phone:
            notif.status = NotificationStatus.FAILED
            notif.save(update_fields=['status', 'updated_at'])
            return

        at_username = getattr(settings, 'AFRICASTALKING_USERNAME', '')
        at_api_key = getattr(settings, 'AFRICASTALKING_API_KEY', '')

        if at_username and at_api_key:
            try:
                import africastalking
                africastalking.initialize(at_username, at_api_key)
                sms = africastalking.SMS
                sms.send(notif.message, [phone])
                notif.status = NotificationStatus.SENT
            except Exception as e:
                logger.warning('Africa\'s Talking SMS failed for %s: %s', notification_id, e)
                notif.status = NotificationStatus.FAILED
        else:
            # No SMS provider configured — log and mark sent for dev
            logger.info('[SMS] To %s: %s', phone, notif.message[:80])
            notif.status = NotificationStatus.SENT

        notif.sent_at = timezone.now()
        notif.save(update_fields=['status', 'sent_at', 'updated_at'])

    except Notification.DoesNotExist:
        logger.error('Notification %s not found', notification_id)
    except Exception as e:
        logger.exception('send_sms failed for %s: %s', notification_id, e)


@shared_task
def send_push(notification_id: str):
    """Send a push notification via FCM."""
    from .models import Notification, NotificationStatus
    from django.conf import settings

    try:
        notif = Notification.objects.select_related('recipient').get(id=notification_id)

        fcm_key = getattr(settings, 'FCM_SERVER_KEY', '')
        if fcm_key:
            # Basic FCM HTTP API call
            try:
                import urllib.request, json as _json
                payload = _json.dumps({
                    'to': f'/topics/user-{notif.recipient_id}',
                    'notification': {'title': 'Ikibondo Alert', 'body': notif.message[:200]},
                    'data': {'notification_id': str(notif.id), 'type': notif.notification_type},
                }).encode()
                req = urllib.request.Request(
                    'https://fcm.googleapis.com/fcm/send',
                    data=payload,
                    headers={'Authorization': f'key={fcm_key}', 'Content-Type': 'application/json'},
                )
                urllib.request.urlopen(req, timeout=10)
                notif.status = NotificationStatus.SENT
            except Exception as e:
                logger.warning('FCM push failed for %s: %s', notification_id, e)
                notif.status = NotificationStatus.FAILED
        else:
            logger.info('[PUSH] To user %s: %s', notif.recipient_id, notif.message[:80])
            notif.status = NotificationStatus.SENT

        notif.sent_at = timezone.now()
        notif.save(update_fields=['status', 'sent_at', 'updated_at'])

    except Notification.DoesNotExist:
        logger.error('Notification %s not found', notification_id)
    except Exception as e:
        logger.exception('send_push failed for %s: %s', notification_id, e)


@shared_task
def daily_vaccination_reminder():
    """Send vaccination reminders for doses due in 3 days."""
    from datetime import date, timedelta
    from apps.vaccinations.models import VaccinationRecord
    from .models import Notification, NotificationType, NotificationChannel, NotificationStatus

    due_date = date.today() + timedelta(days=3)
    records = VaccinationRecord.objects.filter(
        scheduled_date=due_date,
        status='SCHEDULED',
    ).select_related('child', 'child__guardian', 'vaccine')

    count = 0
    for vax_record in records:
        guardian = vax_record.child.guardian
        if not guardian or not guardian.user:
            continue
        message = (
            f'Reminder: {vax_record.child.full_name}\'s {vax_record.vaccine.name} '
            f'vaccination is due on {due_date}. Please visit your health facility.'
        )
        notif = Notification.objects.create(
            recipient=guardian.user,
            child=vax_record.child,
            notification_type=NotificationType.VACCINATION_REMINDER,
            channel=NotificationChannel.SMS,
            message=message,
            status=NotificationStatus.PENDING,
        )
        send_sms.delay(str(notif.id))
        count += 1

    logger.info('Queued %d vaccination reminders for %s', count, due_date)


@shared_task
def compute_overdue_vaccines():
    """Flip SCHEDULED→MISSED for past-due vaccination records."""
    from datetime import date
    from apps.vaccinations.models import VaccinationRecord

    updated = VaccinationRecord.objects.filter(
        scheduled_date__lt=date.today(),
        status='SCHEDULED',
    ).update(status='MISSED')
    logger.info('Marked %d vaccinations as MISSED', updated)


@shared_task
def daily_zone_summary():
    """Send KPI digest to zone coordinators. Flag CHWs with 0 visits in past 7 days."""
    from datetime import timedelta
    from apps.camps.models import ZoneCoordinatorAssignment, CHWZoneAssignment, CampZone
    from apps.health_records.models import HealthRecord
    from .models import Notification, NotificationType, NotificationChannel, NotificationStatus

    one_week_ago = timezone.now().date() - timedelta(days=7)

    for zone in CampZone.objects.filter(status='active'):
        coord_assignments = ZoneCoordinatorAssignment.objects.filter(zone=zone, status='active').select_related('user')
        if not coord_assignments.exists():
            continue

        total_children = zone.children.filter(is_active=True).count()
        risk_dist = {'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
        for child in zone.children.filter(is_active=True):
            latest = child.health_records.order_by('-measurement_date').first()
            if latest and latest.risk_level:
                risk_dist[latest.risk_level] = risk_dist.get(latest.risk_level, 0) + 1

        visits_this_week = HealthRecord.objects.filter(
            zone=zone, measurement_date__gte=one_week_ago
        ).count()

        # Find inactive CHWs
        active_chw_ids = list(CHWZoneAssignment.objects.filter(
            zone=zone, status='active'
        ).values_list('chw_user_id', flat=True))
        inactive_chws = [
            chw_id for chw_id in active_chw_ids
            if not HealthRecord.objects.filter(recorded_by_id=chw_id, measurement_date__gte=one_week_ago).exists()
        ]

        message = (
            f'Zone {zone.name} daily summary: '
            f'{total_children} children, '
            f'HIGH={risk_dist["HIGH"]} MED={risk_dist["MEDIUM"]} LOW={risk_dist["LOW"]}, '
            f'{visits_this_week} visits this week, '
            f'{len(inactive_chws)} inactive CHW(s).'
        )

        for ca in coord_assignments:
            notif = Notification.objects.create(
                recipient=ca.user,
                notification_type=NotificationType.ZONE_SUMMARY,
                channel=NotificationChannel.PUSH,
                message=message,
                status=NotificationStatus.PENDING,
            )
            send_push.delay(str(notif.id))

    logger.info('Zone summaries dispatched.')


def _format_risk_factors(risk_factors: list) -> str:
    if not risk_factors:
        return 'see clinical record'
    top = risk_factors[:3]
    parts = [f['feature'] for f in top if isinstance(f, dict)]
    return ', '.join(parts) if parts else 'see clinical record'
