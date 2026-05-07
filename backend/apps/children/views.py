import base64
import io
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.core.responses import success_response, created_response, error_response
from apps.core.pagination import StandardPagination
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
        # link-account is callable by any authenticated user (NURSE creates parent links)
        if self.action == 'link_account':
            return [IsAuthenticated()]
        # assign-chw restricted to supervisor/admin
        if self.action == 'assign_chw':
            from apps.accounts.permissions import IsSupervisorOrAdmin as _SA
            return [_SA()]
        if self.request.method in ('POST', 'PATCH', 'DELETE'):
            return [IsSupervisorOrAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        from django.db.models import Count, Q
        qs = Guardian.objects.select_related('user', 'assigned_chw').annotate(
            children_count=Count('children', filter=Q(children__is_active=True), distinct=True)
        )
        user = self.request.user
        if user.role == UserRole.NURSE and user.camp_id:
            qs = qs.filter(children__camp_id=user.camp_id).distinct()
        elif user.role == UserRole.CHW:
            qs = qs.filter(assigned_chw=user)
        # Exclude orphan guardians (no active children AND no linked user) by default
        if self.request.query_params.get('include_orphans') != 'true':
            qs = qs.filter(Q(children_count__gt=0) | Q(user__isnull=False))
        return qs.order_by('full_name')

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

    @action(detail=True, methods=['get'], url_path='family-overview')
    def family_overview(self, request, pk=None):
        """
        GET /api/v1/children/guardians/<id>/family-overview/
        Returns a rich family profile for a guardian:
          - Guardian details
          - All their children with latest health record, vaccination summary, risk level
          - Household nutrition status summary
          - Vaccination coverage rate across all children
          - Overall family risk level (worst child drives it)
          - Recent clinical notes (pinned + last 5)
          - Recent visit requests
        Accessible to: NURSE, SUPERVISOR, ADMIN, and the guardian's own linked PARENT account.
        """
        from django.db.models import Subquery, OuterRef
        from apps.vaccinations.models import VaccinationRecord, DoseStatus
        from apps.health_records.models import HealthRecord, ClinicalNote

        guardian = self.get_object()

        # Auth: parent can only see own profile
        user = request.user
        if user.role == UserRole.PARENT:
            linked = getattr(user, 'guardian_profile', None)
            if linked is None or linked.id != guardian.id:
                return error_response('You can only view your own family profile.', 'FORBIDDEN', status_code=403)

        children_qs = Child.objects.filter(
            guardian=guardian, is_active=True, deletion_requested_at__isnull=True,
        ).select_related('camp', 'zone')

        # Latest health record per child (subquery)
        latest_hr_id = (
            HealthRecord.objects
            .filter(child=OuterRef('pk'))
            .order_by('-measurement_date', '-created_at')
            .values('id')[:1]
        )

        children_with_latest = children_qs.annotate(latest_hr_id=Subquery(latest_hr_id))

        # Batch-fetch latest health records and all vaccination records
        child_ids = list(children_qs.values_list('id', flat=True))
        latest_hr_ids = [c.latest_hr_id for c in children_with_latest if c.latest_hr_id]
        hr_map = {
            str(hr.child_id): hr
            for hr in HealthRecord.objects.filter(id__in=latest_hr_ids).select_related('child')
        }

        # Vaccination summary per child
        all_vax = VaccinationRecord.objects.filter(child_id__in=child_ids).values(
            'child_id', 'status'
        )
        vax_map: dict[str, dict[str, int]] = {}
        for row in all_vax:
            cid = str(row['child_id'])
            if cid not in vax_map:
                vax_map[cid] = {'SCHEDULED': 0, 'DONE': 0, 'MISSED': 0, 'SKIPPED': 0}
            vax_map[cid][row['status']] = vax_map[cid].get(row['status'], 0) + 1

        # Build child summaries
        risk_order = {'HIGH': 3, 'MEDIUM': 2, 'LOW': 1, 'UNKNOWN': 0}
        family_risk = 'LOW'
        total_done = 0
        total_vax = 0
        nutrition_counts: dict[str, int] = {}
        children_data = []

        for child in children_with_latest:
            cid = str(child.id)
            hr = hr_map.get(cid)
            vax = vax_map.get(cid, {})
            done = vax.get('DONE', 0)
            total_doses = sum(vax.values())
            total_done += done
            total_vax += total_doses

            risk = (hr.risk_level if hr else 'UNKNOWN').upper()
            if risk_order.get(risk, 0) > risk_order.get(family_risk, 0):
                family_risk = risk

            status = hr.nutrition_status if hr else 'UNKNOWN'
            nutrition_counts[status] = nutrition_counts.get(status, 0) + 1

            # Last 3 health records for trend
            recent_hrs = HealthRecord.objects.filter(child=child).order_by('-measurement_date')[:3]

            children_data.append({
                'id': cid,
                'full_name': child.full_name,
                'registration_number': child.registration_number,
                'age_display': getattr(child, 'age_display', ''),
                'age_months': getattr(child, 'age_months', None),
                'sex': child.sex,
                'date_of_birth': str(child.date_of_birth),
                'camp_name': child.camp.name if child.camp else None,
                'zone_name': child.zone.name if child.zone else None,
                'risk_level': risk,
                'nutrition_status': status,
                'nutrition_status_display': hr.nutrition_status_display if hr else '—',
                'latest_weight_kg': str(hr.weight_kg) if hr and hr.weight_kg else None,
                'latest_height_cm': str(hr.height_cm) if hr and hr.height_cm else None,
                'latest_muac_cm': str(hr.muac_cm) if hr and hr.muac_cm else None,
                'last_visit_date': str(hr.measurement_date) if hr else None,
                'vaccination': {
                    'total': total_doses,
                    'done': done,
                    'missed': vax.get('MISSED', 0),
                    'scheduled': vax.get('SCHEDULED', 0),
                    'coverage_pct': round((done / total_doses * 100) if total_doses else 0, 1),
                    'is_overdue': vax.get('SCHEDULED', 0) > 0,
                },
                'health_trend': [
                    {
                        'date': str(r.measurement_date),
                        'risk_level': r.risk_level,
                        'weight_kg': str(r.weight_kg) if r.weight_kg else None,
                        'muac_cm': str(r.muac_cm) if r.muac_cm else None,
                        'nutrition_status': r.nutrition_status,
                    }
                    for r in recent_hrs
                ],
            })

        # Pinned notes + last 5 notes across all children
        recent_notes = list(
            ClinicalNote.objects
            .filter(child_id__in=child_ids)
            .select_related('author', 'child')
            .order_by('-is_pinned', '-created_at')[:8]
        )
        notes_data = [
            {
                'id': str(n.id),
                'child_id': str(n.child_id),
                'child_name': n.child.full_name,
                'note_type': n.note_type,
                'note_type_display': n.get_note_type_display(),
                'content': n.content,
                'is_pinned': n.is_pinned,
                'author_name': n.author.full_name if n.author else None,
                'created_at': n.created_at.isoformat(),
            }
            for n in recent_notes
        ]

        # Recent visit requests
        recent_vr = list(
            VisitRequest.objects
            .filter(child_id__in=child_ids)
            .select_related('child', 'requested_by', 'assigned_chw')
            .order_by('-created_at')[:5]
        )
        vr_data = [
            {
                'id': str(vr.id),
                'child_id': str(vr.child_id),
                'child_name': vr.child.full_name,
                'urgency': vr.urgency,
                'status': vr.status,
                'concern_text': vr.concern_text,
                'created_at': vr.created_at.isoformat(),
            }
            for vr in recent_vr
        ]

        overview = {
            'guardian': GuardianSerializer(guardian).data,
            'family_risk_level': family_risk,
            'total_children': len(children_data),
            'vaccination_coverage_pct': round((total_done / total_vax * 100) if total_vax else 0, 1),
            'nutrition_summary': nutrition_counts,
            'children': children_data,
            'recent_notes': notes_data,
            'recent_visit_requests': vr_data,
        }
        return success_response(data=overview)


class ChildViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ChildFilter
    search_fields = ['full_name', 'registration_number', 'guardian__full_name']
    ordering_fields = ['full_name', 'date_of_birth', 'created_at']
    pagination_class = StandardPagination

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
        # Prevent hard deletes via the standard DELETE endpoint.
        # Use /request-deletion/ for a safe 3-day grace period.
        return error_response(
            'Direct deletion is disabled. Use POST /children/<id>/request-deletion/ '
            'to schedule deletion with a 3-day recovery window.',
            'METHOD_NOT_ALLOWED',
            status_code=405,
        )

    @action(detail=True, methods=['post'], url_path='request-deletion')
    def request_deletion(self, request, pk=None):
        """
        POST /api/v1/children/<id>/request-deletion/
        Marks the child for permanent deletion in 3 days. Nurse/Supervisor/Admin only.
        The record stays fully accessible during this window and can be recovered.
        """
        from datetime import timedelta
        if request.user.role not in (UserRole.NURSE, UserRole.SUPERVISOR, UserRole.ADMIN):
            return error_response('Only nurses and above can request deletion.', 'FORBIDDEN', status_code=403)
        child = self.get_object()
        if child.deletion_requested_at:
            due = child.deletion_requested_at + timedelta(days=3)
            return error_response(
                f'Deletion already requested. Due for permanent removal on {due.date()}.',
                'CONFLICT',
                status_code=409,
            )
        child.deletion_requested_at = tz.now()
        child.deletion_requested_by = request.user
        child.save(update_fields=['deletion_requested_at', 'deletion_requested_by', 'updated_at'])
        due = child.deletion_requested_at + timedelta(days=3)
        return success_response(
            data={
                'deletion_requested_at': child.deletion_requested_at.isoformat(),
                'deletion_due_at': due.isoformat(),
            },
            message=f'{child.full_name} is scheduled for deletion on {due.date()}. Cancel within 3 days to recover.',
        )

    @action(detail=True, methods=['post'], url_path='cancel-deletion')
    def cancel_deletion(self, request, pk=None):
        """
        POST /api/v1/children/<id>/cancel-deletion/
        Cancels a pending deletion request. Available to any authenticated user with access.
        """
        child = self.get_object()
        if not child.deletion_requested_at:
            return error_response('No pending deletion to cancel.', 'NOT_FOUND', status_code=404)
        child.deletion_requested_at = None
        child.deletion_requested_by = None
        child.save(update_fields=['deletion_requested_at', 'deletion_requested_by', 'updated_at'])
        return success_response(message=f'Deletion cancelled. {child.full_name} will not be removed.')

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
        try:
            notify_visit_request_created.delay(str(vr.id))
        except Exception:
            notify_visit_request_created(str(vr.id))

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
        try:
            notify_visit_request_accepted.delay(str(vr.id))
        except Exception:
            notify_visit_request_accepted(str(vr.id))

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
        try:
            notify_visit_request_declined.delay(str(vr.id))
        except Exception:
            notify_visit_request_declined(str(vr.id))

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
        try:
            notify_visit_request_completed.delay(str(vr.id))
        except Exception:
            notify_visit_request_completed(str(vr.id))

        return success_response(data=VisitRequestSerializer(vr).data, message='Visit marked as complete.')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def daily_plan_view(request):
    """
    GET /api/v1/chw/daily-plan/
    Returns the CHW's prioritised visit list for today, ranked by:
      1. Pending visit requests (urgent first)
      2. HIGH risk children
      3. Overdue vaccination
      4. Children not visited in >30 days
      5. Children never visited
    CHW role only; scoped to their assigned children (guardian.assigned_chw).
    """
    from django.utils import timezone
    from apps.accounts.models import UserRole
    from apps.vaccinations.models import VaccinationRecord, DoseStatus
    from apps.health_records.models import HealthRecord

    user = request.user
    if user.role != UserRole.CHW:
        return error_response('Only CHWs can access the daily plan.', 'FORBIDDEN', status_code=403)

    today = timezone.now().date()

    # Base queryset: children assigned to this CHW
    children = Child.objects.filter(
        guardian__assigned_chw=user,
        is_active=True,
        deletion_requested_at__isnull=True,
    ).select_related('zone', 'camp', 'guardian')

    # Latest health record per child for risk_level
    from django.db.models import Subquery, OuterRef, Max
    latest_hr_date = (
        HealthRecord.objects
        .filter(child=OuterRef('pk'))
        .order_by('-measurement_date')
        .values('measurement_date')[:1]
    )
    latest_risk = (
        HealthRecord.objects
        .filter(child=OuterRef('pk'))
        .order_by('-measurement_date')
        .values('risk_level')[:1]
    )
    latest_visit_date = (
        HealthRecord.objects
        .filter(child=OuterRef('pk'))
        .order_by('-measurement_date')
        .values('measurement_date')[:1]
    )

    children = children.annotate(
        latest_risk=Subquery(latest_risk),
        last_visit=Subquery(latest_visit_date),
    )

    # Pending visit requests
    pending_vr_child_ids = set(
        VisitRequest.objects.filter(
            child__guardian__assigned_chw=user,
            status=VisitRequestStatus.PENDING,
        ).values_list('child_id', flat=True)
    )

    # Overdue vaccination child IDs
    overdue_vax_child_ids = set(
        VaccinationRecord.objects.filter(
            child__guardian__assigned_chw=user,
            status=DoseStatus.SCHEDULED,
            scheduled_date__lt=today,
        ).values_list('child_id', flat=True)
    )

    result = []
    for child in children:
        risk = (child.latest_risk or 'UNKNOWN').upper()
        last_visit = child.last_visit
        last_visit_days = (today - last_visit).days if last_visit else None

        has_request = child.id in pending_vr_child_ids
        has_overdue = child.id in overdue_vax_child_ids
        never_visited = last_visit is None

        reasons = []
        score = 0
        if has_request:
            reasons.append('Visit request')
            score += 40
        if risk == 'HIGH':
            reasons.append('High risk')
            score += 30
        elif risk == 'MEDIUM':
            score += 10
        if has_overdue:
            reasons.append('Overdue vaccine')
            score += 20
        if never_visited:
            reasons.append('Never visited')
            score += 15
        elif last_visit_days is not None and last_visit_days > 30:
            reasons.append(f'Last visit {last_visit_days}d ago')
            score += 5

        from apps.children.serializers import ChildSerializer as _CS
        age_display = getattr(child, 'age_display', '')

        result.append({
            'child_id': str(child.id),
            'child_name': child.full_name,
            'registration_number': child.registration_number,
            'age_display': age_display,
            'priority_score': score,
            'priority_reasons': reasons,
            'risk_level': risk,
            'has_pending_request': has_request,
            'has_overdue_vaccine': has_overdue,
            'last_visit_days_ago': last_visit_days,
        })

    result.sort(key=lambda x: -x['priority_score'])
    return success_response(data=result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def chw_families_view(request):
    """
    GET /api/v1/chw/families/
    Returns all families (guardians + their children) assigned to the calling CHW.
    Each child includes: risk_level, last_visit_date, overdue/upcoming vaccine counts.
    CHW role only.
    """
    from django.utils import timezone
    from apps.accounts.models import UserRole
    from apps.vaccinations.models import VaccinationRecord, DoseStatus
    from apps.health_records.models import HealthRecord
    from django.db.models import Subquery, OuterRef, Count, Q

    user = request.user
    if user.role != UserRole.CHW:
        return error_response('Only CHWs can access family caseload.', 'FORBIDDEN', status_code=403)

    today = timezone.now().date()

    guardians = Guardian.objects.filter(
        assigned_chw=user,
    ).select_related('user').prefetch_related(
        'children__zone', 'children__camp',
    ).order_by('full_name')

    # Latest risk per child via subquery
    latest_risk_sq = (
        HealthRecord.objects
        .filter(child=OuterRef('pk'))
        .order_by('-measurement_date')
        .values('risk_level')[:1]
    )
    latest_visit_sq = (
        HealthRecord.objects
        .filter(child=OuterRef('pk'))
        .order_by('-measurement_date')
        .values('measurement_date')[:1]
    )

    result = []
    for guardian in guardians:
        children_qs = Child.objects.filter(
            guardian=guardian,
            is_active=True,
            deletion_requested_at__isnull=True,
        ).select_related('zone', 'camp').annotate(
            latest_risk=Subquery(latest_risk_sq),
            last_visit=Subquery(latest_visit_sq),
        )

        children_data = []
        for child in children_qs:
            risk = (child.latest_risk or 'UNKNOWN').upper()
            last_visit = child.last_visit
            last_visit_days = (today - last_visit).days if last_visit else None

            overdue_count = VaccinationRecord.objects.filter(
                child=child,
                status=DoseStatus.SCHEDULED,
                scheduled_date__lt=today,
            ).count()
            upcoming_count = VaccinationRecord.objects.filter(
                child=child,
                status=DoseStatus.SCHEDULED,
                scheduled_date__gte=today,
                scheduled_date__lte=today + timezone.timedelta(days=30),
            ).count()

            # Next scheduled vaccine
            next_vax = VaccinationRecord.objects.filter(
                child=child,
                status=DoseStatus.SCHEDULED,
            ).select_related('vaccine').order_by('scheduled_date').first()

            children_data.append({
                'id': str(child.id),
                'full_name': child.full_name,
                'registration_number': child.registration_number,
                'sex': child.sex,
                'date_of_birth': str(child.date_of_birth),
                'age_display': child.age_display,
                'age_months': child.age_months,
                'zone_name': child.zone.name if child.zone else None,
                'camp_name': child.camp.name if child.camp else None,
                'risk_level': risk,
                'last_visit_date': str(last_visit) if last_visit else None,
                'last_visit_days_ago': last_visit_days,
                'overdue_vaccines': overdue_count,
                'upcoming_vaccines': upcoming_count,
                'next_vaccine_name': next_vax.vaccine.name if next_vax else None,
                'next_vaccine_date': str(next_vax.scheduled_date) if next_vax else None,
                'next_vaccine_overdue': next_vax.is_overdue if next_vax else False,
            })

        result.append({
            'id': str(guardian.id),
            'full_name': guardian.full_name,
            'phone_number': guardian.phone_number,
            'relationship': guardian.relationship,
            'has_account': guardian.user_id is not None,
            'user_email': guardian.user.email if guardian.user else None,
            'children': children_data,
        })

    return success_response(data=result)
