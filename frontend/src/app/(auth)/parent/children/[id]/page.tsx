'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Heart, Syringe, Calendar, CheckCircle,
  XCircle, Clock, SkipForward, AlertTriangle, Home,
  MessageSquare, Phone, MapPin, Pin, TrendingUp,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useChild, useChildHistory, useChildVaccinations, useChildNotes } from '@/lib/api/queries';
import { listVisitRequests, type VisitRequest } from '@/lib/api/parent';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';

// ── label maps ─────────────────────────────────────────────────────────────────

const RISK_LABEL: Record<string, string> = {
  HIGH: 'Needs urgent attention', MEDIUM: 'Monitor closely',
  LOW: 'Healthy', UNKNOWN: 'Not yet assessed',
};
const RISK_BG: Record<string, string> = {
  HIGH: '#fef2f2', MEDIUM: '#fffbeb', LOW: '#f0fdf4', UNKNOWN: 'var(--bg-sand)',
};
const RISK_COLOR: Record<string, string> = {
  HIGH: 'var(--danger)', MEDIUM: 'var(--warn)', LOW: 'var(--success)', UNKNOWN: 'var(--text-muted)',
};
const RISK_VARIANT: Record<string, 'danger' | 'warn' | 'success' | 'default'> = {
  HIGH: 'danger', MEDIUM: 'warn', LOW: 'success', UNKNOWN: 'default',
};
const NUTRITION_LABEL: Record<string, string> = {
  NORMAL: 'Normal', MAM: 'Moderate malnutrition', SAM: 'Severe malnutrition',
  OVERWEIGHT: 'Overweight', OBESE: 'Obese', STUNTED: 'Stunted', WASTED: 'Wasted',
};
const VAX_STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  DONE:      { label: 'Done',    icon: <CheckCircle  size={13} />, color: 'var(--success)', bg: '#f0fdf4' },
  SCHEDULED: { label: 'Upcoming', icon: <Clock       size={13} />, color: 'var(--ink)',     bg: 'var(--bg-sand)' },
  MISSED:    { label: 'Missed',   icon: <XCircle     size={13} />, color: 'var(--danger)',  bg: '#fef2f2' },
  SKIPPED:   { label: 'Skipped',  icon: <SkipForward size={13} />, color: 'var(--text-muted)', bg: 'var(--bg-elev)' },
};
const NOTE_TYPE_VARIANT: Record<string, 'danger' | 'warn' | 'info' | 'default'> = {
  REFERRAL: 'danger', FOLLOW_UP: 'warn', OBSERVATION: 'info', GENERAL: 'default',
};
const VR_STATUS_COLOR: Record<string, string> = {
  PENDING: '#d97706', ACCEPTED: '#2563eb', DECLINED: '#dc2626', COMPLETED: '#16a34a',
};
const VR_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending', ACCEPTED: 'Accepted', DECLINED: 'Declined', COMPLETED: 'Completed',
};

type Tab = 'status' | 'vaccines' | 'visits' | 'notes' | 'requests';

function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Mini growth sparkline ──────────────────────────────────────────────────────

function GrowthSparkline({ data }: { data: Array<{ measurement_date: string; weight_kg?: string | null }> }) {
  const points = data
    .slice(0, 8)
    .reverse()
    .map((d) => ({ date: d.measurement_date, w: d.weight_kg ? parseFloat(d.weight_kg) : null }))
    .filter((d) => d.w !== null) as { date: string; w: number }[];

  if (points.length < 2) return null;

  const min = Math.min(...points.map((p) => p.w)) * 0.95;
  const max = Math.max(...points.map((p) => p.w)) * 1.05;
  const range = max - min || 1;
  const W = 200, H = 48;

  const coords = points.map((p, i) => ({
    x: (i / (points.length - 1)) * W,
    y: H - ((p.w - min) / range) * H,
  }));

  const path = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  const latest  = points[points.length - 1];
  const prev    = points[points.length - 2];
  const trend   = latest.w > prev.w ? '↑' : latest.w < prev.w ? '↓' : '→';
  const trendColor = latest.w > prev.w ? 'var(--success)' : latest.w < prev.w ? 'var(--danger)' : 'var(--text-muted)';

  return (
    <div
      className="rounded-2xl border p-4 flex flex-col gap-2"
      style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Weight trend
        </span>
        <span className="text-sm font-bold" style={{ color: trendColor }}>
          {trend} {latest.w} kg
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: 48 }}>
        <path d={path} fill="none" stroke="var(--primary, #2563eb)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="3" fill="var(--primary, #2563eb)" />
        ))}
      </svg>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {points[0].date} → {latest.date} · {points.length} measurements
      </p>
    </div>
  );
}

