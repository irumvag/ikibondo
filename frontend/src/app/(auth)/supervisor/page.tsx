'use client';

import { useState, useEffect } from 'react';
import { Baby, AlertTriangle, Activity, Syringe, Users, Eye } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { KPICard } from '@/components/ui/KPICard';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { useAdminZones, useZoneStats } from '@/lib/api/queries';


export default function SupervisorDashboard() {
  const user = useAuthStore((s) => s.user);
  const campId = user?.camp ?? null;

  const { data: zones, isLoading: zonesLoading } = useAdminZones(campId);
  const [selectedZone, setSelectedZone] = useState<string>('');

  // Default to first zone once loaded
  const activeZoneId = selectedZone || zones?.[0]?.id || null;

  const { data: stats, isLoading: statsLoading } = useZoneStats(campId, activeZoneId);

  const riskTotal =
    (stats?.risk_distribution.LOW ?? 0) +
    (stats?.risk_distribution.MEDIUM ?? 0) +
    (stats?.risk_distribution.HIGH ?? 0) +
    (stats?.risk_distribution.UNKNOWN ?? 0);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            Zone Overview
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Welcome back, {user?.full_name ?? 'Supervisor'} &middot; {user?.camp_name ?? '—'}
          </p>
        </div>
        {zonesLoading ? (
          <Skeleton className="h-10 w-48 rounded-xl" />
        ) : zones && zones.length > 0 ? (
          <Select
            value={activeZoneId ?? ''}
            onChange={(e) => setSelectedZone(e.target.value)}
            aria-label="Select zone"
            options={zones.map((z) => ({ value: z.id, label: `${z.name} (${z.code})` }))}
            className="w-48"
          />
        ) : null}
      </div>

      {/* Alert zone */}
      {stats && stats.children_never_visited > 0 && (
        <Alert variant="warn" title={`${stats.children_never_visited} child${stats.children_never_visited !== 1 ? 'ren have' : ' has'} never been visited`}>
          These children have had no CHW home visit recorded. Assign a CHW or schedule a visit.
        </Alert>
      )}

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Children in zone"
          value={stats ? stats.total_children.toLocaleString() : '—'}
          icon={<Baby size={18} />}
          isLoading={statsLoading}
        />
        <KPICard
          label="HIGH-risk alerts"
          value={stats ? stats.risk_distribution.HIGH.toString() : '—'}
          icon={<AlertTriangle size={18} />}
          variant={stats && stats.risk_distribution.HIGH > 0 ? 'danger' : 'default'}
          subtext="Needs follow-up"
          isLoading={statsLoading}
        />
        <KPICard
          label="Active CHWs"
          value={stats ? stats.active_chws.toString() : '—'}
          icon={<Activity size={18} />}
          variant="success"
          subtext={stats ? `${stats.visits_this_week} visits this week` : undefined}
          isLoading={statsLoading}
        />
        <KPICard
          label="Vaccination coverage"
          value={stats ? `${Math.round(stats.vaccination_coverage_pct)}%` : '—'}
          icon={<Syringe size={18} />}
          subtext="Zone average"
          isLoading={statsLoading}
        />
      </div>

      {/* Two-column detail */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Risk distribution */}
        <div
          className="rounded-2xl border p-5 flex flex-col gap-4"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
        >
          <h3 className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
            Risk distribution
          </h3>
          {statsLoading ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 rounded-lg" />)}
            </div>
          ) : stats ? (
            <div className="flex flex-col gap-3">
              {(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'] as const).map((level) => {
                const count = stats.risk_distribution[level] ?? 0;
                const pct = riskTotal > 0 ? (count / riskTotal) * 100 : 0;
                return (
                  <div key={level} className="flex items-center gap-3">
                    <Badge
                      variant={level === 'HIGH' ? 'danger' : level === 'MEDIUM' ? 'warn' : level === 'LOW' ? 'success' : 'default'}
                      className="w-20 justify-center"
                    >
                      {level}
                    </Badge>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-sand)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor:
                            level === 'HIGH' ? 'var(--danger, #ef4444)'
                            : level === 'MEDIUM' ? 'var(--warn, #f59e0b)'
                            : level === 'LOW' ? 'var(--success, #22c55e)'
                            : 'var(--text-muted)',
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold w-10 text-right" style={{ color: 'var(--ink)' }}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No data — select a zone above.</p>
          )}
        </div>

        {/* CHW summary */}
        <div
          className="rounded-2xl border p-5 flex flex-col gap-4"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
        >
          <h3 className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
            Workforce snapshot
          </h3>
          {statsLoading ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 rounded-lg" />)}
            </div>
          ) : stats ? (
            <div className="flex flex-col gap-3">
              {[
                { icon: Users,   label: 'Active CHWs',          value: stats.active_chws,             variant: 'success' as const },
                { icon: Users,   label: 'Inactive CHWs',        value: stats.inactive_chws,           variant: stats.inactive_chws > 0 ? 'warn' as const : 'default' as const },
                { icon: Eye,     label: 'Visits this week',     value: stats.visits_this_week,        variant: 'default' as const },
                { icon: Baby,    label: 'Never visited',        value: stats.children_never_visited,  variant: stats.children_never_visited > 0 ? 'danger' as const : 'default' as const },
              ].map(({ icon: Icon, label, value, variant }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <Icon size={15} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
                  </div>
                  <Badge variant={variant}>{value}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No data — select a zone above.</p>
          )}
        </div>
      </div>
    </div>
  );
}
