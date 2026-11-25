'use client';

import { useState } from 'react';
import { Download, FileBarChart } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAdminCamps, useAdminZones, useZoneStats } from '@/lib/api/queries';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import type { ZoneStats } from '@/lib/api/supervisor';

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCSV(zoneStats: (ZoneStats | null)[], zones: { name: string; code: string }[]) {
  const rows = [
    ['Zone', 'Code', 'Children', 'HIGH risk', 'MEDIUM risk', 'LOW risk', 'Active CHWs', 'Visits (week)', 'Vax coverage %'],
    ...zones.map((z, i) => {
      const s = zoneStats[i];
      if (!s) return [z.name, z.code, '—', '—', '—', '—', '—', '—', '—'];
      return [
        z.name, z.code,
        s.total_children,
        s.risk_distribution.HIGH,
        s.risk_distribution.MEDIUM,
        s.risk_distribution.LOW,
        s.active_chws,
        s.visits_this_week,
        `${Math.round(s.vaccination_coverage_pct)}%`,
      ];
    }),
  ];
  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `ikibondo_zone_report_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Zone report row ───────────────────────────────────────────────────────────

function ZoneReportRow({
  campId, zone,
}: {
  campId: string;
  zone: { id: string; name: string; code: string };
}) {
  const { data: stats, isLoading } = useZoneStats(campId, zone.id);

  if (isLoading) return <Skeleton className="h-16 rounded-xl" />;

  const total = stats
    ? stats.risk_distribution.LOW + stats.risk_distribution.MEDIUM + stats.risk_distribution.HIGH + stats.risk_distribution.UNKNOWN
    : 0;

  return (
    <div
      className="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-4"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
    >
      <div className="sm:w-44 shrink-0">
        <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{zone.name}</p>
        <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{zone.code}</p>
      </div>

      {stats ? (
        <div className="flex flex-wrap gap-3 flex-1">
          <Chip label="Children" value={stats.total_children} />
          <Chip label="HIGH risk" value={stats.risk_distribution.HIGH} variant="danger" />
          <Chip label="MEDIUM" value={stats.risk_distribution.MEDIUM} variant="warn" />
          <Chip label="Active CHWs" value={stats.active_chws} variant="success" />
          <Chip label="Visits/wk" value={stats.visits_this_week} />
          <Chip label="Vax coverage" value={`${Math.round(stats.vaccination_coverage_pct)}%`} />
          <Chip label="Never visited" value={stats.children_never_visited} variant={stats.children_never_visited > 0 ? 'warn' : 'default'} />
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No data available.</p>
      )}

      {/* Mini risk bar */}
      {stats && total > 0 && (
        <div className="sm:w-32 shrink-0 hidden lg:flex flex-col gap-1">
          <div className="flex h-3 rounded-full overflow-hidden gap-px">
            {(['HIGH', 'MEDIUM', 'LOW'] as const).map((level) => {
              const pct = (stats.risk_distribution[level] / total) * 100;
              return pct > 0 ? (
                <div
                  key={level}
                  style={{
                    width: `${pct}%`,
                    backgroundColor:
                      level === 'HIGH' ? 'var(--danger, #ef4444)'
                      : level === 'MEDIUM' ? 'var(--warn, #f59e0b)'
                      : 'var(--success, #22c55e)',
                  }}
                />
              ) : null;
            })}
          </div>
          <p className="text-xs text-right" style={{ color: 'var(--text-muted)' }}>risk split</p>
        </div>
      )}
    </div>
  );
}

function Chip({ label, value, variant = 'default' }: {
  label: string;
  value: string | number;
  variant?: 'default' | 'danger' | 'warn' | 'success';
}) {
  return (
    <div className="flex flex-col items-center px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--bg-sand)' }}>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <Badge variant={variant} className="mt-0.5">{value}</Badge>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const user = useAuthStore((s) => s.user);
  const campId = user?.camp ?? null;

  const { data: camps, isLoading: campsLoading } = useAdminCamps();
  const { data: zones, isLoading: zonesLoading } = useAdminZones(campId);

  // For CSV: collect stats from each zone (they're already loaded by ZoneReportRow)
  const [exporting, setExporting] = useState(false);

  const camp = camps?.find((c) => c.id === campId);

  const handleExport = async () => {
    if (!zones || !campId) return;
    setExporting(true);
    try {
      const { getZoneStats } = await import('@/lib/api/supervisor');
      const allStats = await Promise.all(
        zones.map((z) => getZoneStats(campId, z.id).catch(() => null))
      );
      exportCSV(allStats, zones);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            Reports
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {camp ? `${camp.name} · ${camp.code}` : user?.camp_name ?? 'Camp summary'}
            {zones ? ` · ${zones.length} zones` : ''}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={handleExport}
          loading={exporting}
          disabled={!zones?.length}
        >
          <Download size={15} className="mr-2" aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      {/* Camp header card */}
      {campsLoading ? (
        <Skeleton className="h-20 rounded-2xl" />
      ) : camp ? (
        <div
          className="rounded-2xl border p-5 flex flex-wrap gap-6"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
        >
          <div>
            <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Camp</p>
            <p className="font-bold text-lg" style={{ color: 'var(--ink)', fontFamily: 'var(--font-fraunces)' }}>{camp.name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Code</p>
            <p className="font-mono font-semibold" style={{ color: 'var(--ink)' }}>{camp.code}</p>
          </div>
          {camp.district && (
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>District</p>
              <p className="font-semibold" style={{ color: 'var(--ink)' }}>{camp.district}</p>
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Children</p>
            <p className="font-semibold" style={{ color: 'var(--ink)' }}>{camp.active_children_count.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Status</p>
            <Badge variant={camp.status === 'ACTIVE' ? 'success' : 'default'}>{camp.status}</Badge>
          </div>
        </div>
      ) : null}

      {/* Zone breakdown */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <FileBarChart size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <h3 className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>Per-zone breakdown</h3>
        </div>
        {zonesLoading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : zones && zones.length > 0 ? (
          <div className="flex flex-col gap-3">
            {zones.map((zone) => (
              <ZoneReportRow key={zone.id} campId={campId!} zone={zone} />
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No zones configured for this camp.
          </p>
        )}
      </div>

      {/* Print note */}
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Use your browser&apos;s print function (Ctrl+P) to print this report, or click Export CSV for a spreadsheet.
      </p>
    </div>
  );
}
