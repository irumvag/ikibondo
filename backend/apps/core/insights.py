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


# ── Benchmarks used by partners and the Ministry ─────────────────────────────
# Wasting and stunting prevalence: WHO/UNICEF 2018 thresholds (de Onis et al.,
# Public Health Nutrition 2019). UNHCR aims to keep GAM below 10% in refugee camps.
# Measles coverage in camps: Sphere, 95%. Penta1 -> Penta3 dropout: WHO, above 10%
# signals a problem reaching children for later doses.
WASTING_BANDS = [(2.5, 'Very low', 'good'), (5, 'Low', 'good'), (10, 'Medium', 'watch'),
                 (15, 'High', 'alert'), (None, 'Very high', 'alert')]
STUNTING_BANDS = [(2.5, 'Very low', 'good'), (10, 'Low', 'good'), (20, 'Medium', 'watch'),
                  (30, 'High', 'alert'), (None, 'Very high', 'alert')]


# Built-in indicator settings. `kind` decides how a rate is judged: WHO/UNICEF bands,
# or a target (`higher_is_better` says which side is good). Admins may change label,
# target and benchmark text (core.models.IndicatorSetting); the kind never changes.
INDICATOR_DEFAULTS = {
    'gam_rate': {'label': 'Wasting (GAM)', 'kind': 'wasting', 'target': None, 'higher_is_better': False,
                 'benchmark': 'WHO/UNICEF wasting thresholds; UNHCR target below 10%'},
    'sam_rate': {'label': 'Severe wasting (SAM)', 'kind': 'target', 'target': 2, 'higher_is_better': False,
                 'benchmark': 'MUAC below 11.5 cm, WHZ below -3 or oedema'},
    'stunting_rate': {'label': 'Stunting', 'kind': 'stunting', 'target': None, 'higher_is_better': False,
                      'benchmark': 'Height-for-age below -2; WHO/UNICEF thresholds'},
    'underweight_rate': {'label': 'Underweight', 'kind': 'info', 'target': None, 'higher_is_better': False,
                         'benchmark': 'Weight-for-age below -2'},
    'screening_coverage': {'label': 'Screening coverage', 'kind': 'target', 'target': 90, 'higher_is_better': True,
                           'benchmark': 'Children 6-59 months measured in the last 90 days'},
    'measles_coverage': {'label': 'Measles (MR1) coverage', 'kind': 'target', 'target': 95, 'higher_is_better': True,
                         'benchmark': 'MR1 among children 10 months and older; Sphere 95% in camps'},
    'penta3_coverage': {'label': 'Penta3 coverage', 'kind': 'target', 'target': 90, 'higher_is_better': True,
                        'benchmark': 'Third pentavalent dose among children 18 weeks and older'},
    'penta_dropout': {'label': 'Penta1 to Penta3 dropout', 'kind': 'target', 'target': 10, 'higher_is_better': False,
                      'benchmark': 'Children who started but did not finish the series; above 10% means children are lost'},
    'referral_completion': {'label': 'Referrals completed', 'kind': 'target', 'target': 80, 'higher_is_better': True,
                            'benchmark': 'Referrals made in the last 12 months that were completed'},
}


def indicator_config():
    """Built-in settings with the admin's changes applied."""
    from .models import IndicatorSetting
    cfg = {k: dict(v) for k, v in INDICATOR_DEFAULTS.items()}
    for row in IndicatorSetting.objects.filter(key__in=cfg):
        c = cfg[row.key]
        if row.label.strip():
            c['label'] = row.label.strip()
        if row.benchmark.strip():
            c['benchmark'] = row.benchmark.strip()
        if row.target is not None and c['kind'] == 'target':
            c['target'] = row.target
        c['edited'] = True
    return cfg


def _judge(rate, c):
    """value + band + level for one indicator, per its settings."""
    if c['kind'] == 'wasting':
        return _indicator(rate, bands=WASTING_BANDS, benchmark=c['benchmark'], label=c['label'])
    if c['kind'] == 'stunting':
        return _indicator(rate, bands=STUNTING_BANDS, benchmark=c['benchmark'], label=c['label'])
    if c['kind'] == 'target':
        return _indicator(rate, target=c['target'], higher_is_better=c['higher_is_better'],
                          benchmark=c['benchmark'], label=c['label'])
    return _indicator(rate, benchmark=c['benchmark'], label=c['label'])


def _band(rate, bands):
    if rate is None:
        return None, None
    for upper, label, level in bands:
        if upper is None or rate < upper:
            return label, level
    return None, None


def _indicator(rate, *, bands=None, target=None, higher_is_better=True, benchmark='', label=''):
    """A rate with the level partners judge it by: good / watch / alert."""
    if bands:
        band, level = _band(rate, bands)
    elif rate is None or target is None:
        band, level = None, None
    else:
        ok = rate >= target if higher_is_better else rate <= target
        near = rate >= target - 10 if higher_is_better else rate <= target + 5
        level = 'good' if ok else ('watch' if near else 'alert')
        band = 'Meets target' if ok else 'Below target' if higher_is_better else 'Above limit'
    return {'value': rate, 'band': band, 'level': level, 'benchmark': benchmark, 'label': label,
            'target': target}


def _months_ago(today, weeks):
    return today - timedelta(weeks=weeks)


