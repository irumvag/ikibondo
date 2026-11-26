'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Baby, ClipboardList, AlertTriangle, Syringe, UserCheck, UserPlus, Users, QrCode } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { KPICard } from '@/components/ui/KPICard';
import { Alert } from '@/components/ui/Alert';
import { useCampChildren, useHighRiskRecords, usePendingApprovals } from '@/lib/api/queries';
import { getCampStats } from '@/lib/api/admin';
import { useQuery } from '@tanstack/react-query';

// Action names and descriptions: messages/en.json nurse.home.actions.<msgKey>
const QUICK_LINKS = [
  { href: '/nurse/register',  icon: UserPlus,  msgKey: 'admitNewborn' },
  { href: '/nurse/approvals', icon: UserCheck, msgKey: 'parentApprovals' },
  { href: '/nurse/children',  icon: Users,     msgKey: 'childrenInCamp' },
  { href: '/nurse/referrals', icon: ClipboardList, msgKey: 'referrals' },
  { href: '/nurse/scan',      icon: QrCode,        msgKey: 'scanQr' },
] as const;

export default function NurseDashboard() {
  const t = useTranslations('nurse.home');
  const user   = useAuthStore((s) => s.user);
  const campId = user?.camp ?? null;

  const { data: children, isLoading: childrenLoading } = useCampChildren(campId ?? undefined);
  const { data: highRisk, isLoading: riskLoading }     = useHighRiskRecords(undefined, 1);
  const { data: pending,  isLoading: pendingLoading }  = usePendingApprovals();

  const { data: campStats, isLoading: statsLoading } = useQuery({
    queryKey: ['camp-stats', campId],
    queryFn: () => getCampStats(campId!),
    enabled: !!campId,
    staleTime: 60_000,
    retry: 1,
  });

  const pendingCount  = pending?.length ?? 0;
  const highRiskCount = highRisk?.count ?? 0;
  const samCount      = campStats?.sam_count ?? 0;
  const mamCount      = campStats?.mam_count ?? 0;
  const coverage      = campStats?.vaccination_coverage_percent ?? 0;
  const coverageVariant = coverage >= 80 ? 'success' : coverage >= 60 ? 'warn' : 'danger';

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >{t('campOverview')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('welcomeBackName', { name: user?.full_name ?? t('nurse'), camp: user?.camp_name ?? '—' })}
        </p>
      </div>

      {/* ── Scan QR shortcut ── */}
      <Link
        href="/nurse/scan"
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

      {/* ── Alert zone ─────────────────────────────────────────────────── */}
      {(samCount > 0 || pendingCount > 0) && (
        <div className="flex flex-col gap-3">
          {samCount > 0 && (
            <Alert variant="danger" title={t('samChildren', { count: samCount })}>
              <Link href="/nurse/records?nutrition=SAM" className="underline font-medium">{t('viewSamCases')}</Link>
            </Alert>
          )}
          {pendingCount > 0 && (
            <Alert variant="warn" title={t('parentAccountsAwaiting', { count: pendingCount })}>
              <Link href="/nurse/approvals" className="underline font-medium">{t('reviewApprovals')}</Link>
            </Alert>
          )}
        </div>
      )}

      {/* ── KPI grid — 2-up on phones (matches CHW dashboard) ─────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Link href="/nurse/children" className="group">
          <KPICard
            label={t('childrenRegistered')}
            value={children ? children.count.toLocaleString() : '—'}
            icon={<Baby size={18} />}
            isLoading={childrenLoading}
          />
        </Link>
        <Link href="/nurse/records?nutrition=SAM" className="group">
          <KPICard
            label={t('samCases')}
            value={campStats ? samCount.toString() : '—'}
            icon={<ClipboardList size={18} />}
            variant={samCount > 0 ? 'danger' : 'default'}
            subtext={campStats ? t('mamCount', { count: mamCount }) : undefined}
            isLoading={statsLoading}
          />
        </Link>
        <Link href="/nurse/approvals" className="group">
          <KPICard
            label={t('pendingParentApprovals')}
            value={pendingLoading ? '—' : pendingCount.toString()}
            icon={<UserCheck size={18} />}
            variant={pendingCount > 0 ? 'warn' : 'default'}
            subtext={pendingCount > 0 ? t('needsReview') : t('allClear')}
            isLoading={pendingLoading}
          />
        </Link>
        <Link href="/nurse/records?risk=HIGH" className="group">
          <KPICard
            label={t('highRiskFlagged')}
            value={highRiskCount.toString()}
            icon={<AlertTriangle size={18} />}
            variant={highRiskCount > 0 ? 'danger' : 'default'}
            subtext={t('byMlModel')}
            isLoading={riskLoading}
          />
        </Link>
        <KPICard
          label={t('vaccinationCoverage')}
          value={campStats ? `${Math.round(coverage)}%` : '—'}
          icon={<Syringe size={18} />}
          variant={campStats ? coverageVariant : 'default'}
          subtext={t('campAverage')}
          isLoading={statsLoading}
        />
      </div>

      {/* ── Quick actions ─────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink)' }}>{t('quickActions')}</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {QUICK_LINKS.map(({ href, icon: Icon, msgKey }) => (
            <Link
              key={href}
              href={href}
              className="flex items-start gap-3.5 p-4 rounded-2xl border transition-all hover:bg-[var(--bg-sand)] hover:shadow-[var(--shadow-sm)]"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
              >
                <Icon size={18} aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{t(`actions.${msgKey}.label`)}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t(`actions.${msgKey}.desc`)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
