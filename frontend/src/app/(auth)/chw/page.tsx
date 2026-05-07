'use client';

import Link from 'next/link';
import {
  Baby, Syringe, RefreshCw, Stethoscope, AlertTriangle,
  CalendarDays, Activity, MessageSquare, ClipboardCheck,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { KPICard } from '@/components/ui/KPICard';
import { useVaccinationQueue } from '@/lib/api/queries';
import { useSyncStore } from '@/store/syncStore';
import { listCHWFamilies } from '@/lib/api/chw';
import { listHealthRecords } from '@/lib/api/nurse';

const QUICK_ACTIONS = [
  { href: '/chw/today',        icon: CalendarDays,    label: "Today's plan",      desc: 'Family visit schedule for today.' },
  { href: '/chw/visit',        icon: Stethoscope,     label: 'Log a visit',       desc: 'Record measurements for a child.' },
  { href: '/chw/records',      icon: Activity,        label: 'Health records',    desc: 'View & edit your recorded visits.' },
  { href: '/chw/vaccines',     icon: Syringe,         label: 'Vaccine queue',     desc: 'Administer scheduled doses.' },
  { href: '/chw/consultations',icon: MessageSquare,   label: 'Ask a nurse',       desc: 'Open or continue a consultation.' },
  { href: '/chw/requests',     icon: ClipboardCheck,  label: 'Visit requests',    desc: 'Requests from parents in your caseload.' },
];

export default function CHWDashboard() {
  const user    = useAuthStore((s) => s.user);
  const pending = useSyncStore((s) => s.pending);

  const { data: families = [], isLoading: famLoading } = useQuery({
    queryKey: ['chw-families'],
    queryFn: listCHWFamilies,
    staleTime: 5 * 60_000,
  });

  const { data: vaccines, isLoading: vaxLoading } = useVaccinationQueue(1);

  const { data: records } = useQuery({
    queryKey: ['chw-records', 1, 'ALL'],
    queryFn: () => listHealthRecords({ page: 1, page_size: 1 }),
    staleTime: 60_000,
  });

  const totalChildren  = families.reduce((s, f) => s + f.children.length, 0);
  const highRiskCount  = families.flatMap((f) => f.children).filter((c) => c.risk_level === 'HIGH').length;
  const overdueVaxKids = families.flatMap((f) => f.children).filter((c) => c.overdue_vaccines > 0).length;

  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto w-full">
      {/* Greeting */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Welcome back, {user?.full_name?.split(' ')[0] ?? 'CHW'}
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {user?.camp_name ?? '—'} · {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard
          label="Families"
          value={famLoading ? '—' : families.length.toString()}
          icon={<Baby size={18} />}
          subtext={`${totalChildren} children total`}
          isLoading={famLoading}
        />
        <KPICard
          label="High risk"
          value={famLoading ? '—' : highRiskCount.toString()}
          icon={<AlertTriangle size={18} />}
          variant={highRiskCount > 0 ? 'danger' : 'default'}
          subtext="Children needing urgent care"
          isLoading={famLoading}
        />
        <KPICard
          label="Vaccines due"
          value={vaxLoading ? '—' : (vaccines?.count ?? 0).toString()}
          icon={<Syringe size={18} />}
          variant={(vaccines?.count ?? 0) > 0 ? 'warn' : 'default'}
          subtext={`${overdueVaxKids} children affected`}
          isLoading={vaxLoading}
        />
        <KPICard
          label="Unsynced"
          value={pending.length.toString()}
          icon={<RefreshCw size={18} />}
          variant={pending.length > 0 ? 'warn' : 'default'}
          subtext={pending.length === 0 ? 'All records synced' : 'Tap Sync to upload'}
        />
      </div>

      {/* Alert banner — high risk children */}
      {highRiskCount > 0 && (
        <Link
          href="/chw/today"
          className="flex items-center gap-3 rounded-xl px-4 py-3.5 transition-opacity hover:opacity-80"
          style={{ background: '#fef2f2', border: '1px solid var(--danger)' }}
        >
          <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>
              {highRiskCount} high-risk child{highRiskCount !== 1 ? 'ren' : ''} need attention today
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--danger)', opacity: 0.75 }}>
              Tap to view today's priority visit plan
            </p>
          </div>
          <span className="text-xs font-medium shrink-0" style={{ color: 'var(--danger)' }}>View →</span>
        </Link>
      )}

      {/* Quick actions */}
      <div>
        <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Quick actions
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {QUICK_ACTIONS.map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-start gap-3.5 p-4 rounded-xl border transition-colors hover:bg-[var(--bg-sand)]"
              style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--primary)' }}
              >
                <Icon size={18} />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Sync prompt */}
      {pending.length > 0 && (
        <Link
          href="/chw/sync"
          className="flex items-center gap-3 rounded-xl px-4 py-3.5 transition-opacity hover:opacity-80"
          style={{ background: 'color-mix(in srgb, var(--warn) 10%, transparent)', border: '1px solid var(--warn)' }}
        >
          <RefreshCw size={16} style={{ color: 'var(--warn)', flexShrink: 0 }} />
          <p className="text-sm font-medium flex-1" style={{ color: 'var(--ink)' }}>
            {pending.length} record{pending.length !== 1 ? 's' : ''} waiting to sync — tap to upload
          </p>
          <span className="text-xs font-medium shrink-0" style={{ color: 'var(--warn)' }}>Sync →</span>
        </Link>
      )}
    </div>
  );
}
