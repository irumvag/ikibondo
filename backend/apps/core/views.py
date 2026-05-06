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

_LANDING_CACHE_KEY = 'landing_stats_v2'
_LANDING_CACHE_TTL = 60  # seconds
_TREND_CACHE_TTL = 300  # seconds


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
        from django.db.models import Count, Q

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

        # Per-camp breakdown for the stats chart
        camp_stats = []
        for camp in Camp.objects.filter(is_active=True).only('id', 'name'):
            total_c = camp.children.filter(is_active=True).count()
            high_risk = HealthRecord.objects.filter(
                child__camp=camp, is_active=True, risk_level='HIGH'
            ).values('child').distinct().count()
            camp_stats.append({
                'id': str(camp.id),
                'name': camp.name,
                'total_children': total_c,
                'high_risk': high_risk,
            })

        return {
            'total_children': total_children,
            'total_camps': total_camps,
            'total_chws_active': total_chws_active,
            'high_risk_30d': high_risk_30d,
            'vaccination_coverage_pct': vaccination_coverage_pct,
            'risk_distribution': risk_distribution,
            'camp_stats': camp_stats,
        }

    data = cache.get_or_set(_LANDING_CACHE_KEY, _compute, _LANDING_CACHE_TTL)
    return Response(data)


@api_view(['GET'])
@permission_classes([AllowAny])
def stats_trend_view(request):
    """
    GET /api/v1/stats/trend/?period=7d|30d|90d
    Returns daily risk-level counts for the line chart on the stats page.
    """
    from apps.health_records.models import HealthRecord
    from django.db.models import Count

    period = request.query_params.get('period', '30d')
    days_map = {'7d': 7, '30d': 30, '90d': 90}
    days = days_map.get(period, 30)

    cache_key = f'stats_trend_v1_{days}'

    def _compute():
        start_date = timezone.now().date() - timezone.timedelta(days=days)
        rows = (
            HealthRecord.objects.filter(
                is_active=True,
                measurement_date__gte=start_date,
                risk_level__isnull=False,
            )
            .values('measurement_date', 'risk_level')
            .annotate(n=Count('id'))
            .order_by('measurement_date')
        )

        # Pivot into {date_str: {HIGH: n, MEDIUM: n, LOW: n}}
        by_date = {}
        for row in rows:
            d = str(row['measurement_date'])
            if d not in by_date:
                by_date[d] = {'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
            by_date[d][row['risk_level']] = row['n']

        result = [
            {
                'date': d,
                'high_risk': counts['HIGH'],
                'medium_risk': counts['MEDIUM'],
                'low_risk': counts['LOW'],
            }
            for d, counts in sorted(by_date.items())
        ]
        return result

    data = cache.get_or_set(cache_key, _compute, _TREND_CACHE_TTL)
    return Response(data)


@api_view(['GET'])
@permission_classes([AllowAny])
def audit_log_view(request):
    """
    GET /api/v1/audit/log/
    Returns paginated auditlog entries. Admin only.
    Supports ?page=&page_size=&user=&action=
    """
    from apps.accounts.permissions import IsAdminUser
    perm_check = IsAdminUser()
    if not (request.user and request.user.is_authenticated and perm_check.has_permission(request, None)):
        from rest_framework.response import Response
        from rest_framework import status as st
        return Response({'detail': 'Admin only.'}, status=st.HTTP_403_FORBIDDEN)

    try:
        from auditlog.models import LogEntry
    except ImportError:
        from apps.core.responses import error_response
        return error_response('django-auditlog not installed.', 'NOT_AVAILABLE')

    page_size = min(int(request.query_params.get('page_size', 25)), 100)
    page = max(int(request.query_params.get('page', 1)), 1)
    user_filter = request.query_params.get('user')
    action_filter = request.query_params.get('action')

    qs = LogEntry.objects.all().order_by('-timestamp')
    if user_filter:
        qs = qs.filter(actor_id=user_filter)
    if action_filter is not None and action_filter != '':
        qs = qs.filter(action=int(action_filter))

    total = qs.count()
    offset = (page - 1) * page_size
    entries = qs[offset:offset + page_size]

    from django.contrib.contenttypes.models import ContentType
    from apps.accounts.models import CustomUser

    results = []
    for e in entries:
        try:
            ct = ContentType.objects.get_for_id(e.content_type_id)
            model_label = f'{ct.app_label}.{ct.model}'
        except Exception:
            model_label = str(e.content_type_id)

        actor_name = ''
        if e.actor_id:
            try:
                u = CustomUser.objects.get(pk=e.actor_id)
                actor_name = u.full_name
            except Exception:
                actor_name = str(e.actor_id)

        results.append({
            'id': e.pk,
            'user': str(e.actor_id) if e.actor_id else None,
            'user_name': actor_name,
            'action': str(e.action),
            'model': model_label,
            'object_id': str(e.object_id),
            'object_repr': e.object_repr,
            'timestamp': e.timestamp.isoformat(),
            'changes': e.changes,
        })

    from rest_framework.response import Response
    return Response({'data': {'count': total, 'results': results}})


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
