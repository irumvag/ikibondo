'use client';

/**
 * Closed-cases audit report.
 *
 * Backed by GET /children/closed/ — the backend scopes NURSE to their own
 * camp and shows SUPERVISOR/ADMIN every camp. Deceased cases are always
 * grouped first because they're the most sensitive class and often what
 * a reviewer specifically wants to find.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, ClipboardList, Users } from 'lucide-react';
import { listClosedCases, type ClosedCase } from '@/lib/api/admin';
import { Skeleton } from '@/components/ui/Skeleton';

type StatusFilter = 'ALL' | 'DECEASED' | 'TRANSFERRED' | 'DEPARTED';

const STATUS_META: Record<
  ClosedCase['status'],
  { label: string; bg: string; fg: string }
> = {
  DECEASED:    { label: 'Deceased',    bg: 'var(--high-bg)', fg: 'var(--danger)'  },
  TRANSFERRED: { label: 'Transferred', bg: 'var(--med-bg)',  fg: 'var(--warn)'    },
  DEPARTED:    { label: 'Departed',    bg: 'var(--low-bg)',  fg: 'var(--success)' },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ClosedCasesPage() {
  const [filter, setFilter] = useState<StatusFilter>('ALL');

  const { data, isLoading, error } = useQuery({
    queryKey: ['closed-cases', filter],
    queryFn: () => listClosedCases(filter === 'ALL' ? undefined : filter),
  });

  const cases = data ?? [];
  const counts = {
    DECEASED:    cases.filter((c) => c.status === 'DECEASED').length,
    TRANSFERRED: cases.filter((c) => c.status === 'TRANSFERRED').length,
    DEPARTED:    cases.filter((c) => c.status === 'DEPARTED').length,
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        <Link href="/supervisor" className="flex items-center gap-1 hover:underline">
          <ArrowLeft size={14} aria-hidden="true" />
          Back
        </Link>
      </div>

      <div>
        <h1
          className="text-2xl md:text-3xl font-bold flex items-center gap-2"
          style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}
        >
          <ClipboardList size={22} aria-hidden="true" />
          Closed cases
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Deceased, transferred, and departed children. This is the audit trail
          — closed cases stay in the database and stop appearing in active
          lists, dashboards, and reports.
        </p>
      </div>

      {/* Filter chips — scroll on narrow screens */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
        {(['ALL', 'DECEASED', 'TRANSFERRED', 'DEPARTED'] as const).map((f) => {
          const active = filter === f;
          const badge =
            f === 'ALL' ? cases.length : counts[f as keyof typeof counts] ?? 0;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className="shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors"
              style={{
                backgroundColor: active ? 'var(--ink)' : 'transparent',
                color: active ? 'var(--bg)' : 'var(--ink)',
                borderColor: active ? 'var(--ink)' : 'var(--border)',
              }}
            >
              {f === 'ALL' ? 'All' : STATUS_META[f].label}
              <span className="ml-2 text-xs opacity-70">{badge}</span>
            </button>
          );
        })}
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div
          className="flex items-start gap-3 p-4 rounded-xl text-sm"
          style={{ background: 'var(--high-bg)', color: 'var(--danger)' }}
        >
          <AlertCircle size={16} aria-hidden="true" />
          Could not load the closed-cases report. Try refreshing.
        </div>
      ) : cases.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 py-16 text-center rounded-xl"
          style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)' }}
        >
          <Users size={28} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No closed cases {filter === 'ALL' ? 'yet' : `with status ${filter.toLowerCase()}`}.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cases.map((c) => (
            <article
              key={c.id}
              className="p-4 rounded-xl border"
              style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                <div>
                  <p className="font-semibold" style={{ color: 'var(--ink)' }}>
                    {c.child_name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {c.registration_number}
                    {c.camp_name ? ` · ${c.camp_name}` : ''}
                  </p>
                </div>
                <span
                  className="text-xs font-bold px-2 py-1 rounded-full"
                  style={{
                    background: STATUS_META[c.status].bg,
                    color: STATUS_META[c.status].fg,
                  }}
                >
                  {STATUS_META[c.status].label}
                </span>
              </div>

              <p className="text-sm mb-2" style={{ color: 'var(--ink)' }}>
                {c.reason}
              </p>

              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Closed on {fmtDate(c.closed_at)}
                {c.closed_by_name ? ` · by ${c.closed_by_name}` : ''}
                {c.guardian_name ? ` · Guardian: ${c.guardian_name}` : ''}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
