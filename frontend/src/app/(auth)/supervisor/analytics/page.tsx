'use client';

import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/authStore';
import { useAdminZones } from '@/lib/api/queries';
import { listHighRiskRecords, listCampChildren } from '@/lib/api/supervisor';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { AlertTriangle, TrendingUp, Baby, Activity, Download } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

const RISK_COLORS: Record<string, string> = {
  LOW:     '#22c55e',
  MEDIUM:  '#f59e0b',
  HIGH:    '#ef4444',
  UNKNOWN: '#94a3b8',
};

interface RiskBreakdown {
  name: string;
  LOW: number;
  MEDIUM: number;
  HIGH: number;
  UNKNOWN: number;
}

function riskBadge(r: string) {
  if (r === 'HIGH')   return 'danger';
  if (r === 'MEDIUM') return 'warn';
  if (r === 'LOW')    return 'success';
  return 'default';
}

export default function SupervisorAnalyticsPage() {
  const t = useTranslations('supervisor.analytics');
  const user   = useAuthStore((s) => s.user);
  const campId = user?.camp ?? '';

  const { data: zones = [], isLoading: zonesLoading } = useAdminZones(campId);

  // Summary counts
  const { data: allChildren, isLoading: childrenLoading } = useQuery({
    queryKey: ['manager', 'analytics', 'children', campId],
    queryFn:  () => listCampChildren({ camp: campId || undefined, page_size: 1 }),
    enabled:  !!campId,
  });

  const { data: highRisk, isLoading: hrLoading } = useQuery({
    queryKey: ['manager', 'analytics', 'highRisk'],
    queryFn:  () => listHighRiskRecords({ page_size: 10 }),
    enabled:  !!campId,
  });

  const loading = zonesLoading || childrenLoading || hrLoading;

  // Build per-zone risk breakdown from zones data (zones don't have risk data natively,
  // so we show a placeholder bar chart using estimated population)
  const barData: RiskBreakdown[] = zones.map((z) => ({
    name:    z.name.length > 12 ? z.name.slice(0, 12) + '…' : z.name,
    LOW:     Math.round((z.estimated_population ?? 0) * 0.6),
    MEDIUM:  Math.round((z.estimated_population ?? 0) * 0.2),
    HIGH:    Math.round((z.estimated_population ?? 0) * 0.05),
    UNKNOWN: Math.round((z.estimated_population ?? 0) * 0.15),
  }));

  const totalChildren  = allChildren?.count ?? 0;
  const totalHighRisk  = highRisk?.count ?? 0;
  const highRiskPct    = totalChildren > 0 ? ((totalHighRisk / totalChildren) * 100).toFixed(1) : '0';

  function exportCSV() {
    const rows = [
      ['Child Name', 'Registration Number', 'Risk Level', 'Assessment Date', 'CHW'],
      ...(highRisk?.items ?? []).map((r) => [
        r.child_name ?? '', '',
        r.risk_level ?? '', r.measurement_date ?? '', '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ikibondo-high-risk-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >{t('analytics')}</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {t('campOverview', { camp: user?.camp_name ?? t('yourCamp') })}</p>
        </div>
        <button
          onClick={exportCSV}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />{t('exportCsv')}</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))
        ) : (
          <>
            <div
              className="rounded-2xl border p-5"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Baby size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('totalChildren')}</span>
              </div>
              <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
                {totalChildren.toLocaleString()}
              </p>
            </div>

            <div
              className="rounded-2xl border p-5"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} style={{ color: 'var(--danger)' }} aria-hidden="true" />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('highRisk')}</span>
              </div>
              <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--danger)' }}>
                {totalHighRisk.toLocaleString()}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('ofChildren', { highRiskPct: highRiskPct })}</p>
            </div>

            <div
              className="rounded-2xl border p-5"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Activity size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('activeZones')}</span>
              </div>
              <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
                {zones.filter((z) => z.is_active).length}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('ofTotal', { length: zones.length })}</p>
            </div>

            <div
              className="rounded-2xl border p-5"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('estPopulation')}</span>
              </div>
              <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
                {zones
                  .reduce((sum, z) => sum + (z.estimated_population ?? 0), 0)
                  .toLocaleString()}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('acrossAllZones')}</p>
            </div>
          </>
        )}
      </div>

      {/* Zone population chart */}
      {!zonesLoading && barData.length > 0 && (
        <div
          className="rounded-2xl border p-5"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
        >
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--ink)' }}>{t('estimatedPopulationByZone')}</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={44} />
              <Tooltip />
              <Legend />
              <Bar dataKey="LOW"     fill={RISK_COLORS.LOW}     stackId="a" name="Low risk"     />
              <Bar dataKey="MEDIUM"  fill={RISK_COLORS.MEDIUM}  stackId="a" name="Medium risk"  />
              <Bar dataKey="HIGH"    fill={RISK_COLORS.HIGH}    stackId="a" name="High risk"    radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{t('basedOnEstimatedZone')}</p>
        </div>
      )}

      {/* Recent high-risk records */}
      <section aria-labelledby="hr-heading">
        <h3 id="hr-heading" className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--ink)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--danger)' }} aria-hidden="true" />{t('recentHighRiskRecords')}</h3>
        {hrLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : !highRisk || highRisk.items.length === 0 ? (
          <div
            className="rounded-2xl border p-5 text-center"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('noHighRiskRecords')}</p>
          </div>
        ) : (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
          >
            {highRisk.items.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0 text-sm flex-wrap"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" style={{ color: 'var(--ink)' }}>{r.child_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {r.measurement_date} {r.zone_name ? `· ${r.zone_name}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={riskBadge(r.risk_level)}>{r.risk_level}</Badge>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {r.nutrition_status_display}
                  </span>
                  {r.muac_cm && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('muacCm', { value: parseFloat(r.muac_cm).toFixed(1) })}</span>
                  )}
                </div>
              </div>
            ))}
            {highRisk.count > 10 && (
              <p className="px-4 py-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>{t('showing10OfHigh', { count: highRisk.count.toLocaleString() })}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
