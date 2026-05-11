'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Syringe, CheckCircle, Clock, XCircle, SkipForward, ChevronDown, ChevronRight } from 'lucide-react';
import { useMyChildren, useChildVaccinations } from '@/lib/api/queries';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import type { SupervisedChild } from '@/lib/api/parent';

// ── Types & constants ──────────────────────────────────────────────────────────

type StatusFilter = 'ALL' | 'DONE' | 'SCHEDULED' | 'MISSED' | 'SKIPPED';

const TABS: { key: StatusFilter; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'ALL',       label: 'All',      icon: <Syringe   size={13} />, color: 'var(--ink)'        },
  { key: 'DONE',      label: 'Done',     icon: <CheckCircle size={13} />, color: 'var(--success)'  },
  { key: 'SCHEDULED', label: 'Upcoming', icon: <Clock     size={13} />, color: 'var(--warn)'       },
  { key: 'MISSED',    label: 'Missed',   icon: <XCircle   size={13} />, color: 'var(--danger)'     },
  { key: 'SKIPPED',   label: 'Skipped',  icon: <SkipForward size={13} />, color: 'var(--text-muted)' },
];

const STATUS_META: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  DONE:      { label: 'Done',     icon: <CheckCircle size={12} />, color: 'var(--success)', bg: 'color-mix(in srgb, var(--success) 12%, transparent)' },
  SCHEDULED: { label: 'Upcoming', icon: <Clock       size={12} />, color: 'var(--warn)',    bg: 'color-mix(in srgb, var(--warn) 12%, transparent)'    },
  MISSED:    { label: 'Missed',   icon: <XCircle     size={12} />, color: 'var(--danger)',  bg: 'color-mix(in srgb, var(--danger) 12%, transparent)'  },
  SKIPPED:   { label: 'Skipped',  icon: <SkipForward size={12} />, color: 'var(--text-muted)', bg: 'var(--bg-sand)' },
};

// ── Child vaccine panel (collapsed by default) ─────────────────────────────────

function ChildVaccinePanel({ child, filter }: { child: SupervisedChild; filter: StatusFilter }) {
  const [open, setOpen] = useState(false);
  const { data: vaccines, isLoading } = useChildVaccinations(child.id);

  const all     = vaccines ?? [];
  const done    = all.filter((v) => v.status === 'DONE').length;
  const overdue = all.filter((v) => v.is_overdue).length;
  const shown   = filter === 'ALL' ? all : all.filter((v) => v.status === filter);

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: overdue > 0 ? 'color-mix(in srgb, var(--danger) 35%, var(--border))' : 'var(--border)' }}>
      {/* Header — always clickable */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-[var(--bg-sand)]"
        style={{ backgroundColor: 'var(--bg-elev)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'color-mix(in srgb, var(--ink) 8%, var(--bg-sand))' }}>
            <Syringe size={16} style={{ color: 'var(--ink)' }} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{child.full_name}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {child.age_display}
              {!isLoading && <> · <span style={{ color: overdue > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{done}/{all.length} done</span></>}
              {overdue > 0 && <span className="ml-1 font-bold" style={{ color: 'var(--danger)' }}>· {overdue} overdue</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/parent/children/${child.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs px-2 py-1 rounded-lg transition-colors hover:opacity-70"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            Details
          </Link>
          {open
            ? <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
            : <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </button>

      {/* Expanded vaccine list */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {isLoading ? (
            <div className="p-4 flex flex-col gap-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
          ) : shown.length === 0 ? (
            <div className="px-4 py-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
              {filter === 'ALL' ? 'No vaccination records yet.' : `No ${filter.toLowerCase()} vaccinations.`}
            </div>
          ) : (
            <div>
              {shown.map((rec) => {
                const meta = STATUS_META[rec.status] ?? STATUS_META.SCHEDULED;
                return (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between px-4 py-3 border-b last:border-b-0"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                        {rec.vaccine_name}
                        {rec.is_overdue && (
                          <span className="ml-2 text-xs font-bold" style={{ color: 'var(--danger)' }}>Overdue</span>
                        )}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {rec.vaccine_code} · {rec.administered_date ?? rec.scheduled_date}
                      </p>
                    </div>
                    <span
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ml-3"
                      style={{ backgroundColor: meta.bg, color: meta.color }}
                    >
                      {meta.icon}
                      {meta.label}
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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function VaccinationCardPage() {
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const { data, isLoading } = useMyChildren();
  const children = data?.items ?? [];

  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto w-full">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
          Vaccination Card
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Tap a child to expand their schedule.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
        {TABS.map(({ key, label, icon, color }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex-1 justify-center"
            style={{
              backgroundColor: filter === key ? 'var(--bg)' : 'transparent',
              color:           filter === key ? color : 'var(--text-muted)',
              boxShadow:       filter === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Children */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
      ) : children.length === 0 ? (
        <EmptyState
          icon={<Syringe size={28} />}
          title="No children linked"
          description="Your children's vaccination records will appear here once linked to your account."
          action={{ label: 'Go to My Children', href: '/parent' }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {children.map((child) => (
            <ChildVaccinePanel key={child.id} child={child} filter={filter} />
          ))}
        </div>
      )}
    </div>
  );
}
