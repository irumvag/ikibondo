from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone

from apps.core.responses import success_response, created_response, error_response
from apps.accounts.models import UserRole
from .models import Consultation, ConsultationMessage, ConsultationStatus
from .serializers import ConsultationSerializer, ConsultationMessageSerializer


class ConsultationViewSet(viewsets.ModelViewSet):
    """
    Scoping:
      CHW  — sees consultations they opened.
      NURSE/SUPERVISOR/ADMIN — sees all consultations for their camp.
      PARENT — forbidden.
    """
    serializer_class = ConsultationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['child__full_name', 'child__registration_number']
    ordering_fields = ['created_at', 'status']
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        qs = Consultation.objects.select_related(
            'child', 'opened_by', 'assigned_nurse'
        ).prefetch_related('messages')

        if user.role == UserRole.CHW:
            qs = qs.filter(opened_by=user)
        elif user.role in (UserRole.NURSE, UserRole.SUPERVISOR):
            if user.camp_id:
                qs = qs.filter(child__camp_id=user.camp_id)
        elif user.role == UserRole.PARENT:
            return qs.none()
        return qs.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        if request.user.role not in (UserRole.CHW, UserRole.NURSE, UserRole.SUPERVISOR, UserRole.ADMIN):
            return error_response('Not permitted to open consultations.', 'FORBIDDEN', status_code=403)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        consultation = serializer.save(opened_by=request.user)
        return created_response(
            data=ConsultationSerializer(consultation).data,
            message='Consultation opened.',
        )

    @action(detail=True, methods=['post'], url_path='reply')
    def reply(self, request, pk=None):
        """POST /consultations/<id>/reply/ — add a message."""
        consultation = self.get_object()
        if consultation.status == ConsultationStatus.RESOLVED:
            return error_response('Consultation is already resolved.', 'INVALID_STATE')

        serializer = ConsultationMessageSerializer(data={
            'consultation': str(consultation.id),
            'body': request.data.get('body', ''),
            'attachments': request.data.get('attachments', []),
        })
        serializer.is_valid(raise_exception=True)
        msg = serializer.save(author=request.user, consultation=consultation)
        return created_response(
            data=ConsultationMessageSerializer(msg).data,
            message='Message sent.',
        )

    @action(detail=True, methods=['post'], url_path='resolve')
    def resolve(self, request, pk=None):
        """POST /consultations/<id>/resolve/ — mark resolved."""
        consultation = self.get_object()
        if consultation.status == ConsultationStatus.RESOLVED:
            return error_response('Already resolved.', 'INVALID_STATE')

        consultation.status = ConsultationStatus.RESOLVED
        consultation.resolved_at = timezone.now()
        rating = request.data.get('helpful_rating')
        if rating is not None:
            consultation.helpful_rating = int(rating)
        consultation.save(update_fields=['status', 'resolved_at', 'helpful_rating', 'updated_at'])
        return success_response(
            data=ConsultationSerializer(consultation).data,
            message='Consultation resolved.',
        )

    @action(detail=True, methods=['post'], url_path='dispute')
    def dispute(self, request, pk=None):
        """POST /consultations/<id>/dispute/ — supervisor flags disputed AI classification."""
        if request.user.role not in (UserRole.SUPERVISOR, UserRole.ADMIN):
            return error_response('Only supervisors can dispute classifications.', 'FORBIDDEN', status_code=403)
        consultation = self.get_object()
        consultation.disputed_classification = True
        consultation.status = ConsultationStatus.ESCALATED
        consultation.save(update_fields=['disputed_classification', 'status', 'updated_at'])
        return success_response(
            data=ConsultationSerializer(consultation).data,
            message='Classification disputed and escalated.',
        )
