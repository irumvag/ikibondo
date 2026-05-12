'use client';

import Link from 'next/link';
import {
  Baby, Syringe, RefreshCw, Stethoscope, AlertTriangle,
  CalendarDays, Activity, MessageSquare, ClipboardCheck, QrCode,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
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
  { href: '/chw/scan',         icon: QrCode,          label: 'Scan QR',           desc: 'Scan a child\'s QR card for instant lookup.' },
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

      {/* ── Scan QR shortcut ── */}
      <Link
        href="/chw/scan"
        className="flex items-center gap-4 rounded-2xl p-4 transition-all hover:opacity-90 active:scale-[0.98]"
        style={{ backgroundColor: 'var(--ink)', color: 'var(--bg)' }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
          <QrCode size={20} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Scan child QR card</p>
          <p className="text-xs mt-0.5" style={{ opacity: 0.7 }}>Open camera to look up a child instantly</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.6 }}>
          <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </Link>

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
        <Alert variant="danger" title={`${highRiskCount} high-risk child${highRiskCount !== 1 ? 'ren' : ''} need attention today`}>
          <Link href="/chw/today" className="underline font-medium">
            View today's priority visit plan →
          </Link>
        </Alert>
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
              className="flex items-start gap-3.5 p-4 rounded-xl border transition-all hover:bg-[var(--bg-sand)] hover:shadow-[var(--shadow-sm)]"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
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
        <Alert variant="warn" title={`${pending.length} record${pending.length !== 1 ? 's' : ''} waiting to sync`}>
          <Link href="/chw/sync" className="underline font-medium">
            Tap to upload now →
          </Link>
        </Alert>
      )}
    </div>
  );
}
