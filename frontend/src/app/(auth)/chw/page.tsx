'use client';

import { useTranslations } from 'next-intl';
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

// Action names and descriptions: messages/en.json chw.home.actions.<msgKey>
const QUICK_ACTIONS = [
  { href: '/chw/today',        icon: CalendarDays,    msgKey: 'todaysPlan' },
  { href: '/chw/visit',        icon: Stethoscope,     msgKey: 'logAVisit' },
  { href: '/chw/records',      icon: Activity,        msgKey: 'healthRecords' },
  { href: '/chw/vaccines',     icon: Syringe,         msgKey: 'vaccineQueue' },
  { href: '/chw/consultations',icon: MessageSquare,   msgKey: 'askANurse' },
  { href: '/chw/requests',     icon: ClipboardCheck,  msgKey: 'visitRequests' },
  { href: '/chw/scan',         icon: QrCode,          msgKey: 'scanQr' },
] as const;

export default function CHWDashboard() {
  const t = useTranslations('chw.home');
  const user    = useAuthStore((s) => s.user);
  const pending = useSyncStore((s) => s.pending);

  const { data: families = [], isLoading: famLoading } = useQuery({
    queryKey: ['chw-families'],
    queryFn: listCHWFamilies,
    staleTime: 5 * 60_000,
  });

  const { data: vaccines, isLoading: vaxLoading } = useVaccinationQueue(1);

  // Warm the records cache for the Records tab; the result isn't shown here.
  useQuery({
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
        >{t('welcomeBack', { name: user?.full_name?.split(' ')[0] ?? 'CHW' })}
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
          <p className="text-sm font-semibold">{t('scanChildQrCard')}</p>
          <p className="text-xs mt-0.5" style={{ opacity: 0.7 }}>{t('openCameraToLook')}</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.6 }}>
          <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </Link>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard
          label={t('families')}
          value={famLoading ? '—' : families.length.toString()}
          icon={<Baby size={18} />}
          subtext={t('childrenTotal', { count: totalChildren })}
          isLoading={famLoading}
        />
        <KPICard
          label={t('highRisk')}
          value={famLoading ? '—' : highRiskCount.toString()}
          icon={<AlertTriangle size={18} />}
          variant={highRiskCount > 0 ? 'danger' : 'default'}
          subtext={t('childrenNeedingUrgentCare')}
          isLoading={famLoading}
        />
        <KPICard
          label={t('vaccinesDue')}
          value={vaxLoading ? '—' : (vaccines?.count ?? 0).toString()}
          icon={<Syringe size={18} />}
          variant={(vaccines?.count ?? 0) > 0 ? 'warn' : 'default'}
          subtext={t('childrenAffected', { count: overdueVaxKids })}
          isLoading={vaxLoading}
        />
        <KPICard
          label={t('unsynced')}
          value={pending.length.toString()}
          icon={<RefreshCw size={18} />}
          variant={pending.length > 0 ? 'warn' : 'default'}
          subtext={pending.length === 0 ? t('allRecordsSynced') : t('tapSyncToUpload')}
        />
      </div>

      {/* Alert banner — high risk children */}
      {highRiskCount > 0 && (
        <Alert variant="danger" title={t('highRiskNeedAttention', { count: highRiskCount })}>
          <Link href="/chw/today" className="underline font-medium">{t('viewTodaySPriority')}</Link>
        </Alert>
      )}

      {/* Quick actions */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>{t('quickActions')}</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {QUICK_ACTIONS.map(({ href, icon: Icon, msgKey }) => (
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
                <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{t(`actions.${msgKey}.label`)}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t(`actions.${msgKey}.desc`)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Sync prompt */}
      {pending.length > 0 && (
        <Alert variant="warn" title={t('recordsWaiting', { count: pending.length })}>
          <Link href="/chw/sync" className="underline font-medium">{t('tapToUploadNow')}</Link>
        </Alert>
      )}
    </div>
  );
}
