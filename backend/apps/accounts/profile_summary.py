"""
GET /api/v1/auth/me/summary/ — what the signed-in person does in Ikibondo, for
their profile page: their own work for the role they are acting as now.

Everything is limited to the person's own records (their children, their
caseload, their camp), so nothing here goes beyond what their role already sees.
"""
from datetime import date

from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.core.responses import success_response
from .models import UserRole


def _month_start() -> date:
    today = timezone.now().date()
    return today.replace(day=1)


def _parent(user) -> dict:
    from apps.children.models import Child
    from apps.health_records.models import HealthRecord
    from apps.vaccinations.models import VaccinationRecord

    kids = Child.objects.filter(guardian__user=user, is_active=True).select_related('guardian__assigned_chw', 'camp')
    today = timezone.now().date()
    children, team = [], {}
    for c in kids:
        latest = HealthRecord.objects.filter(child=c, is_active=True).order_by('-measurement_date').first()
        nxt = (VaccinationRecord.objects.filter(child=c, status='SCHEDULED', is_active=True)
               .select_related('vaccine').order_by('scheduled_date').first())
        overdue = VaccinationRecord.objects.filter(
            Q(status='MISSED') | Q(status='SCHEDULED', scheduled_date__lt=today), child=c, is_active=True).count()
        children.append({
            'id': str(c.id), 'full_name': c.full_name, 'age_display': c.age_display, 'sex': c.sex,
            'camp_name': c.camp.name if c.camp_id else None,
            'nutrition_status': latest.nutrition_status if latest else None,
            'risk_level': latest.risk_level if latest else None,
            'last_checkup': str(latest.measurement_date) if latest else None,
            'next_vaccine': ({'name': nxt.vaccine.name, 'date': str(nxt.scheduled_date)} if nxt else None),
            'overdue_doses': overdue,
        })
        chw = c.guardian.assigned_chw if c.guardian_id else None
        if chw:
            team[str(chw.id)] = {'full_name': chw.full_name, 'phone_number': chw.phone_number, 'role': 'CHW'}
    return {'children': children, 'care_team': list(team.values())}


def _chw(user) -> dict:
    from apps.children.models import Child, Guardian, VisitRequest
    from apps.health_records.models import HealthRecord

    zones = [a.zone.name for a in user.chw_zone_assignments.filter(status='active').select_related('zone')]
    families = Guardian.objects.filter(assigned_chw=user)
    return {
        'zones': zones,
        'families': families.count(),
        'children': Child.objects.filter(guardian__in=families, is_active=True).count(),
        'checkups_this_month': HealthRecord.objects.filter(recorded_by=user, measurement_date__gte=_month_start()).count(),
        # New requests have no CHW until accepted: count those from the CHW's families too
        'open_visit_requests': VisitRequest.objects.filter(
            Q(assigned_chw=user) | Q(assigned_chw__isnull=True, child__guardian__assigned_chw=user),
            status__in=['PENDING', 'ACCEPTED']).count(),
        'last_checkup': (HealthRecord.objects.filter(recorded_by=user).order_by('-measurement_date')
                         .values_list('measurement_date', flat=True).first()),
    }


def _nurse(user) -> dict:
    from apps.children.models import Child
    from apps.health_records.models import HealthRecord
    from apps.referrals.models import Referral
    from apps.vaccinations.models import ClinicSession

    camp = user.camp_id
    return {
        'children_in_camp': Child.objects.filter(camp_id=camp, is_active=True).count() if camp else 0,
        'registered_by_me': Child.objects.filter(registered_by=user, is_active=True).count(),
        'checkups_this_month': HealthRecord.objects.filter(recorded_by=user, measurement_date__gte=_month_start()).count(),
        'open_referrals': Referral.objects.filter(
            child__camp_id=camp, status__in=['PENDING', 'ACCEPTED']).count() if camp else 0,
        'open_sessions': ClinicSession.objects.filter(camp_id=camp, status='OPEN').count() if camp else 0,
    }


def _supervisor(user) -> dict:
    from apps.accounts.models import CustomUser
    from apps.camps.models import CampZone
    from apps.health_records.models import HealthRecord

    camp = user.camp_id
    return {
        'zones': CampZone.objects.filter(camp_id=camp).count() if camp else 0,
        'chws': CustomUser.objects.with_role(UserRole.CHW).filter(camp_id=camp, is_active=True).count() if camp else 0,
        'checkups_this_month': HealthRecord.objects.filter(
            child__camp_id=camp, measurement_date__gte=_month_start()).count() if camp else 0,
    }


def _oversight(user) -> dict:
    org = user.organization
    if not org:
        return {'organization': None}
    from apps.core.insights import MIN_CELL, build_overview, visible_camps

    camps = list(org.camps.values_list('name', flat=True))
    total = build_overview(user)['total'] or {}
    ind = total.get('indicators') or {}
    return {
        'organization': org.name,
        'kind': org.kind,
        # A government body with no camps listed oversees every camp (see core/insights.py)
        'camps': camps,
        'all_camps': not camps and org.kind == 'GOVERNMENT',
        'camps_covered': visible_camps(user).count(),
        # Same suppressed figures as the statistics page (counts under MIN_CELL hidden)
        'highlights': {
            'children': total.get('children'),
            'gam_rate': ind.get('gam_rate'),
            'measles_coverage': ind.get('measles_coverage'),
            'penta3_coverage': ind.get('penta3_coverage'),
        },
        'min_cell': MIN_CELL,
        'colleagues': org.members.filter(is_active=True).exclude(id=user.id).count(),
    }


def _admin(user) -> dict:
    from apps.accounts.models import CustomUser
    from apps.camps.models import Camp
    return {
        'camps': Camp.objects.filter(is_active=True).count(),
        'active_users': CustomUser.objects.filter(is_active=True).count(),
    }


_BY_ROLE = {
    UserRole.PARENT: _parent,
    UserRole.CHW: _chw,
    UserRole.NURSE: _nurse,
    UserRole.SUPERVISOR: _supervisor,
    UserRole.ADMIN: _admin,
    UserRole.GOVERNMENT: _oversight,
    UserRole.PARTNER: _oversight,
}


@extend_schema(exclude=True)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_summary_view(request):
    user = request.user
    build = _BY_ROLE.get(user.role)
    return success_response(data={
        'role': user.role,
        'member_since': user.date_joined.date().isoformat() if user.date_joined else None,
        'last_sign_in': user.last_login.isoformat() if user.last_login else None,
        'work': build(user) if build else {},
    })
