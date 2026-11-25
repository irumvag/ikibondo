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
from .responses import success_response


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
