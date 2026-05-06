from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from apps.core.responses import success_response, created_response, error_response
from apps.accounts.models import UserRole
from apps.accounts.permissions import IsSupervisorOrAdmin
from .models import VaccinationRecord, Vaccine, DoseStatus, ClinicSession, ClinicSessionAttendance, ClinicSessionStatus
from .serializers import VaccinationRecordSerializer, VaccineSerializer, AdministerSerializer, ClinicSessionSerializer
from .filters import VaccineFilter, VaccinationRecordFilter


class VaccineViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only master list of all vaccines in the Rwanda EPI schedule."""
    queryset = Vaccine.objects.all()
    serializer_class = VaccineSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = VaccineFilter
    search_fields = ['name', 'short_code']


class VaccinationRecordViewSet(viewsets.ModelViewSet):
    queryset = VaccinationRecord.objects.select_related('child', 'vaccine', 'administered_by').all()
    serializer_class = VaccinationRecordSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = VaccinationRecordFilter
    ordering_fields = ['scheduled_date', 'created_at']
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def perform_update(self, serializer):
        """When marking a dose DONE, record administered_by and date."""
        instance = serializer.save()
        if instance.status == 'DONE' and not instance.administered_by:
            instance.administered_by = self.request.user
            if not instance.administered_date:
                instance.administered_date = timezone.now().date()
            instance.save(update_fields=['administered_by', 'administered_date', 'updated_at'])

    def destroy(self, request, *args, **kwargs):
        """Soft-delete a vaccination record — SUPERVISOR/ADMIN only."""
        if request.user.role not in (UserRole.SUPERVISOR, UserRole.ADMIN):
            return error_response(
                'Only supervisors and admins may delete vaccination records.',
                'FORBIDDEN',
                status_code=403,
            )
        record = self.get_object()
        record.soft_delete()
        return success_response(message='Vaccination record deleted.')

    @extend_schema(request=AdministerSerializer, responses=VaccinationRecordSerializer)
    @action(detail=True, methods=['post'], url_path='administer')
    def administer(self, request, pk=None):
        """POST /api/v1/vaccinations/<id>/administer/ — mark a dose as administered."""
        user = request.user
        allowed_roles = (UserRole.CHW, UserRole.NURSE, UserRole.SUPERVISOR, UserRole.ADMIN)
        if user.role not in allowed_roles:
            return error_response('Not authorised to administer vaccines.', 'FORBIDDEN', status_code=403)

        record = self.get_object()

        if record.status == DoseStatus.DONE:
            return error_response('This dose has already been administered.', 'ALREADY_DONE', status_code=400)

        # CHW scope check: must be assigned to the child's zone
        if user.role == UserRole.CHW:
            child_zone = getattr(record.child, 'zone', None)
            if child_zone is not None:
                from apps.camps.models import CHWZoneAssignment
                assigned = CHWZoneAssignment.objects.filter(
                    chw_user=user, zone=child_zone, status='active'
                ).exists()
                if not assigned:
                    return error_response(
                        'You are not assigned to this child\'s zone.',
                        'FORBIDDEN', status_code=403,
                    )

        s = AdministerSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data

        record.status = DoseStatus.DONE
        record.administered_by = user
        record.administered_date = data['administered_date']
        if data.get('batch_number'):
            record.batch_number = data['batch_number']
        if data.get('notes'):
            record.notes = data['notes']
        record.save(update_fields=[
            'status', 'administered_by', 'administered_date',
            'batch_number', 'notes', 'updated_at',
        ])

        return success_response(
            data=VaccinationRecordSerializer(record).data,
            message='Dose administered successfully.',
        )

    @action(detail=False, methods=['post'], url_path='bulk-remind',
            permission_classes=[IsAuthenticated])
    def bulk_remind(self, request):
        """
        POST /api/v1/vaccinations/bulk-remind/
        Queues SMS reminders for all overdue SCHEDULED records in the nurse's camp.
        Body: {"camp_id": "<uuid>"}  — optional; defaults to requesting user's camp.
        NURSE/SUPERVISOR/ADMIN only.
        """
        if request.user.role not in (UserRole.NURSE, UserRole.SUPERVISOR, UserRole.ADMIN):
            return error_response('Only nurses and above may send bulk reminders.', 'FORBIDDEN', status_code=403)

        from datetime import date
        camp_id = request.data.get('camp_id') or getattr(request.user, 'camp_id', None)
        if not camp_id:
            return error_response('camp_id is required.', 'VALIDATION_ERROR', status_code=400)

        overdue_qs = VaccinationRecord.objects.filter(
            status=DoseStatus.SCHEDULED,
            scheduled_date__lt=date.today(),
            child__camp_id=camp_id,
            child__is_active=True,
            child__guardian__user__isnull=False,
        ).select_related('child', 'child__guardian', 'child__guardian__user', 'vaccine')

        from apps.notifications.models import Notification, NotificationType, NotificationChannel, NotificationStatus
        from apps.notifications.tasks import send_sms

        count = 0
        for rec in overdue_qs[:200]:  # cap to avoid accidental mega-blast
            guardian = rec.child.guardian
            if not guardian or not guardian.user:
                continue
            message = (
                f'Reminder: {rec.child.full_name}\'s {rec.vaccine.name} '
                f'vaccination was due on {rec.scheduled_date}. '
                f'Please visit your health facility as soon as possible.'
            )
            notif = Notification.objects.create(
                recipient=guardian.user,
                child=rec.child,
                notification_type=NotificationType.VACCINATION_REMINDER,
                channel=NotificationChannel.SMS,
                message=message,
                status=NotificationStatus.PENDING,
            )
            send_sms.delay(str(notif.id))
            count += 1

        return success_response(
            data={'reminders_queued': count},
            message=f'{count} SMS reminder(s) queued.',
        )


class ClinicSessionViewSet(viewsets.ModelViewSet):
    """
    Manage vaccination clinic sessions.
    NURSE/SUPERVISOR/ADMIN: full CRUD.
    POST /<id>/record-attendance/ — bulk-record doses for a session.
    POST /<id>/close/ — close the session.
    """
    serializer_class = ClinicSessionSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        qs = ClinicSession.objects.select_related('camp', 'vaccine', 'opened_by').prefetch_related('attendances')
        if user.role in (UserRole.NURSE, UserRole.SUPERVISOR):
            if user.camp_id:
                qs = qs.filter(camp_id=user.camp_id)
        return qs.order_by('-session_date')

    def create(self, request, *args, **kwargs):
        if request.user.role not in (UserRole.NURSE, UserRole.SUPERVISOR, UserRole.ADMIN):
            return error_response('Only nurses and above can open clinic sessions.', 'FORBIDDEN', status_code=403)
        camp = getattr(request.user, 'camp', None)
        if camp is None:
            return error_response('Your account is not assigned to a camp.', 'NO_CAMP', status_code=400)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = serializer.save(opened_by=request.user, camp=camp)
        return created_response(
            data=ClinicSessionSerializer(session).data,
            message='Clinic session opened.',
        )

    @action(detail=True, methods=['post'], url_path='record-attendance')
    def record_attendance(self, request, pk=None):
        """
        POST /vaccinations/clinic-sessions/<id>/record-attendance/
        Body: {"attendances": [{"child": "<uuid>", "status": "DONE", "batch_number": "..."}]}
        Marks each listed child as DONE/MISSED/SKIPPED in this session.
        Also updates the corresponding VaccinationRecord if one exists.
        """
        session = self.get_object()
        if session.status == ClinicSessionStatus.CLOSED:
            return error_response('Session is closed.', 'INVALID_STATE')

        attendances_data = request.data.get('attendances', [])
        from .serializers import ClinicSessionAttendanceSerializer
        created_count = 0

        for item in attendances_data:
            child_id = item.get('child')
            status = item.get('status', 'DONE')
            batch = item.get('batch_number', '')

            if not child_id:
                continue

            # Find matching VaccinationRecord for this session's vaccine + child
            vax_record = VaccinationRecord.objects.filter(
                child_id=child_id,
                vaccine=session.vaccine,
                status=DoseStatus.SCHEDULED,
            ).first()

            attendance, _ = ClinicSessionAttendance.objects.update_or_create(
                session=session,
                child_id=child_id,
                defaults={
                    'status': status,
                    'batch_number': batch,
                    'vaccination_record': vax_record,
                },
            )

            # Update the vaccination record too
            if vax_record and status == DoseStatus.DONE:
                vax_record.status = DoseStatus.DONE
                vax_record.administered_date = session.session_date
                vax_record.administered_by = request.user
                if batch:
                    vax_record.batch_number = batch
                vax_record.save(update_fields=['status', 'administered_date', 'administered_by', 'batch_number', 'updated_at'])

            created_count += 1

        return success_response(
            data={'recorded': created_count},
            message=f'{created_count} attendance record(s) saved.',
        )

    @action(detail=True, methods=['post'], url_path='close')
    def close_session(self, request, pk=None):
        """POST /vaccinations/clinic-sessions/<id>/close/ — close the session."""
        session = self.get_object()
        if session.status == ClinicSessionStatus.CLOSED:
            return error_response('Already closed.', 'INVALID_STATE')
        session.status = ClinicSessionStatus.CLOSED
        session.save(update_fields=['status', 'updated_at'])
        return success_response(
            data=ClinicSessionSerializer(session).data,
            message='Session closed.',
        )
