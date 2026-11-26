'use client';

import { useTranslations } from 'next-intl';
import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Users, Phone, UserCheck, Syringe, Activity,
  AlertTriangle, CheckCircle, Clock, Pin, MessageSquare,
  TrendingUp, TrendingDown, Minus, Baby,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VaxSummary {
  total: number;
  done: number;
  missed: number;
  scheduled: number;
  coverage_pct: number;
  is_overdue: boolean;
}

interface HealthTrendItem {
  date: string;
  risk_level: string;
  weight_kg: string | null;
  muac_cm: string | null;
  nutrition_status: string;
}

interface ChildSummary {
  id: string;
  full_name: string;
  registration_number: string;
  age_display: string;
  age_months: number | null;
  sex: 'M' | 'F';
  date_of_birth: string;
  camp_name: string | null;
  zone_name: string | null;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  nutrition_status: string;
  nutrition_status_display: string;
  latest_weight_kg: string | null;
  latest_height_cm: string | null;
  latest_muac_cm: string | null;
  last_visit_date: string | null;
  vaccination: VaxSummary;
  health_trend: HealthTrendItem[];
}

interface FamilyNote {
  id: string;
  child_id: string;
  child_name: string;
  note_type: string;
  note_type_display: string;
  content: string;
  is_pinned: boolean;
  author_name: string | null;
  created_at: string;
}

interface VisitRequestSummary {
  id: string;
  child_id: string;
  child_name: string;
  urgency: 'ROUTINE' | 'SOON' | 'URGENT';
  status: string;
  concern_text: string;
  created_at: string;
}

interface FamilyOverview {
  guardian: {
    id: string;
    full_name: string;
    phone_number: string;
    relationship: string;
    national_id: string;
    has_account: boolean;
    user_email: string | null;
    assigned_chw_name: string | null;
  };
  family_risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  total_children: number;
  vaccination_coverage_pct: number;
  nutrition_summary: Record<string, number>;
  children: ChildSummary[];
  recent_notes: FamilyNote[];
  recent_visit_requests: VisitRequestSummary[];
}

