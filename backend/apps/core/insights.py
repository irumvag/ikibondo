"""
Aggregated, de-identified statistics for government and partner (NGO/UN) users.

These users never see a child's record. They see counts per camp:
nutrition status, risk, vaccination coverage, visits, referrals and a monthly trend.

Privacy:
  - Small-cell suppression: any count from 1 to 4 is replaced by null with
    "suppressed": true, and rates are only given when the denominator is at least 5,
    so no individual child can be singled out in a small camp.
  - Which camps a person sees comes from their organisation (see accounts.Organization).
"""
import csv
import io
from datetime import date, timedelta

from django.db.models import Count, OuterRef, Q, Subquery

from apps.accounts.models import STAKEHOLDER_ROLES, UserRole

MIN_CELL = 5  # counts below this (but above zero) are hidden


def visible_camps(user):
    """Camps whose statistics `user` may see. Fails closed."""
    from apps.camps.models import Camp
    camps = Camp.objects.filter(is_active=True)
    role = getattr(user, 'role', None)
    if role == UserRole.ADMIN:
        return camps
    if role not in STAKEHOLDER_ROLES:
        return camps.none()
    org = getattr(user, 'organization', None)
    if org is None or not org.is_active:
        return camps.none()
    listed = org.camps.all()
    if listed.exists():
        return camps.filter(id__in=listed.values('id'))
    # A government body with no camps listed covers the whole country; a partner covers nothing
    return camps if role == UserRole.GOVERNMENT and org.kind == 'GOVERNMENT' else camps.none()


def _cell(n):
    """A count, hidden when it is small enough to identify a child."""
    n = int(n or 0)
    if 0 < n < MIN_CELL:
        return {'value': None, 'suppressed': True}
    return {'value': n, 'suppressed': False}


def _rate(part, whole):
    whole = int(whole or 0)
    if whole < MIN_CELL:
        return None
    return round(100 * int(part or 0) / whole, 1)


def _camp_stats(camp_ids, today):
    from apps.children.models import Child
    from apps.health_records.models import HealthRecord
    from apps.referrals.models import Referral
    from apps.vaccinations.models import DoseStatus, VaccinationRecord

    latest = HealthRecord.objects.filter(child=OuterRef('pk')).order_by('-measurement_date', '-created_at')
    children = (
        Child.objects.filter(camp_id__in=camp_ids, is_active=True)
        .annotate(last_status=Subquery(latest.values('nutrition_status')[:1]),
                  last_risk=Subquery(latest.values('risk_level')[:1]))
    )
    counts = children.aggregate(
        total=Count('id'),
        sam=Count('id', filter=Q(last_status='SAM')),
        mam=Count('id', filter=Q(last_status='MAM')),
        normal=Count('id', filter=Q(last_status__in=['NORMAL', 'OVERWEIGHT'])),
        not_measured=Count('id', filter=Q(last_status__isnull=True)),
        high_risk=Count('id', filter=Q(last_risk='HIGH')),
    )
    due = VaccinationRecord.objects.filter(
        child__camp_id__in=camp_ids, child__is_active=True, scheduled_date__lte=today,
    )
    doses_due = due.count()
    doses_done = due.filter(status=DoseStatus.DONE).count()
    visits_30d = HealthRecord.objects.filter(
        child__camp_id__in=camp_ids, measurement_date__gte=today - timedelta(days=30),
    ).count()
    referrals_open = Referral.objects.filter(
        child__camp_id__in=camp_ids, status__in=['PENDING', 'ACCEPTED'],
    ).count()
    measured = counts['total'] - counts['not_measured']
    return {
        'children': _cell(counts['total']),
        'sam': _cell(counts['sam']),
        'mam': _cell(counts['mam']),
        'normal': _cell(counts['normal']),
        'not_measured': _cell(counts['not_measured']),
        'high_risk': _cell(counts['high_risk']),
        'acute_malnutrition_rate': _rate(counts['sam'] + counts['mam'], measured),
        'vaccination_coverage': _rate(doses_done, doses_due),
        'visits_30d': _cell(visits_30d),
        'referrals_open': _cell(referrals_open),
    }


def _trend(camp_ids, today, months=12):
    """Children seen per month, and how many of them were SAM / MAM at that visit."""
    from apps.health_records.models import HealthRecord
    first = date(today.year, today.month, 1)
    starts = []
    y, m = first.year, first.month
    for _ in range(months):
        starts.append(date(y, m, 1))
        y, m = (y, m - 1) if m > 1 else (y - 1, 12)
    starts.reverse()
    out = []
    for i, start in enumerate(starts):
        end = starts[i + 1] if i + 1 < len(starts) else (date(start.year + (start.month == 12), start.month % 12 + 1, 1))
        rows = HealthRecord.objects.filter(
            child__camp_id__in=camp_ids, measurement_date__gte=start, measurement_date__lt=end,
        )
        agg = rows.aggregate(
            children_seen=Count('child', distinct=True),
            sam=Count('child', distinct=True, filter=Q(nutrition_status='SAM')),
            mam=Count('child', distinct=True, filter=Q(nutrition_status='MAM')),
        )
        out.append({'month': start.strftime('%Y-%m'),
                    **{k: _cell(v) for k, v in agg.items()}})
    return out


def build_overview(user, camp_id=None, today=None):
    today = today or date.today()
    camps = visible_camps(user)
    if camp_id:
        camps = camps.filter(id=camp_id)
    camps = list(camps.order_by('name'))
    ids = [c.id for c in camps]
    return {
        'generated_on': today.isoformat(),
        'min_cell': MIN_CELL,
        'camps': [{'id': str(c.id), 'name': c.name, 'district': c.district, **_camp_stats([c.id], today)}
                  for c in camps],
        'total': _camp_stats(ids, today) if ids else None,
        'trend': _trend(ids, today) if ids else [],
    }


CSV_FIELDS = ['children', 'sam', 'mam', 'normal', 'not_measured', 'high_risk',
              'acute_malnutrition_rate', 'vaccination_coverage', 'visits_30d', 'referrals_open']


def overview_csv(overview):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([f'Ikibondo aggregated statistics, {overview["generated_on"]}. '
                f'Counts from 1 to {MIN_CELL - 1} are hidden ("<{MIN_CELL}") to protect children.'])
    w.writerow(['camp', 'district', *CSV_FIELDS])

    def fmt(v):
        if isinstance(v, dict):
            return f'<{MIN_CELL}' if v['suppressed'] else v['value']
        return '' if v is None else v

    for c in overview['camps']:
        w.writerow([c['name'], c['district'], *[fmt(c[f]) for f in CSV_FIELDS]])
    if overview['total']:
        w.writerow(['All camps shown', '', *[fmt(overview['total'][f]) for f in CSV_FIELDS]])
    return buf.getvalue()