def _indicators(camp_ids, today, config=None):
    """Institutional indicators for children aged 6-59 months (see benchmarks above)."""
    from apps.children.models import Child
    from apps.health_records.models import HealthRecord
    from apps.referrals.models import Referral
    from apps.vaccinations.models import DoseStatus, VaccinationRecord

    under5 = Child.objects.filter(
        camp_id__in=camp_ids, is_active=True,
        date_of_birth__lte=today - timedelta(days=183), date_of_birth__gt=today - timedelta(days=1826),
    )
    recent = HealthRecord.objects.filter(
        child=OuterRef('pk'), is_active=True, measurement_date__gte=today - timedelta(days=90),
    ).order_by('-measurement_date', '-created_at')
    measured = under5.annotate(
        st=Subquery(recent.values('nutrition_status')[:1]),
        haz=Subquery(recent.values('height_for_age_z')[:1]),
        waz=Subquery(recent.values('weight_for_age_z')[:1]),
    ).exclude(st__isnull=True)
    m = measured.aggregate(
        n=Count('id'),
        sam=Count('id', filter=Q(st='SAM')),
        gam=Count('id', filter=Q(st__in=['SAM', 'MAM'])),
        stunted=Count('id', filter=Q(haz__lt=-2)),
        haz_n=Count('id', filter=Q(haz__isnull=False)),
        underweight=Count('id', filter=Q(waz__lt=-2)),
        waz_n=Count('id', filter=Q(waz__isnull=False)),
    )

    def coverage(code_prefix, min_weeks):
        eligible = Child.objects.filter(camp_id__in=camp_ids, is_active=True,
                                        date_of_birth__lte=_months_ago(today, min_weeks))
        given = VaccinationRecord.objects.filter(
            child__in=eligible, vaccine__short_code=code_prefix, status=DoseStatus.DONE,
        ).values('child').distinct().count()
        return given, eligible.count()

    mr1, mr1_n = coverage('MR1', 36 + 4)            # MR1 due at 9 months; 4 weeks' grace
    p3, p3_n = coverage('DPT_HepB_Hib3', 14 + 4)    # Penta3 due at 14 weeks
    p1_children = VaccinationRecord.objects.filter(
        child__camp_id__in=camp_ids, child__is_active=True,
        child__date_of_birth__lte=_months_ago(today, 14 + 4),
        vaccine__short_code='DPT_HepB_Hib1', status=DoseStatus.DONE,
    ).values('child')
    p1 = p1_children.distinct().count()
    p1_then_p3 = VaccinationRecord.objects.filter(
        child__in=p1_children, vaccine__short_code='DPT_HepB_Hib3', status=DoseStatus.DONE,
    ).values('child').distinct().count()

    year = Referral.objects.filter(child__camp_id__in=camp_ids, referred_at__date__gte=today - timedelta(days=365))
    ref_total = year.exclude(status='CANCELLED').count()
    ref_done = year.filter(status='COMPLETED').count()

    rates = {
        'gam_rate': _rate(m['gam'], m['n']),
        'sam_rate': _rate(m['sam'], m['n']),
        'stunting_rate': _rate(m['stunted'], m['haz_n']),
        'underweight_rate': _rate(m['underweight'], m['waz_n']),
        'screening_coverage': _rate(m['n'], under5.count()),
        'measles_coverage': _rate(mr1, mr1_n),
        'penta3_coverage': _rate(p3, p3_n),
        'penta_dropout': _rate(p1 - p1_then_p3, p1),
        'referral_completion': _rate(ref_done, ref_total),
    }
    cfg = config or indicator_config()
    return {
        **{k: _judge(v, cfg[k]) for k, v in rates.items()},
        'children_6_59m': _cell(under5.count()),
        'measured_6_59m': _cell(m['n']),
    }


def _camp_stats(camp_ids, today, config=None):
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
        'indicators': _indicators(camp_ids, today, config),
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
    config = indicator_config()
    return {
        'generated_on': today.isoformat(),
        'min_cell': MIN_CELL,
        'camps': [{'id': str(c.id), 'name': c.name, 'district': c.district, **_camp_stats([c.id], today, config)}
                  for c in camps],
        'total': _camp_stats(ids, today, config) if ids else None,
        'trend': _trend(ids, today) if ids else [],
    }


CSV_FIELDS = ['children', 'sam', 'mam', 'normal', 'not_measured', 'high_risk',
              'acute_malnutrition_rate', 'vaccination_coverage', 'visits_30d', 'referrals_open']
INDICATOR_FIELDS = ['gam_rate', 'sam_rate', 'stunting_rate', 'underweight_rate', 'screening_coverage',
                    'measles_coverage', 'penta3_coverage', 'penta_dropout', 'referral_completion']


def overview_csv(overview):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([f'Ikibondo aggregated statistics, {overview["generated_on"]}. '
                f'Counts from 1 to {MIN_CELL - 1} are hidden ("<{MIN_CELL}") to protect children.'])
    w.writerow(['camp', 'district', *CSV_FIELDS, *[f'{f}_pct' for f in INDICATOR_FIELDS]])

    def fmt(v):
        if isinstance(v, dict):
            return f'<{MIN_CELL}' if v['suppressed'] else v['value']
        return '' if v is None else v

    for c in overview['camps']:
        w.writerow([c['name'], c['district'], *[fmt(c[f]) for f in CSV_FIELDS],
                    *[fmt(c['indicators'][f]['value']) for f in INDICATOR_FIELDS]])
    if overview['total']:
        t = overview['total']
        w.writerow(['All camps shown', '', *[fmt(t[f]) for f in CSV_FIELDS],
                    *[fmt(t['indicators'][f]['value']) for f in INDICATOR_FIELDS]])
    return buf.getvalue()
