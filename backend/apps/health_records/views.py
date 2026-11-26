import logging
from django.utils import timezone
from rest_framework import viewsets, filters, mixins
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet
from django_filters.rest_framework import DjangoFilterBackend

from apps.core.responses import success_response, created_response, error_response
from apps.accounts.models import UserRole
from .models import HealthRecord, ClinicalNote, AmendmentLog
from .serializers import HealthRecordSerializer, ClinicalNoteSerializer
from apps.core.scoping import scope_children, can_access_child

logger = logging.getLogger(__name__)


def run_risk_prediction(record):
    """Build feature vector, call prediction service, persist results on record."""
    try:
        from apps.ml_engine.features import build_feature_vector
        from apps.ml_engine.prediction_service import PredictionService

        features = build_feature_vector(record)
        if features is None:
            return

        result = PredictionService.predict(features)
        if result is None:
            # Model not loaded yet — keep risk_level null, schedule async fallback
            try:
                from apps.health_records.tasks import run_malnutrition_prediction
                run_malnutrition_prediction.delay(str(record.id))
            except Exception:
                pass
            return

        record.risk_level = result['risk_level']
        record.risk_factors = result.get('top_factors', [])
        record.model_version = result.get('model_version', '')
        record.save(update_fields=['risk_level', 'risk_factors', 'model_version', 'updated_at'])
    except Exception as e:
        logger.warning('Prediction failed for record %s: %s', record.id, e)


