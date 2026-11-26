'use client';

import { useTranslations } from 'next-intl';
import { use, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Heart, Syringe, Calendar, CheckCircle,
  XCircle, Clock, SkipForward, AlertTriangle, Home,
  MessageSquare, Phone, MapPin, Pin, TrendingUp, QrCode, Printer,
} from 'lucide-react';
import dynamic from 'next/dynamic';
const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), { ssr: false });
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useChild, useChildHistory, useChildVaccinations, useChildNotes, useGrowthData, useChildQR } from '@/lib/api/queries';
import { listVisitRequests, type VisitRequest } from '@/lib/api/parent';
import type { GrowthData } from '@/lib/api/nurse';
import { RiskExplainer } from '@/components/ui/RiskExplainer';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';

// ── label maps ─────────────────────────────────────────────────────────────────

// Text for the codes below is in messages/en.json under parent.child: risk.<LEVEL>,
// nutritionStatus.<STATUS>, vaxStatus.<STATUS>, visitStatus.<STATUS>.
const RISK_LEVELS = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'] as const;
const NUTRITION_STATUSES = ['NORMAL', 'MAM', 'SAM', 'OVERWEIGHT', 'OBESE', 'STUNTED', 'WASTED'] as const;
const VISIT_STATUSES = ['PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED'] as const;
const oneOf = <T extends string>(list: readonly T[], v: string | null | undefined): v is T =>
  !!v && (list as readonly string[]).includes(v);
const RISK_BG: Record<string, string> = {
  HIGH: 'var(--high-bg)', MEDIUM: 'var(--med-bg)', LOW: 'var(--low-bg)', UNKNOWN: 'var(--bg-sand)',
};
const RISK_COLOR: Record<string, string> = {
  HIGH: 'var(--danger)', MEDIUM: 'var(--warn)', LOW: 'var(--success)', UNKNOWN: 'var(--text-muted)',
};
const RISK_VARIANT: Record<string, 'danger' | 'warn' | 'success' | 'default'> = {
  HIGH: 'danger', MEDIUM: 'warn', LOW: 'success', UNKNOWN: 'default',
};
const VAX_STATUS_CONFIG: Record<'DONE' | 'SCHEDULED' | 'MISSED' | 'SKIPPED', { icon: React.ReactNode; color: string; bg: string }> = {
  DONE:      { icon: <CheckCircle  size={13} />, color: 'var(--success)', bg: '#f0fdf4' },
  SCHEDULED: { icon: <Clock       size={13} />, color: 'var(--ink)',     bg: 'var(--bg-sand)' },
  MISSED:    { icon: <XCircle     size={13} />, color: 'var(--danger)',  bg: '#fef2f2' },
  SKIPPED:   { icon: <SkipForward size={13} />, color: 'var(--text-muted)', bg: 'var(--bg-elev)' },
};
const NOTE_TYPE_VARIANT: Record<string, 'danger' | 'warn' | 'info' | 'default'> = {
  REFERRAL: 'danger', FOLLOW_UP: 'warn', OBSERVATION: 'info', GENERAL: 'default',
};
const VR_STATUS_COLOR: Record<string, string> = {
  PENDING: '#d97706', ACCEPTED: '#2563eb', DECLINED: '#dc2626', COMPLETED: '#16a34a',
};

type Tab = 'status' | 'vaccines' | 'visits' | 'notes' | 'requests' | 'growth' | 'qr';
type ChartMode = 'weight' | 'height';

// ── WHO growth chart helpers ───────────────────────────────────────────────────

function buildChartData(growth: GrowthData, mode: ChartMode) {
  const percentiles = growth.who_percentiles;
  if (!percentiles) return [];
  const who = mode === 'weight'
    ? percentiles.weight_for_age
    : percentiles.height_for_age;
  if (!who) return [];
  const allAges = new Map<number, Record<string, number | null>>();

  (['p3', 'p50', 'p97'] as const).forEach((band) => {
    (who[band] ?? []).forEach((p) => {
      const entry = allAges.get(p.age_months) ?? { age: p.age_months };
      entry[band] = p.value;
      allAges.set(p.age_months, entry);
    });
  });

  growth.measurements.forEach((m) => {
    const val = mode === 'weight' ? m.weight_kg : m.height_cm;
    if (val == null) return;
    const entry = allAges.get(m.age_months) ?? { age: m.age_months };
    entry.actual = val;
    allAges.set(m.age_months, entry);
  });

  return Array.from(allAges.values()).sort((a, b) => (a.age as number) - (b.age as number));
}

