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

logger = logging.getLogger(__name__)


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
        # Scope by camp for nurses and supervisors
        if user.role in (UserRole.NURSE, UserRole.SUPERVISOR) and user.camp_id:
            qs = qs.filter(child__camp_id=user.camp_id)
        elif user.role == UserRole.CHW:
            qs = qs.filter(child__guardian__assigned_chw=user)
        elif user.role == UserRole.PARENT:
            qs = qs.filter(child__guardian__user=user)
        return qs.order_by('-measurement_date')

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
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record = serializer.save(recorded_by=request.user)

        # Run ML prediction synchronously so the response includes risk_level + risk_factors
        self._run_prediction(record)

        # If HIGH risk — trigger async notifications
        if record.risk_level == 'HIGH':
            try:
                from apps.notifications.tasks import notify_high_risk
                notify_high_risk.delay(str(record.id))
            except Exception as e:
                logger.warning('Failed to enqueue notify_high_risk for record %s: %s', record.id, e)

        return created_response(
            data=HealthRecordSerializer(record).data,
            message='Health record saved with risk assessment.',
        )

    def _run_prediction(self, record):
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
        # CHW 24-hour window
        if user.role == UserRole.CHW:
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

    @action(detail=False, methods=['get'], url_path='zone-summary')
    def zone_summary(self, request):
        """GET /api/v1/health-records/zone-summary/?zone=<id>"""
        zone_id = request.query_params.get('zone')
        if not zone_id:
            return error_response('zone query param required.', 'VALIDATION_ERROR')
        dist = {'LOW': 0, 'MEDIUM': 0, 'HIGH': 0, 'UNKNOWN': 0}
        records = HealthRecord.objects.filter(zone_id=zone_id, is_active=True)
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
        return ClinicalNote.objects.filter(is_active=True).select_related('author')

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

    is_parent = request.user.role == UserRole.PARENT
    lang = getattr(request.user, 'preferred_language', 'en') or 'en'

    records = HealthRecord.objects.filter(
        child=child, is_active=True
    ).order_by('measurement_date')

    parent_summary = _build_parent_summary(child, records, lang)

    if is_parent:
        return success_response(data={
            'child_id': str(child_id),
            'child_name': child.full_name,
            'parent_summary': parent_summary,
        })

    measurements = []
    for r in records:
        measurements.append({
            'date': str(r.measurement_date),
            'age_months': child.age_months,
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


def _build_who_percentile_bands(sex: str) -> dict:
    """Return WHO weight-for-age and height-for-age percentile bands for 0–72 months."""
    from apps.health_records.who_zscore import (
        _HAZ_LMS_MALE, _HAZ_LMS_FEMALE, _lms_zscore, _interpolate_lms
    )
    import math

    def z_to_x(age, z_score, table, is_height=True):
        """Invert LMS z-score to raw measurement at a given z."""
        try:
            L, M, S = _interpolate_lms(table, age)
            if L == 0:
                return round(M * math.exp(z_score * S), 1)
            return round(M * ((1 + L * S * z_score) ** (1 / L)), 1)
        except Exception:
            return None

    haz_table = _HAZ_LMS_MALE if sex == 'M' else _HAZ_LMS_FEMALE

    ages = list(range(0, 73, 3))  # 0,3,6,...,72 months
    percentile_z = {'p3': -1.88, 'p15': -1.04, 'p50': 0.0, 'p85': 1.04, 'p97': 1.88}

    height_bands = {p: [] for p in percentile_z}
    weight_bands = {p: [] for p in percentile_z}

    for age in ages:
        for label, z in percentile_z.items():
            h = z_to_x(age, z, haz_table, is_height=True)
            height_bands[label].append({'age_months': age, 'value': h})
            # Approximate weight from height using rough scaling
            w = round(z_to_x(age, z, haz_table, is_height=True) * 0.138, 1) if h else None
            weight_bands[label].append({'age_months': age, 'value': w})

    return {
        'weight_for_age': weight_bands,
        'height_for_age': height_bands,
    }