class HealthRecordViewSet(viewsets.ModelViewSet):
    queryset = HealthRecord.objects.select_related('child', 'recorded_by', 'zone').all()
    serializer_class = HealthRecordSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['child', 'nutrition_status', 'measurement_date', 'risk_level', 'zone']
    search_fields = ['child__full_name', 'child__registration_number']
    ordering_fields = ['measurement_date', 'created_at']
    http_method_names = ['get', 'post', 'patch', 'head', 'options']  # patch only via /amend/ action

    def get_queryset(self):
        user = self.request.user
        qs = HealthRecord.objects.select_related('child', 'recorded_by', 'zone').filter(is_active=True)
        return scope_children(qs, user, prefix='child__').order_by('-measurement_date')

    def list(self, request, *args, **kwargs):
        """Override list to return the standard {data, pagination} envelope."""
        from rest_framework.response import Response
        qs = self.filter_queryset(self.get_queryset())
        total = qs.count()
        page = self.paginate_queryset(qs)
        items = self.get_serializer(page if page is not None else qs, many=True).data
        return Response({
            'success': True,
            'data': items,
            'pagination': {'count': total},
            'message': '',
        })

    def create(self, request, *args, **kwargs):
        if request.user.role not in (UserRole.CHW, UserRole.NURSE):
            return error_response('Only CHWs and nurses can record measurements.', 'FORBIDDEN', status_code=403)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not can_access_child(request.user, serializer.validated_data['child']):
            return error_response('Child not found.', 'NOT_FOUND', status_code=404)
        record = serializer.save(recorded_by=request.user)

        # Run ML prediction synchronously so the response includes risk_level + risk_factors
        self._run_prediction(record)

        # If HIGH risk — notify immediately (sync fallback when Celery unavailable)
        if record.risk_level == 'HIGH':
            from apps.notifications.tasks import notify_high_risk
            try:
                notify_high_risk.delay(str(record.id))
            except Exception:
                try:
                    notify_high_risk(str(record.id))
                except Exception as e:
                    logger.warning('notify_high_risk failed for record %s: %s', record.id, e)

        return created_response(
            data=HealthRecordSerializer(record).data,
            message='Health record saved with risk assessment.',
        )

    def _run_prediction(self, record):
        run_risk_prediction(record)

    @action(detail=True, methods=['get', 'post'], url_path='notes',
            permission_classes=[IsAuthenticated])
    def notes(self, request, pk=None):
        """GET/POST /api/v1/health-records/<hr_id>/notes/"""
        health_record = self.get_object()

        if request.method == 'GET':
            qs = (
                ClinicalNote.objects
                .filter(health_record=health_record, is_active=True)
                .select_related('author')
                .order_by('-is_pinned', '-created_at')
            )
            return success_response(data=ClinicalNoteSerializer(qs, many=True).data)

        # POST — write restricted to NURSE / SUPERVISOR / ADMIN
        if request.user.role not in (UserRole.NURSE, UserRole.SUPERVISOR, UserRole.ADMIN):
            return error_response(
                'Only nurses and above may add clinical notes.',
                'FORBIDDEN',
                status_code=403,
            )
        serializer = ClinicalNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = serializer.save(author=request.user, health_record=health_record)
        return created_response(
            data=ClinicalNoteSerializer(note).data,
            message='Clinical note added.',
        )

    @action(detail=True, methods=['patch'], url_path='amend')
    def amend(self, request, pk=None):
        """
        PATCH /api/v1/health-records/<id>/amend/
        Body: {<fields to amend>, reason: "..."}
        CHW: 24 h window from record creation. Nurse/Admin: any time.
        Creates AmendmentLog + updates the record.
        """
        record = self.get_object()
        reason = request.data.get('reason', '').strip()
        if not reason:
            return error_response('reason is required for amendments.', 'VALIDATION_ERROR')

        user = request.user
        # CHW: can only amend records they personally recorded, within 24 h
        if user.role == UserRole.CHW:
            if record.recorded_by_id != user.pk:
                return error_response(
                    'You can only amend records you personally recorded.',
                    'FORBIDDEN',
                    status_code=403,
                )
            age = timezone.now() - record.created_at
            if age.total_seconds() > 86400:
                return error_response(
                    'CHW amendment window has expired (24 h from record creation).',
                    'AMENDMENT_WINDOW_EXPIRED',
                    status_code=403,
                )

        # Snapshot before
        allowed_fields = ['weight_kg', 'height_cm', 'muac_cm', 'oedema', 'notes',
                          'temperature_c', 'respiratory_rate', 'heart_rate', 'spo2']
        update_data = {k: v for k, v in request.data.items() if k in allowed_fields}
        if not update_data:
            return error_response('No amendable fields provided.', 'VALIDATION_ERROR')

        before_data = {k: str(getattr(record, k, '')) for k in update_data}

        serializer = self.get_serializer(record, data=update_data, partial=True)
        if not serializer.is_valid():
            return error_response(str(serializer.errors), 'VALIDATION_ERROR')
        serializer.save()

        after_data = {k: str(getattr(record, k, '')) for k in update_data}

        from django.contrib.contenttypes.models import ContentType
        AmendmentLog.objects.create(
            content_type=ContentType.objects.get_for_model(HealthRecord),
            object_id=record.id,
            amended_by=user,
            reason=reason,
            before_data=before_data,
            after_data=after_data,
        )
        return success_response(
            data=HealthRecordSerializer(record).data,
            message='Record amended and logged.',
        )

    def update(self, request, *args, **kwargs):
        # Generic PUT/PATCH would bypass the AmendmentLog audit trail — use /amend/ instead.
        return error_response('Use PATCH /health-records/<id>/amend/ to change a record.',
                              'METHOD_NOT_ALLOWED', status_code=405)

    @action(detail=False, methods=['get'], url_path='zone-summary')
    def zone_summary(self, request):
        """GET /api/v1/health-records/zone-summary/?zone=<id>"""
        if request.user.role == UserRole.PARENT:
            return error_response('Permission denied.', 'FORBIDDEN', status_code=403)
        zone_id = request.query_params.get('zone')
        if not zone_id:
            return error_response('zone query param required.', 'VALIDATION_ERROR')
        dist = {'LOW': 0, 'MEDIUM': 0, 'HIGH': 0, 'UNKNOWN': 0}
        records = self.get_queryset().filter(zone_id=zone_id)
        for r in records:
            dist[r.risk_level or 'UNKNOWN'] = dist.get(r.risk_level or 'UNKNOWN', 0) + 1
        return success_response(data={'zone_id': zone_id, 'risk_distribution': dist, 'total': records.count()})


# ---------------------------------------------------------------------------
# Standalone ClinicalNote viewset  (PATCH / DELETE /api/v1/notes/<id>/)
# ---------------------------------------------------------------------------

