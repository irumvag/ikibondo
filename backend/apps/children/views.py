import base64
import io
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.core.responses import success_response, created_response, error_response
from apps.accounts.models import UserRole
from apps.accounts.permissions import IsSupervisorOrAdmin
from django.utils import timezone as tz
from .models import Child, Guardian, VisitRequest, VisitRequestStatus, VisitUrgency, ChildClosure, ChildZoneTransfer
from .serializers import ChildSerializer, ChildCreateSerializer, GuardianSerializer, VisitRequestSerializer
from .filters import ChildFilter


class GuardianViewSet(viewsets.ModelViewSet):
    """
    CRUD on Guardian records. ADMIN/SUPERVISOR only for writes; NURSE gets read access.
    Also exposes `link-account` and `assign-chw` actions.
    """
    queryset = Guardian.objects.select_related('user', 'assigned_chw').all()
    serializer_class = GuardianSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['full_name', 'phone_number', 'national_id']
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_permissions(self):
        if self.request.method in ('POST', 'PATCH', 'DELETE'):
            return [IsSupervisorOrAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == UserRole.NURSE and user.camp_id:
            # Nurse sees guardians of children in their camp
            qs = qs.filter(children__camp_id=user.camp_id).distinct()
        elif user.role == UserRole.CHW:
            # CHW sees only their assigned guardians
            qs = qs.filter(assigned_chw=user)
        return qs

    @action(detail=True, methods=['post'], url_path='link-account', permission_classes=[IsAuthenticated])
    def link_account(self, request, pk=None):
        """
        POST /api/v1/children/guardians/<id>/link-account/
        Body: {"user_id": "<uuid>"}  — links the guardian to a PARENT user account.
        Body: {"user_id": null}      — unlinks (removes the parent connection).
        """
        guardian = self.get_object()
        user_id = request.data.get('user_id')

        if user_id is None:
            guardian.user = None
            guardian.save(update_fields=['user'])
            return success_response(
                data=GuardianSerializer(guardian).data,
                message='Guardian account link removed.',
            )

        from apps.accounts.models import CustomUser
        try:
            user = CustomUser.objects.get(id=user_id, role=UserRole.PARENT, is_active=True)
        except CustomUser.DoesNotExist:
            return error_response(
                'No active PARENT user found with that ID.',
                'NOT_FOUND',
                status_code=404,
            )

        # Prevent re-assigning a user that's already linked to a different guardian
        if hasattr(user, 'guardian_profile') and user.guardian_profile is not None:
            existing = user.guardian_profile
            if existing.id != guardian.id:
                return error_response(
                    'This user is already linked to another guardian.',
                    'CONFLICT',
                    status_code=409,
                )

        guardian.user = user
        guardian.save(update_fields=['user'])
        return success_response(
            data=GuardianSerializer(guardian).data,
            message='Guardian linked to parent account successfully.',
        )

    @action(detail=True, methods=['post'], url_path='assign-chw', permission_classes=[IsSupervisorOrAdmin])
    def assign_chw(self, request, pk=None):
        """
        POST /api/v1/children/guardians/<id>/assign-chw/
        Body: {"chw_id": "<uuid>"}  — assigns a CHW to this guardian's family.
        Body: {"chw_id": null}      — clears the assignment.
        """
        guardian = self.get_object()
        chw_id = request.data.get('chw_id')

        if chw_id is None:
            guardian.assigned_chw = None
            guardian.save(update_fields=['assigned_chw'])
            return success_response(
                data=GuardianSerializer(guardian).data,
                message='CHW assignment cleared.',
            )

        from apps.accounts.models import CustomUser
        try:
            chw = CustomUser.objects.get(id=chw_id, role=UserRole.CHW, is_active=True)
        except CustomUser.DoesNotExist:
            return error_response('No active CHW found with that ID.', 'NOT_FOUND', status_code=404)

        guardian.assigned_chw = chw
        guardian.save(update_fields=['assigned_chw'])
        return success_response(
            data=GuardianSerializer(guardian).data,
            message=f'Guardian assigned to {chw.full_name}.',
        )


class ChildViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ChildFilter
    search_fields = ['full_name', 'registration_number', 'guardian__full_name']
    ordering_fields = ['full_name', 'date_of_birth', 'created_at']

    def get_queryset(self):
        qs = Child.objects.filter(is_active=True).select_related(
            'camp', 'zone', 'guardian', 'guardian__user', 'registered_by'
        )
        role = self.request.user.role
        if role == UserRole.CHW:
            qs = qs.filter(guardian__assigned_chw=self.request.user)
        elif role == UserRole.PARENT:
            qs = qs.filter(guardian__user=self.request.user)
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return ChildCreateSerializer
        return ChildSerializer

    def create(self, request, *args, **kwargs):
        if request.user.role in (UserRole.PARENT, UserRole.CHW):
            return error_response('Only nurses and supervisors can register children.', 'FORBIDDEN', status_code=403)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        child = serializer.save(registered_by=request.user)

        from apps.vaccinations.schedule import generate_schedule_for_child
        generate_schedule_for_child(child)

        return created_response(
            data=ChildSerializer(child).data,
            message='Child registered successfully.'
        )

    def update(self, request, *args, **kwargs):
        if request.user.role == UserRole.PARENT:
            return error_response('Parents cannot edit child records.', 'FORBIDDEN', status_code=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if request.user.role == UserRole.PARENT:
            return error_response('Parents cannot delete child records.', 'FORBIDDEN', status_code=403)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get'], url_path='history')
    def history(self, request, pk=None):
        """GET /api/v1/children/<id>/history/ — all health records in chronological order."""
        child = self.get_object()
        from apps.health_records.models import HealthRecord
        from apps.health_records.serializers import HealthRecordSerializer
        records = HealthRecord.objects.filter(child=child).order_by('-measurement_date')
        return success_response(data=HealthRecordSerializer(records, many=True).data)

    @action(detail=True, methods=['get'], url_path='vaccinations')
    def vaccinations(self, request, pk=None):
        """GET /api/v1/children/<id>/vaccinations/ — all vaccination records."""
        child = self.get_object()
        from apps.vaccinations.models import VaccinationRecord
        from apps.vaccinations.serializers import VaccinationRecordSerializer
        records = VaccinationRecord.objects.filter(child=child).order_by('scheduled_date')
        return success_response(data=VaccinationRecordSerializer(records, many=True).data)

    @action(detail=True, methods=['get'], url_path='predictions')
    def predictions(self, request, pk=None):
        """GET /api/v1/children/<id>/predictions/ — latest ML predictions."""
        child = self.get_object()
        from apps.ml_engine.models import MLPredictionLog
        predictions = MLPredictionLog.objects.filter(child=child).order_by('-created_at')[:10]
        from apps.ml_engine.serializers import MLPredictionLogSerializer
        return success_response(data=MLPredictionLogSerializer(predictions, many=True).data)

    @action(detail=True, methods=['get', 'post'], url_path='notes',
            permission_classes=[IsAuthenticated])
    def notes(self, request, pk=None):
        """GET/POST /api/v1/children/<child_id>/notes/  — child-level clinical notes."""
        from apps.health_records.models import ClinicalNote
        from apps.health_records.serializers import ClinicalNoteSerializer

        child = self.get_object()

        if request.method == 'GET':
            qs = (
                ClinicalNote.objects
                .filter(child=child, is_active=True)
                .select_related('author')
                .order_by('-is_pinned', '-created_at')
            )
            return success_response(data=ClinicalNoteSerializer(qs, many=True).data)

        if request.user.role not in (UserRole.NURSE, UserRole.SUPERVISOR, UserRole.ADMIN):
            return error_response(
                'Only nurses and above may add clinical notes.',
                'FORBIDDEN',
                status_code=403,
            )
        serializer = ClinicalNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = serializer.save(author=request.user, child=child)
        return created_response(
            data=ClinicalNoteSerializer(note).data,
            message='Clinical note added.',
        )

    @action(detail=True, methods=['get'], url_path='qr')
    def qr_code(self, request, pk=None):
        """GET /api/v1/children/<id>/qr/ — returns qr_code string + base64-encoded PNG."""
        child = self.get_object()
        try:
            import qrcode
            qr = qrcode.QRCode(box_size=8, border=2)
            qr.add_data(child.qr_code)
            qr.make(fit=True)
            img = qr.make_image(fill_color='black', back_color='white')
            buf = io.BytesIO()
            img.save(buf, format='PNG')
            png_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        except ImportError:
            png_b64 = None
        return success_response(data={'qr_code': child.qr_code, 'png_base64': png_b64})

    @action(detail=True, methods=['post'], url_path='close', permission_classes=[IsSupervisorOrAdmin])
    def close(self, request, pk=None):
        """
        POST /api/v1/children/<id>/close/
        Body: {"status": "DECEASED|TRANSFERRED|DEPARTED", "reason": "..."}
        Nurse, Supervisor, Admin. Sets closure_status + creates ChildClosure record.
        """
        from apps.accounts.permissions import IsNurseOrSupervisorOrAdmin
        if not IsNurseOrSupervisorOrAdmin().has_permission(request, self):
            return error_response('Permission denied.', 'FORBIDDEN', status_code=403)
        child = self.get_object()
        status_val = request.data.get('status', '').upper()
        reason = request.data.get('reason', '').strip()
        allowed = ('DECEASED', 'TRANSFERRED', 'DEPARTED')
        if status_val not in allowed:
            return error_response(f'status must be one of {allowed}.', 'VALIDATION_ERROR')
        if not reason:
            return error_response('reason is required.', 'VALIDATION_ERROR')
        ChildClosure.objects.create(
            child=child, status=status_val, reason=reason, closed_by=request.user,
        )
        child.closure_status = status_val
        child.is_active = False
        child.save(update_fields=['closure_status', 'is_active', 'updated_at'])
        return success_response(
            data=ChildSerializer(child).data,
            message=f'{child.full_name} marked as {status_val}.',
        )

    @action(detail=True, methods=['post'], url_path='transfer-zone', permission_classes=[IsSupervisorOrAdmin])
    def transfer_zone(self, request, pk=None):
        """
        POST /api/v1/children/<id>/transfer-zone/
        Body: {"to_zone": "<zone_id>", "to_camp": "<camp_id>", "reason": "..."}
        Creates ChildZoneTransfer + updates child.zone (and camp if cross-camp).
        Notifies old + new CHW.
        """
        child = self.get_object()
        to_zone_id = request.data.get('to_zone')
        to_camp_id = request.data.get('to_camp')
        reason = request.data.get('reason', '')

        from apps.camps.models import CampZone, Camp
        to_zone = None
        to_camp = None
        if to_zone_id:
            try:
                to_zone = CampZone.objects.get(id=to_zone_id)
            except CampZone.DoesNotExist:
                return error_response('Zone not found.', 'NOT_FOUND', status_code=404)
        if to_camp_id:
            try:
                to_camp = Camp.objects.get(id=to_camp_id)
            except Camp.DoesNotExist:
                return error_response('Camp not found.', 'NOT_FOUND', status_code=404)

        ChildZoneTransfer.objects.create(
            child=child,
            from_zone=child.zone,
            to_zone=to_zone,
            from_camp=child.camp,
            to_camp=to_camp or child.camp,
            initiated_by=request.user,
            reason=reason,
        )
        old_zone = child.zone
        child.zone = to_zone
        if to_camp:
            child.camp = to_camp
        child.save(update_fields=['zone', 'camp', 'updated_at'])

        # Notify old + new CHW if zone-coordinator assignments exist
        _notify_transfer(child, old_zone, to_zone)

        return success_response(
            data=ChildSerializer(child).data,
            message='Zone transfer recorded.',
        )


def _notify_transfer(child, from_zone, to_zone):
    """Best-effort notification to old and new CHW after a zone transfer."""
    try:
        from apps.notifications.tasks import send_push_task
        from apps.camps.models import CHWZoneAssignment
        chw_ids = set()
        if from_zone:
            chw_ids.update(
                CHWZoneAssignment.objects.filter(
                    zone=from_zone, is_active=True
                ).values_list('chw_id', flat=True)
            )
        if to_zone:
            chw_ids.update(
                CHWZoneAssignment.objects.filter(
                    zone=to_zone, is_active=True
                ).values_list('chw_id', flat=True)
            )
        for chw_id in chw_ids:
            send_push_task.delay(
                user_id=str(chw_id),
                title='Zone transfer',
                body=f'{child.full_name} has been transferred to your zone.',
                data={'child_id': str(child.id)},
            )
    except Exception:
        pass


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def duplicate_check_view(request):
    """
    GET /api/v1/children/duplicate-check/?dob=YYYY-MM-DD&guardian_phone=&full_name=
    Returns fuzzy-matched children for duplicate detection before registration.
    Matches: exact DOB + guardian phone OR name similarity (startswith).
    """
    dob = request.query_params.get('dob', '').strip()
    phone = request.query_params.get('guardian_phone', '').strip()
    name = request.query_params.get('full_name', '').strip()

    if not dob:
        return error_response('dob is required.', 'VALIDATION_ERROR', status_code=400)

    qs = Child.objects.filter(is_active=True, date_of_birth=dob).select_related(
        'camp', 'zone', 'guardian', 'registered_by'
    )
    if phone:
        qs = qs.filter(guardian__phone_number__icontains=phone[-6:])  # last 6 digits to handle prefix variants
    if name:
        qs = qs.filter(full_name__icontains=name[:4])  # loose prefix match

    return success_response(data=ChildSerializer(qs[:10], many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def scan_qr_view(request, qr_code):
    """GET /api/v1/children/scan/<qr_code>/ — look up a child by QR code string."""
    try:
        child = Child.objects.get(qr_code=qr_code, is_active=True)
    except Child.DoesNotExist:
        return error_response('Child not found.', 'NOT_FOUND', status_code=404)
    return success_response(data=ChildSerializer(child).data)


class VisitRequestViewSet(viewsets.ModelViewSet):
    """
    CRUD + lifecycle actions on VisitRequest.

    Scoping:
      PARENT  — can create for own children; can list own requests.
      CHW     — can list requests for their assigned children; can accept/decline/complete.
      SUPERVISOR/ADMIN/NURSE — read-only on all requests in their camp.
    """
    serializer_class = VisitRequestSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        qs = VisitRequest.objects.select_related(
            'child', 'requested_by', 'assigned_chw'
        )
        if user.role == UserRole.PARENT:
            qs = qs.filter(requested_by=user)
        elif user.role == UserRole.CHW:
            qs = qs.filter(child__guardian__assigned_chw=user)
        elif user.role in (UserRole.NURSE, UserRole.SUPERVISOR):
            if user.camp_id:
                qs = qs.filter(child__camp_id=user.camp_id)
        # ADMIN sees all
        return qs.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        if request.user.role != UserRole.PARENT:
            return error_response('Only parents can submit visit requests.', 'FORBIDDEN', status_code=403)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        child = serializer.validated_data['child']

        # Verify child belongs to this parent
        if not Child.objects.filter(id=child.id, guardian__user=request.user).exists():
            return error_response('You can only request visits for your own children.', 'FORBIDDEN', status_code=403)

        vr = serializer.save(requested_by=request.user, status=VisitRequestStatus.PENDING)

        from apps.notifications.tasks import notify_visit_request_created
        notify_visit_request_created.delay(str(vr.id))

        return created_response(
            data=VisitRequestSerializer(vr).data,
            message='Visit request submitted successfully.',
        )

    @action(detail=True, methods=['post'], url_path='accept')
    def accept(self, request, pk=None):
        """POST /api/v1/visit-requests/<id>/accept/ — CHW accepts the request."""
        if request.user.role != UserRole.CHW:
            return error_response('Only CHWs can accept visit requests.', 'FORBIDDEN', status_code=403)

        vr = self.get_object()
        if vr.status != VisitRequestStatus.PENDING:
            return error_response(f'Cannot accept a request with status {vr.status}.', 'INVALID_STATE')

        vr.status = VisitRequestStatus.ACCEPTED
        vr.assigned_chw = request.user
        vr.accepted_at = tz.now()
        vr.eta = request.data.get('eta')  # Optional ISO datetime string
        vr.save(update_fields=['status', 'assigned_chw', 'accepted_at', 'eta', 'updated_at'])

        from apps.notifications.tasks import notify_visit_request_accepted
        notify_visit_request_accepted.delay(str(vr.id))

        return success_response(data=VisitRequestSerializer(vr).data, message='Visit request accepted.')

    @action(detail=True, methods=['post'], url_path='decline')
    def decline(self, request, pk=None):
        """POST /api/v1/visit-requests/<id>/decline/ — CHW declines with optional reason."""
        if request.user.role != UserRole.CHW:
            return error_response('Only CHWs can decline visit requests.', 'FORBIDDEN', status_code=403)

        vr = self.get_object()
        if vr.status != VisitRequestStatus.PENDING:
            return error_response(f'Cannot decline a request with status {vr.status}.', 'INVALID_STATE')

        vr.status = VisitRequestStatus.DECLINED
        vr.decline_reason = request.data.get('reason', '')
        vr.save(update_fields=['status', 'decline_reason', 'updated_at'])

        from apps.notifications.tasks import notify_visit_request_declined
        notify_visit_request_declined.delay(str(vr.id))

        return success_response(data=VisitRequestSerializer(vr).data, message='Visit request declined.')

    @action(detail=True, methods=['post'], url_path='complete')
    def complete(self, request, pk=None):
        """POST /api/v1/visit-requests/<id>/complete/ — CHW marks the visit as done."""
        if request.user.role != UserRole.CHW:
            return error_response('Only CHWs can complete visit requests.', 'FORBIDDEN', status_code=403)

        vr = self.get_object()
        if vr.status != VisitRequestStatus.ACCEPTED:
            return error_response(f'Cannot complete a request with status {vr.status}.', 'INVALID_STATE')

        vr.status = VisitRequestStatus.COMPLETED
        vr.completed_at = tz.now()
        vr.save(update_fields=['status', 'completed_at', 'updated_at'])

        from apps.notifications.tasks import notify_visit_request_completed
        notify_visit_request_completed.delay(str(vr.id))

        return success_response(data=VisitRequestSerializer(vr).data, message='Visit marked as complete.')
