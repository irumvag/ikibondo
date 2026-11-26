"""
GET /api/v1/insights/overview/?camp=<id>   aggregated statistics (government, partners, admin)
GET /api/v1/insights/export/?camp=<id>     the same as CSV
"""
from django.http import HttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission

from apps.accounts.models import STAKEHOLDER_ROLES, UserRole
from .insights import build_overview, overview_csv
from apps.accounts.permissions import IsAdminUser
from .responses import error_response, success_response


class IsStakeholderOrAdmin(BasePermission):
    def has_permission(self, request, view):
        role = getattr(request.user, 'role', None)
        return bool(request.user and request.user.is_authenticated
                    and (role == UserRole.ADMIN or role in STAKEHOLDER_ROLES))


@extend_schema(exclude=True)
@api_view(['GET'])
@permission_classes([IsStakeholderOrAdmin])
def insights_overview_view(request):
    return success_response(data=build_overview(request.user, request.query_params.get('camp') or None))


@extend_schema(exclude=True)
@api_view(['GET'])
@permission_classes([IsStakeholderOrAdmin])
def insights_export_view(request):
    overview = build_overview(request.user, request.query_params.get('camp') or None)
    response = HttpResponse(overview_csv(overview), content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="ikibondo-statistics-{overview["generated_on"]}.csv"'
    return response


@extend_schema(exclude=True)
@api_view(['GET'])
@permission_classes([IsAdminUser])
def indicator_settings_view(request):
    """GET /api/v1/insights/indicators/ — every indicator with built-in and current settings."""
    from .insights import INDICATOR_DEFAULTS, indicator_config
    current = indicator_config()
    return success_response(data=[
        {'key': k, 'kind': d['kind'], 'higher_is_better': d['higher_is_better'],
         'default': {'label': d['label'], 'target': d['target'], 'benchmark': d['benchmark']},
         'current': {'label': current[k]['label'], 'target': current[k]['target'],
                     'benchmark': current[k]['benchmark']},
         'edited': current[k].get('edited', False)}
        for k, d in INDICATOR_DEFAULTS.items()
    ])


@extend_schema(exclude=True)
@api_view(['PUT', 'DELETE'])
@permission_classes([IsAdminUser])
def indicator_setting_detail_view(request, key):
    """PUT changes one indicator's label / target / benchmark text; DELETE returns it to built-in."""
    from .insights import INDICATOR_DEFAULTS
    from .models import IndicatorSetting
    if key not in INDICATOR_DEFAULTS:
        return error_response('Unknown indicator.', 'NOT_FOUND', status_code=404)
    if request.method == 'DELETE':
        IndicatorSetting.objects.filter(key=key).delete()
        return success_response(message='Indicator back to the built-in settings.')
    target = request.data.get('target')
    if target not in (None, ''):
        try:
            target = float(target)
        except (TypeError, ValueError):
            return error_response('Target must be a number.', 'VALIDATION_ERROR')
        if not 0 <= target <= 100:
            return error_response('Target is a percentage between 0 and 100.', 'VALIDATION_ERROR')
        if INDICATOR_DEFAULTS[key]['kind'] != 'target':
            return error_response('This indicator is judged by WHO/UNICEF bands, not a target.', 'VALIDATION_ERROR')
    else:
        target = None
    row, _ = IndicatorSetting.objects.get_or_create(key=key)
    row.label = str(request.data.get('label') or '')[:80]
    row.benchmark = str(request.data.get('benchmark') or '')[:300]
    row.target = target
    row.updated_by = request.user
    row.save()
    return success_response(message='Indicator saved.')