class ClinicalNoteViewSet(
    GenericViewSet,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
):
    """
    Retrieve, edit, or soft-delete an individual clinical note.

    Listing is intentionally omitted here — notes are always accessed
    through the parent resource (/health-records/<id>/notes/ or
    /children/<id>/notes/) where access control is inherited from the
    parent viewset's get_object().
    """
    serializer_class  = ClinicalNoteSerializer
    http_method_names = ['get', 'patch', 'delete', 'head', 'options']
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ClinicalNote.objects.filter(is_active=True).select_related('author')
        # A note targets either a child directly or a child's health record
        user = self.request.user
        if user.role == UserRole.ADMIN:
            return qs
        from apps.core.scoping import child_scope_q
        return qs.filter(child_scope_q(user, 'child__') | child_scope_q(user, 'health_record__child__'))

    def _check_ownership(self, note):
        u = self.request.user
        return u.role == UserRole.ADMIN or note.author_id == u.id

    def partial_update(self, request, *args, **kwargs):
        note = self.get_object()
        if not self._check_ownership(note):
            return error_response(
                'You can only edit your own notes.',
                'FORBIDDEN',
                status_code=403,
            )
        serializer = self.get_serializer(note, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(data=serializer.data, message='Note updated.')

    def destroy(self, request, *args, **kwargs):
        note = self.get_object()
        if not self._check_ownership(note):
            return error_response(
                'You can only delete your own notes.',
                'FORBIDDEN',
                status_code=403,
            )
        note.soft_delete()
        return success_response(message='Note removed.')


# ── Growth chart endpoint (standalone function-based view) ─────────────────────

from rest_framework.decorators import api_view, permission_classes
from apps.children.models import Child
from drf_spectacular.utils import extend_schema
from drf_spectacular.openapi import OpenApiTypes


@extend_schema(exclude=True)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def growth_data_view(request, child_id):
    """
    GET /api/v1/growth-data/<child_id>/
    Returns measurement time-series + WHO percentile bands (p3/p15/p50/p85/p97).
    PARENT callers receive only parent_summary (no z-scores, no WHO bands).
    """
    try:
        child = Child.objects.get(id=child_id)
    except Child.DoesNotExist:
        return error_response('Child not found.', 'NOT_FOUND', status_code=404)
    if not can_access_child(request.user, child):
        return error_response('Child not found.', 'NOT_FOUND', status_code=404)

    is_parent = request.user.role == UserRole.PARENT
    lang = getattr(request.user, 'preferred_language', 'en') or 'en'

    records = HealthRecord.objects.filter(
        child=child, is_active=True
    ).order_by('measurement_date')

    parent_summary = _build_parent_summary(child, records, lang)
    # Published WHO reference lines (not the child's scores), so parents can see the zones too
    sd_bands = _build_who_sd_bands(child.sex)

    if is_parent:
        return success_response(data={
            'child_id': str(child_id),
            'child_name': child.full_name,
            'sex': child.sex,
            'date_of_birth': str(child.date_of_birth),
            'parent_summary': parent_summary,
            'who_sd_bands': sd_bands,
        })

    measurements = []
    for r in records:
        measurements.append({
            'date': str(r.measurement_date),
            # Age at this measurement, not today
            'age_months': round((r.measurement_date - child.date_of_birth).days / 30.4375, 1),
            'weight_kg': float(r.weight_kg) if r.weight_kg else None,
            'height_cm': float(r.height_cm) if r.height_cm else None,
            'muac_cm': float(r.muac_cm) if r.muac_cm is not None else None,
            'waz': float(r.weight_for_age_z) if r.weight_for_age_z is not None else None,
            'haz': float(r.height_for_age_z) if r.height_for_age_z is not None else None,
            'whz': float(r.weight_for_height_z) if r.weight_for_height_z is not None else None,
        })

    who_percentiles = _build_who_percentile_bands(child.sex)

    return success_response(data={
        'child_id': str(child_id),
        'child_name': child.full_name,
        'measurements': measurements,
        'who_percentiles': who_percentiles,
        'who_sd_bands': sd_bands,
        'sex': child.sex,
        'date_of_birth': str(child.date_of_birth),
        'parent_summary': parent_summary,
    })


# ── Milestones table (age_months threshold → label) ──────────────────────────

_MILESTONES = [
    (3,  'Holding head up'),
    (6,  'Rolling over'),
    (9,  'Sitting without support'),
    (12, 'Standing with help'),
    (18, 'Walking first steps'),
    (24, 'Running and climbing'),
    (36, 'Saying simple sentences'),
    (48, 'Playing with other children'),
    (60, 'Drawing shapes'),
    (72, 'School readiness'),
]

_MESSAGES = {
    'on_track': {
        'en': 'Your child is growing well! Keep up the great care.',
        'rw': 'Umwana wawe akura neza! Komeza umwita neza.',
        'fr': 'Votre enfant grandit bien ! Continuez les bons soins.',
    },
    'watch': {
        'en': "Your child's growth needs attention. Please follow up with your health worker.",
        'rw': "Imikurire y'umwana wawe isaba gukomezwa. Baza umujyanama w'ubuzima.",
        'fr': "La croissance de votre enfant nécessite un suivi. Consultez votre agent de santé.",
    },
    'concern': {
        'en': 'Your child needs medical attention. Please visit a health centre soon.',
        'rw': 'Umwana wawe akeneye kujyanwa ku kigo nderabuzima vuba.',
        'fr': "Votre enfant a besoin de soins médicaux. Visitez un centre de santé bientôt.",
    },
}


def _build_parent_summary(child, records_qs, lang: str) -> dict:
    """Derive a traffic-light growth summary without exposing z-scores."""
    age = child.age_months

    # Latest milestone the child should have reached
    latest_milestone = None
    next_milestone = None
    for threshold, label in _MILESTONES:
        if age >= threshold:
            latest_milestone = label
        elif next_milestone is None:
            next_milestone = label

    # Status from latest record z-scores (if any)
    latest = records_qs.last()
    status = 'on_track'
    if latest:
        z_scores = [
            float(latest.height_for_age_z) if latest.height_for_age_z is not None else None,
            float(latest.weight_for_age_z) if latest.weight_for_age_z is not None else None,
            float(latest.weight_for_height_z) if latest.weight_for_height_z is not None else None,
        ]
        valid = [z for z in z_scores if z is not None]
        if valid:
            min_z = min(valid)
            if min_z < -2:
                status = 'concern'
            elif min_z < -1:
                status = 'watch'

    message_key = f'growth.status.{status}'
    message = _MESSAGES[status].get(lang, _MESSAGES[status]['en'])

    return {
        'status': status,
        'latest_milestone': latest_milestone,
        'next_milestone': next_milestone,
        'message_key': message_key,
        'message': message,
    }


def _build_who_sd_bands(sex: str) -> dict:
    """
    WHO z-score lines (-3, -2, median, +2, +3 SD) for weight-for-age and
    length/height-for-age, every month from birth to 60 months. Between -2 and
    +2 is normal; below -2 moderate, below -3 severe (WHO 2006 standards).
    """
    from apps.health_records.who_zscore import _lms, _value_at

    lines = {'sd_neg3': -3, 'sd_neg2': -2, 'median': 0, 'sd2': 2, 'sd3': 3}
    out = {}
    for name, indicator in (('weight_for_age', 'wfa'), ('height_for_age', 'lhfa')):
        out[name] = []
        for age in range(0, 61):
            lms = _lms(indicator, sex, age * 30.4375)
            if not lms:
                continue
            row = {'age_months': age}
            row.update({k: round(_value_at(z, *lms), 2) for k, z in lines.items()})
            out[name].append(row)
    return out


def _build_who_percentile_bands(sex: str) -> dict:
    """WHO weight-for-age and length/height-for-age percentile bands, birth to 60 months."""
    from apps.health_records.who_zscore import _lms, _value_at

    ages = list(range(0, 61, 3))  # WHO standards end at 5 years
    percentile_z = {'p3': -1.88, 'p15': -1.04, 'p50': 0.0, 'p85': 1.04, 'p97': 1.88}
    bands = {'weight_for_age': ('wfa', {}), 'height_for_age': ('lhfa', {})}

    for name, (indicator, out) in bands.items():
        for label, z in percentile_z.items():
            out[label] = []
            for age in ages:
                lms = _lms(indicator, sex, age * 30.4375)
                out[label].append({'age_months': age, 'value': round(_value_at(z, *lms), 1) if lms else None})

    return {name: out for name, (_, out) in bands.items()}