function ParentGrowthChart({ growth }: { growth: GrowthData }) {
  const t = useTranslations('parent.child');
  const [mode, setMode] = useState<ChartMode>('weight');
  const data = buildChartData(growth, mode);
  const yLabel = mode === 'weight' ? t('chart.weightAxis') : t('chart.heightAxis');

  // Check if latest actual measurement is within normal WHO range
  const actuals = data.filter((d) => d.actual != null);
  const latest  = actuals[actuals.length - 1];
  const latestP3  = latest?.p3  as number | undefined;
  const latestP97 = latest?.p97 as number | undefined;
  const latestAct = latest?.actual as number | undefined;

  let rangeMsg: { text: string; color: string } | null = null;
  if (latestAct != null && latestP3 != null && latestP97 != null) {
    if (latestAct < latestP3)
      rangeMsg = { text: t('belowTheNormalRange'), color: 'var(--danger)' };
    else if (latestAct > latestP97)
      rangeMsg = { text: t('aboveTheNormalRange'), color: 'var(--warn)' };
    else
      rangeMsg = { text: t('withinTheNormalRange'), color: 'var(--success)' };
  }

  if (data.length === 0) {
    return (
      <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>{t('noGrowthDataAvailable')}</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Mode toggle */}
      <div className="flex gap-2">
        {(['weight', 'height'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="px-4 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={{
              background: mode === m ? 'var(--ink)' : 'var(--bg-elev)',
              color: mode === m ? 'var(--bg)' : 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
          >
            {m === 'weight' ? t('weight') : t('height')}
          </button>
        ))}
      </div>

      {/* Status message */}
      {rangeMsg && (
        <p className="text-xs font-medium px-3 py-2 rounded-xl"
          style={{ background: `color-mix(in srgb, ${rangeMsg.color} 10%, var(--bg-elev))`, color: rangeMsg.color }}>
          {rangeMsg.text}
        </p>
      )}

      {/* Recharts chart */}
      <div style={{ height: 260, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="age"
              type="number"
              domain={['dataMin', 'dataMax']}
              label={{ value: 'Age (months)', position: 'insideBottom', offset: -10, fontSize: 11, fill: 'var(--text-muted)' }}
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            />
            <YAxis
              label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 12, fontSize: 11, fill: 'var(--text-muted)' }}
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              width={40}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: 'var(--border)', background: 'var(--bg-elev)' }}
              labelFormatter={(v) => t('chart.ageTooltip', { months: String(v) })}
              formatter={(v: unknown, name: string | number | undefined) => {
                const key = String(name ?? '');
                const series = ['actual', 'p50', 'p3', 'p97'] as const;
                return [v != null ? Number(v).toFixed(1) : '—', oneOf(series, key) ? t(`chart.${key}`) : key];
              }}
            />
            <Legend
              iconType="line"
              formatter={(v: string) => {
                const labels: Record<string, string> = { actual: "Your child", p50: "Average", p3: "Low (p3)", p97: "High (p97)" };
                return <span style={{ fontSize: 11, color: 'var(--ink)' }}>{labels[v] ?? v}</span>;
              }}
            />
            <Line dataKey="p3"     stroke="#dc2626" strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls />
            <Line dataKey="p50"    stroke="#16a34a" strokeWidth={1.5} strokeDasharray="8 3" dot={false} connectNulls />
            <Line dataKey="p97"    stroke="#dc2626" strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls />
            <Line dataKey="actual" stroke="#1d4ed8" strokeWidth={2.5} dot={{ r: 4, fill: '#1d4ed8' }} connectNulls activeDot={{ r: 6 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend explanation */}
      <div className="rounded-xl p-3 text-xs flex flex-col gap-1" style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
        <p style={{ color: 'var(--text-muted)' }}>
          <span className="font-semibold" style={{ color: '#16a34a' }}>{t('greenLine')}</span>{' '}{t('averageForChildrenThis')}{' '}<span className="font-semibold" style={{ color: '#dc2626' }}>{t('redLines')}</span>{' '}{t('normalRangeBoundariesP3')}{' '}<span className="font-semibold" style={{ color: '#1d4ed8' }}>{t('blueLine')}</span>{' '}{t('yourChildSMeasurements')}</p>
      </div>
    </div>
  );
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Mini growth sparkline ──────────────────────────────────────────────────────

