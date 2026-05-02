'use client';

import { Baby, ClipboardList, AlertTriangle, Syringe } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { KPICard } from '@/components/ui/KPICard';
import { useCampChildren, useHighRiskRecords, useAdminCamps } from '@/lib/api/queries';
import { getCampStats } from '@/lib/api/admin';
import { useQuery } from '@tanstack/react-query';

export default function NurseDashboard() {
  const user = useAuthStore((s) => s.user);
  const campId = user?.camp ?? null;

  const { data: children, isLoading: childrenLoading } = useCampChildren(campId ?? undefined);
  const { data: highRisk, isLoading: riskLoading }     = useHighRiskRecords(undefined, 1);

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

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
    </div>
  );
}
