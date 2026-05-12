'use client';

import Link from 'next/link';
import { Baby, ClipboardList, AlertTriangle, Syringe, UserCheck, UserPlus, Users } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { KPICard } from '@/components/ui/KPICard';
import { useCampChildren, useHighRiskRecords, usePendingApprovals } from '@/lib/api/queries';
import { getCampStats } from '@/lib/api/admin';
import { useQuery } from '@tanstack/react-query';

const QUICK_LINKS = [
  { href: '/nurse/register',  icon: UserPlus,   label: 'Admit newborn',       desc: 'Register a newborn and link to a parent account.' },
  { href: '/nurse/approvals', icon: UserCheck,  label: 'Parent approvals',    desc: 'Review and approve pending parent accounts.' },
  { href: '/nurse/children',  icon: Users,      label: 'Children in camp',    desc: 'Browse all registered children in your camp.' },
];

export default function NurseDashboard() {
  const user = useAuthStore((s) => s.user);
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

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Camp Overview
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Welcome back, {user?.full_name ?? 'Nurse'} &middot; {user?.camp_name ?? '—'}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          label="Children registered"
          value={children ? children.count.toLocaleString() : '—'}
          icon={<Baby size={18} />}
          isLoading={childrenLoading}
        />
        <KPICard
          label="SAM cases"
          value={campStats ? campStats.sam_count.toString() : '—'}
          icon={<ClipboardList size={18} />}
          variant={campStats && campStats.sam_count > 0 ? 'danger' : 'default'}
          subtext={campStats ? `${campStats.mam_count} MAM` : undefined}
          isLoading={statsLoading}
        />
        <KPICard
          label="Pending parent approvals"
          value={pendingLoading ? '—' : (pending?.length ?? 0).toString()}
          icon={<UserCheck size={18} />}
          variant={(pending?.length ?? 0) > 0 ? 'warn' : 'default'}
          subtext={(pending?.length ?? 0) > 0 ? 'Needs review' : 'All clear'}
          isLoading={pendingLoading}
        />
        <KPICard
          label="HIGH-risk flagged"
          value={highRisk ? highRisk.count.toString() : '—'}
          icon={<AlertTriangle size={18} />}
          variant={highRisk && highRisk.count > 0 ? 'danger' : 'default'}
          subtext="By ML model"
          isLoading={riskLoading}
        />
        <KPICard
          label="Vaccination coverage"
          value={campStats ? `${Math.round(campStats.vaccination_coverage_percent)}%` : '—'}
          icon={<Syringe size={18} />}
          subtext="Camp average"
          isLoading={statsLoading}
        />
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="text-base font-semibold mb-3" style={{ color: 'var(--ink)' }}>Quick actions</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          {QUICK_LINKS.map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-start gap-4 p-5 rounded-2xl border transition-colors hover:bg-[var(--bg-sand)]"
              style={{ borderColor: 'var(--border)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
              >
                <Icon size={20} aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