function GrowthSparkline({ data }: { data: Array<{ measurement_date: string; weight_kg?: string | null }> }) {
  const t = useTranslations('parent.child');
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
        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('weightTrend')}</span>
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
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('measurements', { date: points[0].date, date2: latest.date, length: points.length })}</p>
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
  assigned_chw_phone?: string | null;
  birth_weight?: number | null;
  gestational_age?: number | null;
  feeding_type?: 'BREAST' | 'FORMULA' | 'MIXED' | null;
}

const VALID_TABS: Tab[] = ['status', 'vaccines', 'visits', 'notes', 'requests', 'growth', 'qr'];

export default function ParentChildDetail({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations('parent.child');
  const { id }        = use(params);
  const router        = useRouter();
  const searchParams  = useSearchParams();

  const rawTab = searchParams.get('tab') as Tab | null;
  const initialTab: Tab = rawTab && VALID_TABS.includes(rawTab) ? rawTab : 'status';
  const [tab, setTab] = useState<Tab>(initialTab);

  // Keep URL in sync when tab changes
  function handleTabChange(next: Tab) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  const { data: rawChild,  isLoading: childLoading  } = useChild(id);
  const { data: history,   isLoading: histLoading   } = useChildHistory(id);
  const { data: vaccines,  isLoading: vaxLoading    } = useChildVaccinations(id);
  const { data: notes,     isLoading: notesLoading  } = useChildNotes(id);
  const { data: growth,    isLoading: growthLoading } = useGrowthData(id);
  const { data: qrData                             } = useChildQR(id);
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
    { key: 'status',   label: t('health'),        icon: <Heart         size={14} /> },
    { key: 'vaccines', label: t('vaccines'),       icon: <Syringe       size={14} /> },
    { key: 'growth',   label: t('growth'),         icon: <TrendingUp    size={14} /> },
    { key: 'visits',   label: t('visits'),         icon: <Calendar      size={14} />, badge: history?.length },
    { key: 'notes',    label: t('nurseAdvice'),   icon: <MessageSquare size={14} />, badge: pinnedNotes.length || undefined },
    { key: 'requests', label: t('myRequests'),    icon: <Home          size={14} />, badge: childVRs.filter((r: VisitRequest) => r.status === 'PENDING').length || undefined },
    { key: 'qr',       label: t('qrCard'),        icon: <QrCode        size={14} /> },
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
        title={t('childNotFound')}
        description={t('thisRecordMayNo')}
        action={{ label: t('back'), href: '/parent' }}
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
          <ArrowLeft size={14} />{' '}{t('myChildren')}</Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              className="text-2xl font-bold"
              style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
            >
              {child.full_name}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {child.age_display} · {child.sex === 'M' ? t('boy') : t('girl')} · {child.registration_number}
              {child.zone_name && <span> · <MapPin size={11} className="inline" /> {child.zone_name}</span>}
            </p>
          </div>
          <Link
            href={`/parent/request-visit?child=${id}`}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: 'var(--ink)', color: 'var(--bg)' }}
          >
            <Home size={13} />{' '}{t('requestVisit')}</Link>
        </div>
      </div>

      {/* Neonatal details — shown only if any field was recorded at registration */}
      {(child.birth_weight != null || child.gestational_age != null || child.feeding_type) && (
        <div
          className="rounded-2xl border px-4 py-3 flex flex-wrap gap-5"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)' }}
        >
          {child.birth_weight != null && (
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('birthWeight')}</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {Number(child.birth_weight).toFixed(2)} kg
              </p>
            </div>
          )}
          {child.gestational_age != null && (
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('gestationalAge')}</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('weeks', { gestational_age: child.gestational_age })}</p>
            </div>
          )}
          {child.feeding_type && (
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('feedingMethod')}</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {{ BREAST: 'Breastfed', FORMULA: 'Formula', MIXED: 'Mixed' }[child.feeding_type]}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pinned nurse alert */}
      {pinnedNotes.length > 0 && (
        <div
          className="flex items-start gap-3 px-4 py-3.5 rounded-2xl border text-sm cursor-pointer"
          style={{ background: 'color-mix(in srgb, var(--warn) 8%, var(--bg-elev))', borderColor: 'var(--warn)' }}
          onClick={() => handleTabChange('notes')}
        >
          <Pin size={15} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 2 }} />
          <div className="flex-1">
            <p className="font-semibold" style={{ color: 'var(--ink)' }}>{t('pinnedNotes', { count: pinnedNotes.length })}</p>
            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-muted)' }}>
              {pinnedNotes[0].content}
            </p>
          </div>
          <span className="text-xs shrink-0" style={{ color: 'var(--warn)' }}>{t('view')}</span>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        active={tab}
        onChange={(k) => handleTabChange(k as Tab)}
        tabs={TABS}
      />

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
                {oneOf(RISK_LEVELS, riskLevel) ? t(`risk.${riskLevel}`) : riskLevel}
              </p>
              {latestRecord
                ? <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('lastChecked', { fmtDate: fmtDate(latestRecord.measurement_date) })}</p>
                : <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('noCheckUpsRecorded')}</p>}
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
                <p className="font-semibold" style={{ color: 'var(--danger)' }}>{t('yourChildNeedsUrgent')}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('pleaseVisitTheNearest')}</p>
              </div>
            </div>
          )}

          {/* Plain-language AI risk explanation */}
          {latestRecord?.risk_factors && riskLevel !== 'UNKNOWN' && (
            <div
              className="rounded-2xl border p-5"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
            >
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>{t('whyThisAssessment')}</p>
              <RiskExplainer
                factors={latestRecord.risk_factors as Record<string, number>}
                riskLevel={riskLevel}
                plain
                limit={5}
              />
            </div>
          )}

          {/* Latest measurements */}
          {latestRecord && (
            <div
              className="rounded-2xl border p-5 flex flex-col gap-3"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)' }}
            >
              <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('latestVisit', { fmtDate: fmtDate(latestRecord.measurement_date) })}</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  latestRecord.weight_kg    ? [t('measure.weight'), t('measure.kgValue', { value: latestRecord.weight_kg })]      : null,
                  latestRecord.height_cm    ? [t('measure.height'), t('measure.cmValue', { value: latestRecord.height_cm })]      : null,
                  latestRecord.muac_cm      ? [t('measure.muac'),   t('measure.cmValue', { value: latestRecord.muac_cm })]        : null,
                  latestRecord.temperature_c ? [t('measure.temp'),  t('measure.celsiusValue', { value: latestRecord.temperature_c })] : null,
                  latestRecord.nutrition_status_display
                    ? [t('measure.nutrition'), oneOf(NUTRITION_STATUSES, latestRecord.nutrition_status) ? t(`nutritionStatus.${latestRecord.nutrition_status}`) : latestRecord.nutrition_status_display]
                    : null,
                  latestRecord.oedema ? [t('measure.oedema'), t('measure.yes')] : null,
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

          {/* Care team — shows only when a CHW is assigned to the family */}
          {child.assigned_chw_name && (
            <div
              className="rounded-2xl border p-4 flex flex-col gap-3"
              style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}
            >
              <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('yourCareTeam')}</p>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                  style={{ background: 'var(--bg-sand)', color: 'var(--ink)' }}
                >
                  {child.assigned_chw_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{child.assigned_chw_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('communityHealthWorker')}</p>
                </div>
                <Link
                  href={`/parent/request-visit?child=${id}`}
                  className="text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors hover:bg-[var(--bg-sand)] shrink-0"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
                >{t('requestVisit')}</Link>
              </div>
              {child.assigned_chw_phone && (
                <a
                  href={`tel:${child.assigned_chw_phone}`}
                  className="flex items-center gap-2 text-sm font-medium rounded-xl px-3 py-2 transition-colors hover:bg-[var(--bg-sand)]"
                  style={{ color: 'var(--ink)', border: '1px solid var(--border)' }}
                >
                  <Phone size={14} aria-hidden="true" />
                  <span>{t('callChw', { assigned_chw_phone: child.assigned_chw_phone })}</span>
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
              title={t('noVaccinationRecords')}
              description={t('vaccinationRecordsWillAppear')}
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
                      {cfg.icon} {count} {t(`vaxStatus.${status}`)}
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
                    {t('vaccinesOverdue', { count: vaccines.filter((v) => v.is_overdue).length })}</p>
                </div>
              )}

              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <div
                  className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2.5 text-xs font-semibold"
                  style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-elev)', borderBottom: '1px solid var(--border)' }}
                >
                  <span>{t('vaccine2')}</span>
                  <span>{t('date')}</span>
                  <span>{t('status')}</span>
                </div>
                {vaccines.map((rec) => {
                  const vaxStatus = rec.status in VAX_STATUS_CONFIG ? (rec.status as keyof typeof VAX_STATUS_CONFIG) : 'SCHEDULED';
                  const cfg = VAX_STATUS_CONFIG[vaxStatus];
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
                            <span className="ml-1.5 font-semibold" style={{ color: 'var(--danger)' }}>{t('overdue')}</span>
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
                        {cfg.icon} {t(`vaxStatus.${vaxStatus}`)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Growth chart tab ──────────────────────────────────────────────────── */}
      {tab === 'growth' && (
        <div
          className="rounded-2xl border p-5 flex flex-col gap-4"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)' }}
        >
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('whoGrowthChart')}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('compareYourChildS')}</p>
          </div>
          {growthLoading ? (
            <div className="flex flex-col gap-2">
              <div className="h-4 rounded" style={{ background: 'var(--bg-sand)', width: '40%' }} />
              <div className="h-56 rounded-xl" style={{ background: 'var(--bg-sand)' }} />
            </div>
          ) : growth?.who_percentiles ? (
            <ParentGrowthChart growth={growth as GrowthData} />
          ) : (
            <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('growthDataNotAvailable')}</p>
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
              title={t('noVisitRecords')}
              description={t('recordsWillAppearAfter')}
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
                    <Badge variant={RISK_VARIANT[level] ?? 'default'}>{oneOf(RISK_LEVELS, level) ? t(`risk.${level}`) : level}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    {[
                      [t('measure.weight'), rec.weight_kg ? t('measure.kgValue', { value: rec.weight_kg }) : null],
                      [t('measure.height'), rec.height_cm ? t('measure.cmValue', { value: rec.height_cm }) : null],
                      [t('measure.muac'),   rec.muac_cm   ? t('measure.cmValue', { value: rec.muac_cm })   : null],
                    ].filter(([, v]) => v).map(([k, v]) => (
                      <div key={k as string}>
                        <p style={{ color: 'var(--text-muted)' }}>{k}</p>
                        <p className="font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{v}</p>
                      </div>
                    ))}
                  </div>
                  {rec.nutrition_status_display && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('nutrition')}{' '}<span className="font-medium" style={{ color: 'var(--ink)' }}>
                        {oneOf(NUTRITION_STATUSES, rec.nutrition_status) ? t(`nutritionStatus.${rec.nutrition_status}`) : rec.nutrition_status_display}
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
              title={t('noNurseNotesYet')}
              description={t('adviceAndObservationsFrom')}
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
                      <Pin size={11} />{' '}{t('important')}</span>
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
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('requestsSubmitted', { count: childVRs.length })}</p>
            <Link
              href={`/parent/request-visit?child=${id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              <Home size={12} />{' '}{t('newRequest')}</Link>
          </div>

          {vrLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : childVRs.length === 0 ? (
            <EmptyState
              icon={<Home size={28} />}
              title={t('noVisitRequests')}
              description={t('tapNewRequestTo')}
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
                        {t(`urgencyVisit.${vr.urgency === 'URGENT' || vr.urgency === 'SOON' ? vr.urgency : 'ROUTINE'}`)}</span>
                      <span
                        className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `${color}20`, color }}
                      >
                        {oneOf(VISIT_STATUSES, vr.status) ? t(`visitStatus.${vr.status}`) : vr.status}
                      </span>
                    </div>
                    {vr.concern_text && (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{vr.concern_text}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>{t('submitted2', { fmtDate: fmtDate(vr.created_at) })}</span>
                      {vr.assigned_chw_name && <span>{t('chw', { assigned_chw_name: vr.assigned_chw_name })}</span>}
                      {vr.eta && <span>{t('eta', { time: new Date(vr.eta).toLocaleString() })}</span>}
                    </div>
                    {vr.decline_reason && (
                      <p
                        className="text-xs px-3 py-1.5 rounded-xl"
                        style={{ background: '#fef2f2', color: 'var(--danger)' }}
                      >{t('declined', { decline_reason: vr.decline_reason })}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── QR Card tab ─────────────────────────────────────────────────────── */}
      {tab === 'qr' && child && (
        <div className="flex flex-col items-center gap-5">
          {/* Card */}
          <div
            id="parent-child-qr"
            className="rounded-3xl border p-6 flex flex-col items-center gap-4 w-full max-w-xs"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', boxShadow: 'var(--shadow-md)' }}
          >
            {/* Header */}
            <div className="text-center">
              <p className="font-bold text-xl" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
                {child.full_name}
              </p>
              <p className="text-xs mt-1 font-mono tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {child.registration_number}
              </p>
            </div>

            {/* QR image — backend PNG preferred, client-side SVG fallback */}
            <div className="p-4 rounded-2xl" style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }}>
              {qrData?.png_base64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:image/png;base64,${qrData.png_base64}`}
                  alt={`QR code for ${child.full_name}`}
                  width={192}
                  height={192}
                  style={{ display: 'block', imageRendering: 'pixelated' }}
                />
              ) : (
                <QRCodeSVG value={id} size={192} level="M" includeMargin={false} />
              )}
            </div>

            {/* Camp badge */}
            {child.camp_name && (
              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: 'var(--bg-sand)', color: 'var(--ink)' }}
              >
                <MapPin size={11} aria-hidden="true" />
                {child.camp_name}
              </div>
            )}

            <p className="text-xs text-center leading-relaxed" style={{ color: 'var(--text-muted)' }}>{t('showThisCodeTo')}</p>
          </div>

          {/* Print button */}
          <button
            onClick={() => {
              const card = document.getElementById('parent-child-qr');
              const w = window.open('', '_blank', 'width=420,height=560');
              if (!w || !card) return;
              const qrHtml = qrData?.png_base64
                ? `<img src="data:image/png;base64,${qrData.png_base64}" width="192" height="192" style="display:block;image-rendering:pixelated;" />`
                : (card.querySelector('svg')?.outerHTML ?? '');
              w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>QR Card — ${child.full_name}</title>
                <style>
                  body{font-family:Arial,sans-serif;display:flex;flex-direction:column;align-items:center;
                    justify-content:center;min-height:100vh;margin:0;padding:32px;text-align:center;background:#fff;}
                  h1{font-size:20px;font-weight:700;margin:0 0 4px;}
                  .reg{font-size:11px;font-family:monospace;color:#6b7280;letter-spacing:.05em;margin-bottom:16px;}
                  .qr{padding:16px;border:1px solid #e5e7eb;border-radius:16px;display:inline-block;margin-bottom:16px;}
                  .camp{font-size:11px;color:#6b7280;margin-bottom:8px;}
                  .footer{font-size:9px;color:#9ca3af;margin-top:8px;}
                </style></head>
                <body>
                  <h1>${child.full_name}</h1>
                  <p class="reg">${child.registration_number}</p>
                  <div class="qr">${qrHtml}</div>
                  ${child.camp_name ? `<p class="camp">${child.camp_name}</p>` : ''}
                  <p class="footer">Scan to view health record · Ikibondo</p>
                  <script>window.onload=function(){window.print();};<\/script>
                </body></html>`);
              w.document.close();
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:bg-[var(--bg-sand)]"
            style={{ borderColor: 'var(--border)', color: 'var(--ink)', backgroundColor: 'var(--bg-elev)' }}
          >
            <Printer size={14} aria-hidden="true" />{' '}{t('printQrCard')}</button>
        </div>
      )}
    </div>
  );
}
