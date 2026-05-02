'use client';

import { use } from 'react';
import Link from 'next/link';
import { Syringe, CheckCircle, Clock, XCircle, SkipForward, ChevronRight } from 'lucide-react';
import { useMyChildren, useChildVaccinations } from '@/lib/api/queries';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import type { VaccinationRecord } from '@/lib/api/parent';
import type { SupervisedChild } from '@/lib/api/parent';

const VAX_STATUS: Record<string, {
  label: string;
  icon:  React.ReactNode;
  color: string;
  bg:    string;
}> = {
  DONE:      { label: 'Done',     icon: <CheckCircle size={13} />, color: 'var(--success)', bg: '#f0fdf4'         },
  SCHEDULED: { label: 'Upcoming', icon: <Clock       size={13} />, color: 'var(--ink)',     bg: 'var(--bg-sand)'  },
  MISSED:    { label: 'Missed',   icon: <XCircle     size={13} />, color: 'var(--danger)',  bg: '#fef2f2'         },
  SKIPPED:   { label: 'Skipped',  icon: <SkipForward size={13} />, color: 'var(--text-muted)', bg: 'var(--bg-elev)' },
};

function ChildVaccineCard({ child }: { child: SupervisedChild }) {
  const { data: vaccines, isLoading } = useChildVaccinations(child.id);
  const done    = vaccines?.filter((v) => v.status === 'DONE').length    ?? 0;
  const total   = vaccines?.length ?? 0;
  const overdue = vaccines?.filter((v) => v.is_overdue).length           ?? 0;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Child header */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        <div>
          <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
            {child.full_name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {child.age_display} &middot; {child.registration_number}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isLoading && total > 0 && (
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              {done}/{total} done
              {overdue > 0 && (
                <span className="ml-2 font-bold" style={{ color: 'var(--danger)' }}>
                  · {overdue} overdue
                </span>
              )}
            </span>
          )}
          <Link
            href={`/parent/children/${child.id}`}
            className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            Details <ChevronRight size={12} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Vaccine rows */}
      {isLoading ? (
        <div className="p-4 flex flex-col gap-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
        </div>
      ) : !vaccines || vaccines.length === 0 ? (
        <div className="px-5 py-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
          No vaccination records yet.
        </div>
      ) : (
        <div>
          {vaccines.map((rec) => {
            const cfg = VAX_STATUS[rec.status] ?? VAX_STATUS.SCHEDULED;
            return (
              <div
                key={rec.id}
                className="flex items-center justify-between px-5 py-3 border-b last:border-b-0"
                style={{ borderColor: 'var(--border)' }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    {rec.vaccine_name}
                    {rec.is_overdue && (
                      <span className="ml-2 text-xs font-bold" style={{ color: 'var(--danger)' }}>
                        Overdue
                      </span>
                    )}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {rec.vaccine_code} &middot;{' '}
                    {rec.administered_date ?? rec.scheduled_date}
                  </p>
                </div>
                <span
                  className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: cfg.bg, color: cfg.color }}
                >
                  {cfg.icon}
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function VaccinationCardPage() {
  const { data, isLoading } = useMyChildren();
  const children = data?.items ?? [];

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Vaccination Card
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Vaccination history for all your children
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(VAX_STATUS).map(([, cfg]) => (
          <span
            key={cfg.label}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}
          >
            {cfg.icon}
            {cfg.label}
          </span>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-6">
          {[1, 2].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : children.length === 0 ? (
        <EmptyState
          icon={<Syringe size={28} />}
          title="No children linked"
          description="Your children's vaccination records will appear here once linked to your account."
          action={{ label: 'Go to My Children', href: '/parent' }}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {children.map((child) => (
            <ChildVaccineCard key={child.id} child={child} />
          ))}
        </div>
      )}
    </div>
  );
}