async function fetchFamilyOverview(guardianId: string): Promise<FamilyOverview> {
  const { data } = await apiClient.get(`/children/guardians/${guardianId}/family-overview/`);
  return data.data;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = {
  HIGH:    'var(--danger)',
  MEDIUM:  'var(--warn)',
  LOW:     'var(--success)',
  UNKNOWN: 'var(--text-muted)',
};

function riskVariant(r: string): 'danger' | 'warn' | 'success' | 'default' {
  if (r === 'HIGH')   return 'danger';
  if (r === 'MEDIUM') return 'warn';
  if (r === 'LOW')    return 'success';
  return 'default';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function TrendIcon({ trend }: { trend: HealthTrendItem[] }) {
  const tt = useTranslations('nurse.guardians.detail');
  if (trend.length < 2) return <Minus size={14} style={{ color: 'var(--text-muted)' }} />;
  const riskOrder = { HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
  const latest = riskOrder[trend[0].risk_level as keyof typeof riskOrder] ?? 0;
  const prev   = riskOrder[trend[1].risk_level as keyof typeof riskOrder] ?? 0;
  if (latest < prev) return <span title={tt('improving')}><TrendingDown size={14} style={{ color: 'var(--success)' }} /></span>;
  if (latest > prev) return <span title={tt('worsening')}><TrendingUp size={14} style={{ color: 'var(--danger)' }} /></span>;
  return <span title={tt('stable')}><Minus size={14} style={{ color: 'var(--text-muted)' }} /></span>;
}

// ── Vaccination bar ───────────────────────────────────────────────────────────

function VaxBar({ vax }: { vax: VaxSummary }) {
  const pct = vax.coverage_pct;
  const color = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warn)' : 'var(--danger)';
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono shrink-0" style={{ color }}>
        {vax.done}/{vax.total}
      </span>
      {vax.is_overdue && (
        <AlertTriangle size={11} style={{ color: 'var(--warn)' }} />
      )}
    </div>
  );
}

// ── Child card ────────────────────────────────────────────────────────────────

function ChildCard({ child }: { child: ChildSummary }) {
  const tt = useTranslations('nurse.guardians.detail');
  return (
    <Link
      href={`/nurse/children/${child.id}`}
      className="rounded-xl border flex flex-col gap-3 p-4 hover:shadow-md transition-shadow group"
      style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
          style={{ background: 'var(--bg-sand)', color: 'var(--ink)' }}
        >
          {child.full_name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm group-hover:underline" style={{ color: 'var(--ink)' }}>
              {child.full_name}
            </span>
            <Badge variant={riskVariant(child.risk_level)}>{child.risk_level}</Badge>
            <TrendIcon trend={child.health_trend} />
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {child.registration_number} · {child.age_display} · {child.sex === 'M' ? tt('male') : tt('female')}
          </p>
        </div>
      </div>

      {/* Measurements */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        {[
          { label: tt('weight'), val: child.latest_weight_kg ? `${parseFloat(child.latest_weight_kg).toFixed(1)} kg` : null },
          { label: tt('height'), val: child.latest_height_cm ? `${parseFloat(child.latest_height_cm).toFixed(1)} cm` : null },
          { label: 'MUAC',   val: child.latest_muac_cm ? `${parseFloat(child.latest_muac_cm).toFixed(1)} cm` : null },
        ].map(({ label, val }) => (
          <div key={label} className="rounded-lg px-2 py-1.5 text-center" style={{ background: 'var(--bg-sand)' }}>
            <p style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="font-semibold mt-0.5" style={{ color: val ? 'var(--ink)' : 'var(--text-muted)' }}>
              {val ?? '—'}
            </p>
          </div>
        ))}
      </div>

      {/* Nutrition status */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{tt('nutrition')}{' '}<span style={{ color: 'var(--ink)', fontWeight: 500 }}>{child.nutrition_status_display}</span>
        </span>
        {child.last_visit_date && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{tt('lastVisit', { fmtDate: fmtDate(child.last_visit_date) })}</span>
        )}
      </div>

      {/* Vaccination bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span style={{ color: 'var(--text-muted)' }}>{tt('vaccination')}</span>
          <span style={{ color: 'var(--text-muted)' }}>{child.vaccination.coverage_pct}%</span>
        </div>
        <VaxBar vax={child.vaccination} />
        {child.vaccination.missed > 0 && (
          <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{tt('missedDoses', { count: child.vaccination.missed })}
          </p>
        )}
      </div>

      {/* Mini health trend */}
      {child.health_trend.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {child.health_trend.map((t, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
              style={{
                background: 'var(--bg)',
                color: RISK_COLORS[t.risk_level] ?? 'var(--text-muted)',
                border: `1px solid ${RISK_COLORS[t.risk_level] ?? 'var(--border)'}`,
                opacity: 1 - i * 0.25,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: RISK_COLORS[t.risk_level] ?? 'var(--text-muted)',
                }}
              />
              {fmtDate(t.date)}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

// ── Advice panel ──────────────────────────────────────────────────────────────

function FamilyAdvice({ overview }: { overview: FamilyOverview }) {
  const tt = useTranslations('nurse.guardians.detail');
  const tips: { icon: React.ReactNode; color: string; text: string }[] = [];

  const highRisk = overview.children.filter((c) => c.risk_level === 'HIGH');
  if (highRisk.length > 0) {
    tips.push({
      icon: <AlertTriangle size={15} />,
      color: 'var(--danger)',
      text: tt('advice.highRisk', { count: highRisk.length, names: highRisk.map((c) => c.full_name).join(', ') }),
    });
  }

  const lowCoverage = overview.children.filter((c) => c.vaccination.coverage_pct < 50);
  if (lowCoverage.length > 0) {
    tips.push({
      icon: <Syringe size={15} />,
      color: 'var(--warn)',
      text: tt('advice.lowCoverage', { count: lowCoverage.length, names: lowCoverage.map((c) => c.full_name).join(', ') }),
    });
  }

  const overdue = overview.children.filter((c) => c.vaccination.is_overdue);
  if (overdue.length > 0) {
    tips.push({
      icon: <Clock size={15} />,
      color: 'var(--warn)',
      text: tt('advice.overdue', { count: overdue.length, names: overdue.map((c) => c.full_name).join(', ') }),
    });
  }

  const neverVisited = overview.children.filter((c) => !c.last_visit_date);
  if (neverVisited.length > 0) {
    tips.push({
      icon: <Baby size={15} />,
      color: 'var(--text-muted)',
      text: tt('advice.neverVisited', { count: neverVisited.length, names: neverVisited.map((c) => c.full_name).join(', ') }),
    });
  }

  const muacLow = overview.children.filter(
    (c) => c.latest_muac_cm !== null && parseFloat(c.latest_muac_cm ?? '99') < 12.5,
  );
  if (muacLow.length > 0) {
    tips.push({
      icon: <Activity size={15} />,
      color: 'var(--danger)',
      text: tt('advice.muacLow', { count: muacLow.length, names: muacLow.map((c) => c.full_name).join(', ') }),
    });
  }

  if (!overview.guardian.has_account) {
    tips.push({
      icon: <UserCheck size={15} />,
      color: 'var(--text-muted)',
      text: tt('guardianDoesNotHave'),
    });
  }

  if (tips.length === 0) {
    tips.push({
      icon: <CheckCircle size={15} />,
      color: 'var(--success)',
      text: tt('familyIsInGood'),
    });
  }

  return (
    <div className="rounded-xl border flex flex-col gap-0 overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <div className="px-4 py-3 border-b" style={{ background: 'var(--bg-sand)', borderColor: 'var(--border)' }}>
        <h3 className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{tt('clinicalGuidance')}</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{tt('aiAssistedAdviceBased')}</p>
      </div>
      {tips.map((tip, i) => (
        <div
          key={i}
          className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)' }}
        >
          <span style={{ color: tip.color, flexShrink: 0, marginTop: 1 }}>{tip.icon}</span>
          <p className="text-sm" style={{ color: 'var(--ink)' }}>{tip.text}</p>
        </div>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function GuardianProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const tt = useTranslations('nurse.guardians.detail');
  const { id } = use(params);

  const { data: overview, isLoading, error } = useQuery({
    queryKey: ['guardian-family-overview', id],
    queryFn: () => fetchFamilyOverview(id),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 max-w-4xl mx-auto w-full">
        <Skeleton className="h-6 w-32 rounded-lg" />
        <Skeleton className="h-28 rounded-2xl" />
        <div className="grid sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full">
        <Link href="/nurse/children" className="flex items-center gap-1.5 text-sm w-fit" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={14} />{' '}{tt('children')}</Link>
        <div className="rounded-xl border p-6 text-center" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--danger)' }}>{tt('couldNotLoadFamily')}</p>
        </div>
      </div>
    );
  }

  const g = overview.guardian;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      {/* Back */}
      <Link href="/nurse/children" className="flex items-center gap-1.5 text-sm w-fit" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft size={14} />{' '}{tt('children')}</Link>

      {/* Guardian header */}
      <div
        className="rounded-2xl border p-5 flex flex-wrap gap-5 items-start"
        style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
          style={{ background: 'var(--bg-sand)', color: 'var(--ink)' }}
        >
          {g.full_name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2
              className="text-xl font-bold"
              style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
            >
              {g.full_name}
            </h2>
            <Badge variant={g.has_account ? 'success' : 'default'}>
              {g.has_account ? tt('hasAccount') : tt('noAccount')}
            </Badge>
            <Badge variant={riskVariant(overview.family_risk_level)}>{tt('familyRisk', { family_risk_level: overview.family_risk_level })}</Badge>
          </div>
          <div className="flex flex-wrap gap-4 mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1">
              <Phone size={13} />
              {g.phone_number || '—'}
            </span>
            <span className="flex items-center gap-1">
              <Users size={13} />
              {g.relationship || tt('guardian')}
            </span>
            {g.user_email && (
              <span className="flex items-center gap-1">
                <UserCheck size={13} />
                {g.user_email}
              </span>
            )}
            {g.assigned_chw_name && (
              <span className="flex items-center gap-1">
                <Activity size={13} />{tt('chw', { assigned_chw_name: g.assigned_chw_name })}</span>
            )}
          </div>
          {g.national_id && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{tt('id', { national_id: g.national_id })}</p>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            icon: <Baby size={18} />,
            label: tt('children'),
            value: String(overview.total_children),
            color: 'var(--ink)',
          },
          {
            icon: <Syringe size={18} />,
            label: tt('vaxCoverage'),
            value: `${overview.vaccination_coverage_pct}%`,
            color: overview.vaccination_coverage_pct >= 80 ? 'var(--success)' : overview.vaccination_coverage_pct >= 50 ? 'var(--warn)' : 'var(--danger)',
          },
          {
            icon: <AlertTriangle size={18} />,
            label: tt('highRisk'),
            value: String(overview.children.filter((c) => c.risk_level === 'HIGH').length),
            color: overview.children.some((c) => c.risk_level === 'HIGH') ? 'var(--danger)' : 'var(--success)',
          },
          {
            icon: <Clock size={18} />,
            label: tt('overdueVax'),
            value: String(overview.children.filter((c) => c.vaccination.is_overdue).length),
            color: overview.children.some((c) => c.vaccination.is_overdue) ? 'var(--warn)' : 'var(--success)',
          },
        ].map(({ icon, label, value, color }) => (
          <div
            key={label}
            className="rounded-xl border p-4 flex flex-col gap-1"
            style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}
          >
            <span style={{ color }}>{icon}</span>
            <p className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>{value}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Clinical guidance */}
      <FamilyAdvice overview={overview} />

      {/* Children */}
      <div>
        <h3 className="font-semibold text-base mb-3" style={{ color: 'var(--ink)' }}>{tt('children2', { total_children: overview.total_children })}</h3>
        {overview.children.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{tt('noActiveChildrenFound')}</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {overview.children.map((child) => (
              <ChildCard key={child.id} child={child} />
            ))}
          </div>
        )}
      </div>

      {/* Recent clinical notes */}
      {overview.recent_notes.length > 0 && (
        <div>
          <h3 className="font-semibold text-base mb-3 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
            <Pin size={15} />{tt('recentNotes')}</h3>
          <div className="flex flex-col gap-2">
            {overview.recent_notes.map((note) => (
              <div
                key={note.id}
                className="rounded-xl border p-3 flex flex-col gap-1"
                style={{
                  background: note.is_pinned ? 'var(--med-bg)' : 'var(--bg-elev)',
                  borderColor: note.is_pinned ? 'var(--warn)' : 'var(--border)',
                }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={
                    note.note_type === 'FOLLOW_UP' ? 'warn' :
                    note.note_type === 'REFERRAL'  ? 'danger' : 'default'
                  }>
                    {note.note_type_display}
                  </Badge>
                  {note.is_pinned && <Pin size={11} style={{ color: 'var(--warn)' }} />}
                  <Link
                    href={`/nurse/children/${note.child_id}`}
                    className="text-xs hover:underline"
                    style={{ color: 'var(--ink)' }}
                  >
                    {note.child_name}
                  </Link>
                  <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                    {note.author_name ?? '—'} · {fmtDate(note.created_at)}
                  </span>
                </div>
                <p className="text-sm" style={{ color: 'var(--ink)' }}>{note.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visit requests */}
      {overview.recent_visit_requests.length > 0 && (
        <div>
          <h3 className="font-semibold text-base mb-3 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
            <MessageSquare size={15} />{tt('visitRequests')}</h3>
          <div className="flex flex-col gap-2">
            {overview.recent_visit_requests.map((vr) => {
              const urgencyColor = vr.urgency === 'URGENT' ? 'danger' : vr.urgency === 'SOON' ? 'warn' : 'default';
              const statusColor  = vr.status === 'COMPLETED' ? 'success' : vr.status === 'DECLINED' ? 'danger' : 'default';
              return (
                <div
                  key={vr.id}
                  className="rounded-xl border p-3 flex flex-col gap-1"
                  style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={urgencyColor as 'danger' | 'warn' | 'default'}>{vr.urgency}</Badge>
                    <Badge variant={statusColor as 'success' | 'danger' | 'default'}>{vr.status}</Badge>
                    <Link
                      href={`/nurse/children/${vr.child_id}`}
                      className="text-xs hover:underline"
                      style={{ color: 'var(--ink)' }}
                    >
                      {vr.child_name}
                    </Link>
                    <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                      {fmtDate(vr.created_at)}
                    </span>
                  </div>
                  {vr.concern_text && (
                    <p className="text-sm" style={{ color: 'var(--ink)' }}>{vr.concern_text}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Nutrition summary */}
      {Object.keys(overview.nutrition_summary).length > 0 && (
        <div>
          <h3 className="font-semibold text-base mb-3 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
            <Activity size={15} />{tt('nutritionDistribution')}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(overview.nutrition_summary).map(([status, count]) => (
              <div
                key={status}
                className="rounded-xl border p-3 text-center"
                style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}
              >
                <p className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>{count}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {status.replace(/_/g, ' ').toLowerCase()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
