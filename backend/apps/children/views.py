import base64
import io
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.core.responses import success_response, created_response, error_response
from apps.accounts.models import UserRole
from .models import Child, Guardian
from .serializers import ChildSerializer, ChildCreateSerializer, GuardianSerializer
from .filters import ChildFilter


class ChildViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ChildFilter
    search_fields = ['full_name', 'registration_number', 'guardian__full_name']
    ordering_fields = ['full_name', 'date_of_birth', 'created_at']

    def get_queryset(self):
        qs = Child.objects.filter(is_active=True).select_related('camp', 'guardian', 'registered_by')
        # Parents only see their own children (those linked via guardian_profile)
        if self.request.user.role == UserRole.PARENT:
            qs = qs.filter(guardian__user=self.request.user)
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return ChildCreateSerializer
        return ChildSerializer

    def create(self, request, *args, **kwargs):
        # Parents cannot register children
        if request.user.role == UserRole.PARENT:
            return error_response('Parents cannot register children.', 'FORBIDDEN', status_code=403)

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
        # Parents cannot edit children
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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def scan_qr_view(request, qr_code):
    """GET /api/v1/children/scan/<qr_code>/ — look up a child by QR code string."""
    try:
        child = Child.objects.get(qr_code=qr_code, is_active=True)
    except Child.DoesNotExist:
        return error_response('Child not found.', 'NOT_FOUND', status_code=404)
    return success_response(data=ChildSerializer(child).data)