// ── Child detail ───────────────────────────────────────────────────────────────

interface ChildData {
  id: string;
  full_name: string;
  age_display: string;
  sex: 'M' | 'F';
  registration_number: string;
  camp_name?: string;
  zone_name?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  assigned_chw_name?: string | null;
}

export default function ParentChildDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id }   = use(params);
  const [tab, setTab] = useState<Tab>('status');

  const { data: rawChild,  isLoading: childLoading  } = useChild(id);
  const { data: history,   isLoading: histLoading   } = useChildHistory(id);
  const { data: vaccines,  isLoading: vaxLoading    } = useChildVaccinations(id);
  const { data: notes,     isLoading: notesLoading  } = useChildNotes(id);
  const { data: visitReqs, isLoading: vrLoading     } = useQuery<VisitRequest[]>({
    queryKey: ['parent', 'visit-requests'],
    queryFn:  () => listVisitRequests(),
    staleTime: 30_000,
  });

  const child         = rawChild as ChildData | undefined;
  const latestRecord  = history?.[0] ?? null;
  const childVRs      = (visitReqs ?? []).filter((vr) => vr.child === id);
  const pinnedNotes   = (notes ?? []).filter((n) => n.is_pinned);

  const TABS: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'status',   label: 'Health',        icon: <Heart     size={14} /> },
    { key: 'vaccines', label: 'Vaccines',       icon: <Syringe   size={14} /> },
    { key: 'visits',   label: 'Visits',         icon: <Calendar  size={14} />, badge: history?.length },
    { key: 'notes',    label: 'Nurse advice',   icon: <MessageSquare size={14} />, badge: pinnedNotes.length || undefined },
    { key: 'requests', label: 'My requests',    icon: <Home      size={14} />, badge: childVRs.filter((r: VisitRequest) => r.status === 'PENDING').length || undefined },
  ];

  if (childLoading) {
    return (
      <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!child) {
    return (
      <EmptyState
        title="Child not found"
        description="This record may no longer be available."
        action={{ label: 'Back', href: '/parent' }}
      />
    );
  }

  const riskLevel = (latestRecord?.risk_level as string | undefined) ?? 'UNKNOWN';
  const riskColor = RISK_COLOR[riskLevel] ?? 'var(--text-muted)';
  const riskBg    = RISK_BG[riskLevel]    ?? 'var(--bg-sand)';

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto w-full">

      {/* Back + name */}
      <div>
        <Link
          href="/parent"
          className="inline-flex items-center gap-1.5 text-sm mb-3 transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={14} /> My children
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              className="text-2xl font-bold"
              style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
            >
              {child.full_name}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {child.age_display} · {child.sex === 'M' ? 'Boy' : 'Girl'} · {child.registration_number}
              {child.zone_name && <span> · <MapPin size={11} className="inline" /> {child.zone_name}</span>}
            </p>
          </div>
          <Link
            href={`/parent/request-visit?child=${id}`}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: 'var(--ink)', color: 'var(--bg)' }}
          >
            <Home size={13} /> Request visit
          </Link>
        </div>
      </div>

      {/* Pinned nurse alert */}
      {pinnedNotes.length > 0 && (
        <div
          className="flex items-start gap-3 px-4 py-3.5 rounded-2xl border text-sm cursor-pointer"
          style={{ background: 'color-mix(in srgb, var(--warn) 8%, var(--bg-elev))', borderColor: 'var(--warn)' }}
          onClick={() => setTab('notes')}
        >
          <Pin size={15} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 2 }} />
          <div className="flex-1">
            <p className="font-semibold" style={{ color: 'var(--ink)' }}>
              📌 {pinnedNotes.length} pinned note{pinnedNotes.length !== 1 ? 's' : ''} from your nurse
            </p>
            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-muted)' }}>
              {pinnedNotes[0].content}
            </p>
          </div>
          <span className="text-xs shrink-0" style={{ color: 'var(--warn)' }}>View →</span>
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex rounded-2xl p-1 gap-1 overflow-x-auto"
        style={{ backgroundColor: 'var(--bg-sand)' }}
      >
        {TABS.map(({ key, label, icon, badge }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className="flex-1 relative flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap min-w-0"
            style={{
              backgroundColor: tab === key ? 'var(--bg)'  : 'transparent',
              color:           tab === key ? 'var(--ink)' : 'var(--text-muted)',
              boxShadow:       tab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
            {badge ? (
              <span
                className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{ background: 'var(--warn)', color: 'white' }}
              >
                {badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Health status tab ─────────────────────────────────────────────────── */}
      {tab === 'status' && (
        <div className="flex flex-col gap-4">
          {/* Traffic-light card */}
          <div
            className="rounded-2xl p-5 flex items-center gap-5"
            style={{ backgroundColor: riskBg, border: `1.5px solid ${riskColor}40` }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${riskColor}20`, color: riskColor }}
            >
              {riskLevel === 'HIGH'
                ? <AlertTriangle size={28} />
                : <Heart size={28} />}
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: riskColor, fontFamily: 'var(--font-fraunces)' }}>
                {RISK_LABEL[riskLevel]}
              </p>
              {latestRecord
                ? <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Last checked: {fmtDate(latestRecord.measurement_date)}</p>
                : <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>No check-ups recorded yet</p>}
            </div>
          </div>

          {/* Urgent CTA */}
          {riskLevel === 'HIGH' && (
            <div
              className="rounded-2xl p-4 flex items-start gap-3 text-sm border"
              style={{ background: '#fef2f2', borderColor: 'var(--danger)' }}
            >
              <AlertTriangle size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="font-semibold" style={{ color: 'var(--danger)' }}>Your child needs urgent attention</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Please visit the nearest health facility or request a home visit now.
                </p>
              </div>
            </div>
          )}

          {/* Latest measurements */}
          {latestRecord && (
            <div
              className="rounded-2xl border p-5 flex flex-col gap-3"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)' }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Latest visit — {fmtDate(latestRecord.measurement_date)}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  latestRecord.weight_kg    ? ['Weight',    `${latestRecord.weight_kg} kg`]     : null,
                  latestRecord.height_cm    ? ['Height',    `${latestRecord.height_cm} cm`]     : null,
                  latestRecord.muac_cm      ? ['MUAC',      `${latestRecord.muac_cm} cm`]        : null,
                  latestRecord.temperature_c ? ['Temp',     `${latestRecord.temperature_c}°C`]   : null,
                  latestRecord.nutrition_status_display
                    ? ['Nutrition', NUTRITION_LABEL[latestRecord.nutrition_status] ?? latestRecord.nutrition_status_display]
                    : null,
                  latestRecord.oedema ? ['Oedema', 'Yes'] : null,
                ].filter((x): x is string[] => x !== null).map(([k, v]) => (
                  <div key={k} className="rounded-xl p-3" style={{ background: 'var(--bg-sand)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{k}</p>
                    <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{v}</p>
                  </div>
                ))}
              </div>
              {(latestRecord.symptom_flags?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {latestRecord.symptom_flags.map((f: string) => (
                    <span key={f} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fef2f2', color: 'var(--danger)' }}>
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Growth sparkline */}
          {(history?.length ?? 0) >= 2 && (
            <GrowthSparkline data={history ?? []} />
          )}

          {/* CHW contact */}
          {(child.assigned_chw_name || child.guardian_phone) && (
            <div
              className="rounded-2xl border p-4 flex flex-col gap-3"
              style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Your care team
              </p>
              {child.assigned_chw_name && (
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                    style={{ background: 'var(--bg-sand)', color: 'var(--ink)' }}
                  >
                    {child.assigned_chw_name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{child.assigned_chw_name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Community Health Worker</p>
                  </div>
                  <Link
                    href={`/parent/request-visit?child=${id}`}
                    className="text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors hover:bg-[var(--bg-sand)]"
                    style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
                  >
                    Request visit
                  </Link>
                </div>
              )}
              {child.guardian_phone && (
                <a
                  href={`tel:${child.guardian_phone}`}
                  className="flex items-center gap-2 text-sm font-medium"
                  style={{ color: 'var(--primary, #2563eb)' }}
                >
                  <Phone size={14} /> {child.guardian_phone}
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Vaccines tab ──────────────────────────────────────────────────────── */}
      {tab === 'vaccines' && (
        <div className="flex flex-col gap-4">
          {vaxLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : !vaccines || vaccines.length === 0 ? (
            <EmptyState
              icon={<Syringe size={28} />}
              title="No vaccination records"
              description="Vaccination records will appear here once added by your health worker."
            />
          ) : (
            <>
              {/* Summary chips */}
              <div className="flex gap-2 flex-wrap">
                {(['DONE', 'SCHEDULED', 'MISSED'] as const).map((status) => {
                  const count = vaccines.filter((v) => v.status === status).length;
                  if (!count) return null;
                  const cfg = VAX_STATUS_CONFIG[status];
                  return (
                    <span
                      key={status}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                      style={{ backgroundColor: cfg.bg, color: cfg.color }}
                    >
                      {cfg.icon} {count} {cfg.label}
                    </span>
                  );
                })}
              </div>

              {/* Overdue warning */}
              {vaccines.some((v) => v.is_overdue) && (
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm"
                  style={{ background: '#fef2f2', borderColor: 'var(--danger)' }}
                >
                  <AlertTriangle size={15} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                  <p style={{ color: 'var(--danger)' }}>
                    {vaccines.filter((v) => v.is_overdue).length} vaccine{vaccines.filter((v) => v.is_overdue).length !== 1 ? 's are' : ' is'} overdue — visit a health facility.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <div
                  className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-elev)', borderBottom: '1px solid var(--border)' }}
                >
                  <span>Vaccine</span>
                  <span>Date</span>
                  <span>Status</span>
                </div>
                {vaccines.map((rec) => {
                  const cfg = VAX_STATUS_CONFIG[rec.status] ?? VAX_STATUS_CONFIG.SCHEDULED;
                  return (
                    <div
                      key={rec.id}
                      className="grid grid-cols-[1fr_auto_auto] gap-4 items-center px-4 py-3.5 border-b last:border-b-0"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{rec.vaccine_name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {rec.vaccine_code}
                          {rec.is_overdue && (
                            <span className="ml-1.5 font-semibold" style={{ color: 'var(--danger)' }}>· Overdue</span>
                          )}
                        </p>
                      </div>
                      <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                        {rec.administered_date ?? rec.scheduled_date}
                      </span>
                      <span
                        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                        style={{ backgroundColor: cfg.bg, color: cfg.color }}
                      >
                        {cfg.icon} {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Visit history tab ─────────────────────────────────────────────────── */}
      {tab === 'visits' && (
        <div className="flex flex-col gap-3">
          {histLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : !history || history.length === 0 ? (
            <EmptyState
              icon={<Calendar size={28} />}
              title="No visit records"
              description="Records will appear after your child's check-ups with a health worker."
            />
          ) : (
            history.map((rec) => {
              const level = (rec.risk_level as string | undefined) ?? 'UNKNOWN';
              return (
                <div
                  key={rec.id}
                  className="rounded-2xl border p-4 flex flex-col gap-3"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                      {fmtDate(rec.measurement_date)}
                    </span>
                    <Badge variant={RISK_VARIANT[level] ?? 'default'}>{RISK_LABEL[level]}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    {[
                      ['Weight', rec.weight_kg ? `${rec.weight_kg} kg` : null],
                      ['Height', rec.height_cm ? `${rec.height_cm} cm` : null],
                      ['MUAC',   rec.muac_cm   ? `${rec.muac_cm} cm`   : null],
                    ].filter(([, v]) => v).map(([k, v]) => (
                      <div key={k as string}>
                        <p style={{ color: 'var(--text-muted)' }}>{k}</p>
                        <p className="font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{v}</p>
                      </div>
                    ))}
                  </div>
                  {rec.nutrition_status_display && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Nutrition: <span className="font-medium" style={{ color: 'var(--ink)' }}>
                        {NUTRITION_LABEL[rec.nutrition_status] ?? rec.nutrition_status_display}
                      </span>
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Nurse advice tab ──────────────────────────────────────────────────── */}
      {tab === 'notes' && (
        <div className="flex flex-col gap-3">
          {notesLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : !notes || notes.length === 0 ? (
            <EmptyState
              icon={<MessageSquare size={28} />}
              title="No nurse notes yet"
              description="Advice and observations from your nurse will appear here after check-ups."
            />
          ) : (
            notes.map((n) => (
              <div
                key={n.id}
                className="rounded-2xl border p-4 flex flex-col gap-2"
                style={{
                  borderColor: n.is_pinned ? 'var(--warn)' : 'var(--border)',
                  background: n.is_pinned
                    ? 'color-mix(in srgb, var(--warn) 8%, var(--bg-elev))'
                    : 'var(--bg-elev)',
                }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={NOTE_TYPE_VARIANT[n.note_type] ?? 'default'}>
                    {n.note_type_display}
                  </Badge>
                  {n.is_pinned && (
                    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--warn)' }}>
                      <Pin size={11} /> Important
                    </span>
                  )}
                  <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
                    {fmtDate(n.created_at)}
                  </span>
                </div>
                <p className="text-sm" style={{ color: 'var(--ink)' }}>{n.content}</p>
                {n.author_name && (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    — {n.author_name}{n.author_role ? `, ${n.author_role}` : ''}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Visit requests tab ────────────────────────────────────────────────── */}
      {tab === 'requests' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {childVRs.length} request{childVRs.length !== 1 ? 's' : ''} submitted
            </p>
            <Link
              href={`/parent/request-visit?child=${id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              <Home size={12} /> New request
            </Link>
          </div>

          {vrLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : childVRs.length === 0 ? (
            <EmptyState
              icon={<Home size={28} />}
              title="No visit requests"
              description="Tap 'New request' to ask your community health worker to visit your home."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {childVRs.map((vr: VisitRequest) => {
                const color = VR_STATUS_COLOR[vr.status] ?? '#6b7280';
                return (
                  <div
                    key={vr.id}
                    className="rounded-2xl border p-4 flex flex-col gap-2"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                        {vr.urgency === 'URGENT' ? '🚨 Urgent' : vr.urgency === 'SOON' ? '⏰ Soon' : '📋 Routine'} visit
                      </span>
                      <span
                        className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `${color}20`, color }}
                      >
                        {VR_STATUS_LABEL[vr.status]}
                      </span>
                    </div>
                    {vr.concern_text && (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{vr.concern_text}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>Submitted: {fmtDate(vr.created_at)}</span>
                      {vr.assigned_chw_name && <span>CHW: {vr.assigned_chw_name}</span>}
                      {vr.eta && <span>ETA: {new Date(vr.eta).toLocaleString()}</span>}
                    </div>
                    {vr.decline_reason && (
                      <p
                        className="text-xs px-3 py-1.5 rounded-xl"
                        style={{ background: '#fef2f2', color: 'var(--danger)' }}
                      >
                        Declined: {vr.decline_reason}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
