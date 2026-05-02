'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Heart, Syringe, Calendar, CheckCircle,
  XCircle, Clock, SkipForward, AlertTriangle,
} from 'lucide-react';
import { useChild, useChildHistory, useChildVaccinations } from '@/lib/api/queries';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

// ── Friendly labels (no medical jargon) ─────────────────────────────────────

const RISK_LABEL: Record<string, string> = {
  HIGH:    'Needs urgent attention',
  MEDIUM:  'Monitor closely',
  LOW:     'Healthy',
  UNKNOWN: 'Not yet assessed',
};

const RISK_BG: Record<string, string> = {
  HIGH:    '#fef2f2',
  MEDIUM:  '#fffbeb',
  LOW:     '#f0fdf4',
  UNKNOWN: 'var(--bg-sand)',
};

const RISK_COLOR: Record<string, string> = {
  HIGH:    'var(--danger)',
  MEDIUM:  'var(--warn)',
  LOW:     'var(--success)',
  UNKNOWN: 'var(--text-muted)',
};

const NUTRITION_LABEL: Record<string, string> = {
  NORMAL:      'Normal',
  MAM:         'Moderate malnutrition',
  SAM:         'Severe malnutrition',
  OVERWEIGHT:  'Overweight',
  OBESE:       'Obese',
  STUNTED:     'Stunted',
  WASTED:      'Wasted',
};

const VAX_STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  DONE:      { label: 'Done',      icon: <CheckCircle  size={14} />, color: 'var(--success)', bg: '#f0fdf4' },
  SCHEDULED: { label: 'Upcoming',  icon: <Clock        size={14} />, color: 'var(--ink)',     bg: 'var(--bg-sand)' },
  MISSED:    { label: 'Missed',    icon: <XCircle      size={14} />, color: 'var(--danger)',  bg: '#fef2f2' },
  SKIPPED:   { label: 'Skipped',   icon: <SkipForward  size={14} />, color: 'var(--text-muted)', bg: 'var(--bg-elev)' },
};

type Tab = 'status' | 'vaccines' | 'visits';

interface ChildData {
  id: string;
  full_name: string;
  age_display: string;
  sex: 'M' | 'F';
  registration_number: string;
}

