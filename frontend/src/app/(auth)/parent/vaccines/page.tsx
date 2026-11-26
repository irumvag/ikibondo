'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Link from 'next/link';
import { Syringe, CheckCircle, Clock, XCircle, SkipForward, ChevronDown, ChevronRight, Printer } from 'lucide-react';
import { useMyChildren, useChildVaccinations } from '@/lib/api/queries';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import type { SupervisedChild } from '@/lib/api/parent';
import { printVaccinationCertificate } from '@/lib/vaccinationCertificate';
import { useToast } from '@/contexts/ToastContext';

// ── Types & constants ──────────────────────────────────────────────────────────

type StatusFilter = 'ALL' | 'DONE' | 'SCHEDULED' | 'MISSED' | 'SKIPPED';

// Tab and status text: messages/en.json parent.vaccines.status.<key>
const TABS: { key: StatusFilter; icon: React.ReactNode; color: string }[] = [
  { key: 'ALL',       icon: <Syringe   size={13} />, color: 'var(--ink)'        },
  { key: 'DONE',      icon: <CheckCircle size={13} />, color: 'var(--success)'  },
  { key: 'SCHEDULED', icon: <Clock     size={13} />, color: 'var(--warn)'       },
  { key: 'MISSED',    icon: <XCircle   size={13} />, color: 'var(--danger)'     },
  { key: 'SKIPPED',   icon: <SkipForward size={13} />, color: 'var(--text-muted)' },
];

const STATUS_META: Record<'DONE' | 'SCHEDULED' | 'MISSED' | 'SKIPPED', { icon: React.ReactNode; color: string; bg: string }> = {
  DONE:      { icon: <CheckCircle size={12} />, color: 'var(--success)', bg: 'color-mix(in srgb, var(--success) 12%, transparent)' },
  SCHEDULED: { icon: <Clock       size={12} />, color: 'var(--warn)',    bg: 'color-mix(in srgb, var(--warn) 12%, transparent)'    },
  MISSED:    { icon: <XCircle     size={12} />, color: 'var(--danger)',  bg: 'color-mix(in srgb, var(--danger) 12%, transparent)'  },
  SKIPPED:   { icon: <SkipForward size={12} />, color: 'var(--text-muted)', bg: 'var(--bg-sand)' },
};

// ── Child vaccine panel (collapsed by default) ─────────────────────────────────

function ChildVaccinePanel({ child, filter }: { child: SupervisedChild; filter: StatusFilter }) {
  const t = useTranslations('parent.vaccines');
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const { data: vaccines, isLoading } = useChildVaccinations(child.id);

  const all     = vaccines ?? [];
  const done    = all.filter((v) => v.status === 'DONE').length;
  const overdue = all.filter((v) => v.is_overdue).length;
  const shown   = filter === 'ALL' ? all : all.filter((v) => v.status === filter);

  function handleCertificate(e: React.MouseEvent) {
    e.stopPropagation();
    if (all.length === 0) return;
    const ok = printVaccinationCertificate(child, all);
    if (!ok) toast.warn('Please allow pop-ups to print the certificate.');
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: overdue > 0 ? 'color-mix(in srgb, var(--danger) 35%, var(--border))' : 'var(--border)' }}>
      {/* Header — the whole row toggles; the name area is the keyboard-accessible toggle */}
      <div
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-[var(--bg-sand)] cursor-pointer"
        style={{ backgroundColor: 'var(--bg-elev)' }}
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          className="flex items-center gap-3 min-w-0 text-left"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'color-mix(in srgb, var(--ink) 8%, var(--bg-sand))' }}>
            <Syringe size={16} style={{ color: 'var(--ink)' }} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{child.full_name}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {child.age_display}
              {!isLoading && <> · <span style={{ color: overdue > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{t('done', { done: done, length: all.length })}</span></>}
              {overdue > 0 && <span className="ml-1 font-bold" style={{ color: 'var(--danger)' }}>{t('overdue', { overdue: overdue })}</span>}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCertificate}
            disabled={isLoading || all.length === 0}
            title={t('printVaccinationCertificate')}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors hover:opacity-70 disabled:opacity-40"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            <Printer size={12} aria-hidden="true" />{' '}{t('certificate')}</button>
          <Link
            href={`/parent/children/${child.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs px-2 py-1 rounded-lg transition-colors hover:opacity-70"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >{t('details')}</Link>
          {open
            ? <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
            : <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </div>

      {/* Expanded vaccine list */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {isLoading ? (
            <div className="p-4 flex flex-col gap-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
          ) : shown.length === 0 ? (
            <div className="px-4 py-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
              {filter === 'ALL' ? t('noVaccinationRecordsYet') : t(`empty.${filter}`)}
            </div>
          ) : (
            <div>
              {shown.map((rec) => {
                const status = rec.status in STATUS_META ? (rec.status as keyof typeof STATUS_META) : 'SCHEDULED';
                const meta = STATUS_META[status];
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
                          <span className="ml-2 text-xs font-bold" style={{ color: 'var(--danger)' }}>{t('overdue2')}</span>
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
                      {t(`status.${status}`)}
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
  const t = useTranslations('parent.vaccines');
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const { data, isLoading } = useMyChildren();
  const children = data?.items ?? [];

  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto w-full">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>{t('vaccinationCard')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('tapAChildTo')}</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
        {TABS.map(({ key, icon, color }) => (
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
            {t(`status.${key}`)}
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
          title={t('noChildrenLinked')}
          description={t('yourChildrenSVaccination')}
          action={{ label: t('goToMyChildren'), href: '/parent' }}
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
