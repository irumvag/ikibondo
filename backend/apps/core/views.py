from django.core.cache import cache
from django.utils import timezone
from rest_framework import viewsets, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import FAQItem
from .serializers import FAQItemSerializer


class FAQItemViewSet(viewsets.ModelViewSet):
    """
    Public list/retrieve: returns only published items (no auth required).
    Admin create/update/delete: requires ADMIN role.
    """
    serializer_class = FAQItemSerializer
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = FAQItem.objects.filter(is_active=True)
        user = self.request.user
        if not (user and user.is_authenticated and getattr(user, 'role', None) == 'ADMIN'):
            qs = qs.filter(is_published=True)
        return qs

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [permissions.AllowAny()]
        from apps.accounts.permissions import IsAdminUser
        return [IsAdminUser()]

_LANDING_CACHE_KEY = 'landing_stats_v1'
_LANDING_CACHE_TTL = 60  # seconds


@api_view(['GET'])
@permission_classes([AllowAny])
def landing_stats_view(request):
    """GET /api/v1/stats/landing/ — public aggregate counts for the homepage."""
    def _compute():
        from apps.children.models import Child
        from apps.camps.models import Camp
        from apps.accounts.models import CustomUser, UserRole
        from apps.health_records.models import HealthRecord
        from apps.vaccinations.models import VaccinationRecord, DoseStatus
        from django.db.models import Count

        thirty_days_ago = timezone.now().date() - timezone.timedelta(days=30)

        total_children = Child.objects.filter(is_active=True).count()
        total_camps = Camp.objects.filter(status='active').count()
        total_chws_active = CustomUser.objects.filter(role=UserRole.CHW, is_active=True).count()

        high_risk_30d = HealthRecord.objects.filter(
            risk_level='HIGH',
            measurement_date__gte=thirty_days_ago,
            is_active=True,
        ).count()

        risk_qs = (
            HealthRecord.objects.filter(is_active=True, risk_level__isnull=False)
            .values('risk_level')
            .annotate(n=Count('id'))
        )
        risk_distribution = {'LOW': 0, 'MEDIUM': 0, 'HIGH': 0}
        for row in risk_qs:
            risk_distribution[row['risk_level']] = row['n']

        total_doses = VaccinationRecord.objects.exclude(
            status=DoseStatus.SKIPPED
        ).count()
        done_doses = VaccinationRecord.objects.filter(status=DoseStatus.DONE).count()
        vaccination_coverage_pct = (
            round(done_doses / total_doses * 100, 1) if total_doses else 0.0
        )

        return {
            'total_children': total_children,
            'total_camps': total_camps,
            'total_chws_active': total_chws_active,
            'high_risk_30d': high_risk_30d,
            'vaccination_coverage_pct': vaccination_coverage_pct,
            'risk_distribution': risk_distribution,
        }

    data = cache.get_or_set(_LANDING_CACHE_KEY, _compute, _LANDING_CACHE_TTL)
    return Response(data)


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """GET /api/v1/health/ — system status."""
    from django.db import connection
    db_ok = True
    try:
        connection.ensure_connection()
    except Exception:
        db_ok = False

    from apps.ml_engine.prediction_service import PredictionService
    ml_status = 'loaded' if PredictionService.is_loaded else 'not_loaded'

    return Response({
        'status': 'ok',
        'database': 'connected' if db_ok else 'error',
        'ml_model': ml_status,
        'version': '2.0',
    })