export default function ParentChildDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<Tab>('status');

  const { data: rawChild,  isLoading: childLoading }    = useChild(id);
  const { data: history,   isLoading: historyLoading }  = useChildHistory(id);
  const { data: vaccines,  isLoading: vaccinesLoading } = useChildVaccinations(id);

  const child       = rawChild as ChildData | undefined;
  const latestRecord = history?.[0] ?? null;

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'status',   label: 'Health status', icon: <Heart    size={15} /> },
    { key: 'vaccines', label: 'Vaccinations',  icon: <Syringe  size={15} /> },
    { key: 'visits',   label: 'Visit history', icon: <Calendar size={15} /> },
  ];

  if (childLoading) {
    return (
      <div className="flex flex-col gap-4 max-w-2xl">
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

  const riskLevel   = latestRecord?.risk_level ?? 'UNKNOWN';
  const riskColor   = RISK_COLOR[riskLevel];
  const riskBg      = RISK_BG[riskLevel];

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Back + header */}
      <div>
        <Link
          href="/parent"
          className="inline-flex items-center gap-1.5 text-sm mb-4 transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          My children
        </Link>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          {child.full_name}
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {child.age_display} &middot; {child.sex === 'M' ? 'Boy' : 'Girl'} &middot; {child.registration_number}
        </p>
      </div>

      {/* Tab bar */}
      <div
        className="flex rounded-2xl p-1 gap-1"
        style={{ backgroundColor: 'var(--bg-sand)' }}
      >
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-sm font-medium transition-all"
            style={{
              backgroundColor: tab === key ? 'var(--bg)'  : 'transparent',
              color:           tab === key ? 'var(--ink)' : 'var(--text-muted)',
              boxShadow:       tab === key ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab: Health status ─────────────────────────────────────────────── */}
      {tab === 'status' && (
        <div className="flex flex-col gap-5">
          {/* Traffic-light status card */}
          <div
            className="rounded-2xl p-6 flex items-center gap-5"
            style={{ backgroundColor: riskBg, border: `1.5px solid ${riskColor}30` }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${riskColor}20`, color: riskColor }}
            >
              {riskLevel === 'HIGH'
                ? <AlertTriangle size={28} aria-hidden="true" />
                : <Heart size={28} aria-hidden="true" />}
            </div>
            <div>
              <p
                className="text-lg font-bold"
                style={{ color: riskColor, fontFamily: 'var(--font-fraunces)' }}
              >
                {RISK_LABEL[riskLevel]}
              </p>
              {latestRecord && (
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Last check-up: {latestRecord.measurement_date}
                </p>
              )}
              {!latestRecord && (
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  No check-ups recorded yet.
                </p>
              )}
            </div>
          </div>

          {riskLevel === 'HIGH' && (
            <div
              className="rounded-xl p-4 text-sm"
              style={{ backgroundColor: '#fef2f2', color: 'var(--danger)', borderLeft: '3px solid var(--danger)' }}
            >
              Your child has been flagged as high risk. Please visit the nearest health facility as soon as possible.
            </div>
          )}

          {/* Last visit summary */}
          {latestRecord && (
            <div
              className="rounded-2xl border p-5 flex flex-col gap-3"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Latest visit — {latestRecord.measurement_date}
              </p>
              {[
                latestRecord.weight_kg   ? ['Weight',        `${latestRecord.weight_kg} kg`]     : null,
                latestRecord.height_cm   ? ['Height',        `${latestRecord.height_cm} cm`]     : null,
                latestRecord.muac_cm     ? ['MUAC',          `${latestRecord.muac_cm} cm`]        : null,
                latestRecord.nutrition_status_display
                  ? ['Nutrition',
                     NUTRITION_LABEL[latestRecord.nutrition_status] ?? latestRecord.nutrition_status_display]
                  : null,
              ]
                .filter((x): x is string[] => x !== null)
                .map(([k, v]) => (
                  <div key={k as string} className="flex justify-between items-center text-sm border-b last:border-b-0 pb-2 last:pb-0" style={{ borderColor: 'var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                    <span className="font-medium" style={{ color: 'var(--ink)' }}>{v}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Vaccinations ─────────────────────────────────────────────── */}
      {tab === 'vaccines' && (
        <div className="flex flex-col gap-4">
          {vaccinesLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : !vaccines || vaccines.length === 0 ? (
            <EmptyState
              icon={<Syringe size={28} />}
              title="No vaccination records"
              description="Vaccination records will appear here once they are added by your health worker."
            />
          ) : (
            <>
              {/* Summary chips */}
              <div className="flex gap-3 flex-wrap">
                {(['DONE', 'SCHEDULED', 'MISSED'] as const).map((status) => {
                  const count = vaccines.filter((v) => v.status === status).length;
                  if (count === 0) return null;
                  const cfg = VAX_STATUS_CONFIG[status];
                  return (
                    <span
                      key={status}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                      style={{ backgroundColor: cfg.bg, color: cfg.color }}
                    >
                      {cfg.icon}
                      {count} {cfg.label}
                    </span>
                  );
                })}
              </div>

              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                {/* Header */}
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
                        <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                          {rec.vaccine_name}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {rec.vaccine_code}
                          {rec.is_overdue && (
                            <span className="ml-1.5 font-semibold" style={{ color: 'var(--danger)' }}>
                              · Overdue
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="text-sm whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                        {rec.administered_date ?? rec.scheduled_date}
                      </span>
                      <span
                        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                        style={{ backgroundColor: cfg.bg, color: cfg.color }}
                      >
                        {cfg.icon}
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Visit history ────────────────────────────────────────────── */}
      {tab === 'visits' && (
        <div className="flex flex-col gap-4">
          {historyLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : !history || history.length === 0 ? (
            <EmptyState
              icon={<Calendar size={28} />}
              title="No visit records"
              description="Visit records will appear here after your child's check-ups."
            />
          ) : (
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              {/* Header */}
              <div
                className="grid grid-cols-[auto_auto_auto_1fr] gap-4 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-elev)', borderBottom: '1px solid var(--border)' }}
              >
                <span>Date</span>
                <span>Weight</span>
                <span>Height</span>
                <span>Status</span>
              </div>
              {history.map((rec) => {
                const level = rec.risk_level ?? 'UNKNOWN';
                const color = RISK_COLOR[level];
                return (
                  <div
                    key={rec.id}
                    className="grid grid-cols-[auto_auto_auto_1fr] gap-4 items-center px-4 py-3.5 border-b last:border-b-0 text-sm"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <span className="font-medium whitespace-nowrap" style={{ color: 'var(--ink)' }}>
                      {rec.measurement_date}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {rec.weight_kg ? `${rec.weight_kg} kg` : '—'}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {rec.height_cm ? `${rec.height_cm} cm` : '—'}
                    </span>
                    <span
                      className="text-xs font-semibold px-2.5 py-0.5 rounded-full justify-self-start"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      {RISK_LABEL[level]}
                    </span>
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
