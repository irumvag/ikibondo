'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useHighRiskRecords, useAdminZones } from '@/lib/api/queries';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import type { HealthRecord } from '@/lib/api/supervisor';

const COLUMNS = [
  { key: 'child_name',     header: 'Child',       width: '160px' },
  {
    key: 'measurement_date', header: 'Date', width: '120px',
    render: (v: unknown) => new Date(v as string).toLocaleDateString(),
  },
  { key: 'zone_name', header: 'Zone', width: '130px', render: (v: unknown) => (v as string) || '—' },
  {
    key: 'weight_kg', header: 'Weight (kg)', width: '110px',
    render: (v: unknown) => (v != null ? `${parseFloat(v as string).toFixed(1)} kg` : '—'),
  },
  {
    key: 'muac_cm', header: 'MUAC (cm)', width: '110px',
    render: (v: unknown) => (v != null ? `${parseFloat(v as string).toFixed(1)} cm` : '—'),
  },
  {
    key: 'nutrition_status_display', header: 'Status', width: '100px',
    render: (_: unknown, row: unknown) => {
      const r = row as HealthRecord;
      const variant = r.nutrition_status === 'SAM' ? 'danger' : r.nutrition_status === 'MAM' ? 'warn' : 'success';
      return <Badge variant={variant}>{r.nutrition_status_display}</Badge>;
    },
  },
  {
    key: 'risk_factors', header: 'Key risk factors', width: '220px',
    render: (v: unknown) => {
      const factors = v as string[];
      if (!factors?.length) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
      return (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {factors.slice(0, 3).join(', ')}
        </span>
      );
    },
  },
  {
    key: 'ml_confidence', header: 'Confidence', width: '100px',
    render: (v: unknown) => (v != null ? `${Math.round(parseFloat(v as string) * 100)}%` : '—'),
  },
];

export default function AlertsPage() {
  const user = useAuthStore((s) => s.user);
  const campId = user?.camp ?? null;
  const [zoneFilter, setZoneFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: zones } = useAdminZones(campId);
  const { data, isLoading } = useHighRiskRecords(zoneFilter || undefined, page);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            High-Risk Alerts
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Children flagged HIGH by the ML model — needs immediate follow-up.
          </p>
        </div>

        {/* Zone filter */}
        <select
          value={zoneFilter}
          onChange={(e) => { setZoneFilter(e.target.value); setPage(1); }}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: 'var(--bg-elev)',
            color: 'var(--ink)',
          }}
          aria-label="Filter by zone"
        >
          <option value="">All zones</option>
          {zones?.map((z) => (
            <option key={z.id} value={z.id}>{z.name}</option>
          ))}
        </select>
      </div>

      {/* Alert count banner */}
      {!isLoading && (data?.count ?? 0) > 0 && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium"
          style={{ backgroundColor: 'var(--high-bg, #fef2f2)', color: 'var(--danger, #ef4444)' }}
        >
          <AlertTriangle size={16} aria-hidden="true" />
          {data!.count} HIGH-risk {data!.count === 1 ? 'record' : 'records'} require follow-up.
        </div>
      )}

      <DataTable
        columns={COLUMNS as Parameters<typeof DataTable>[0]['columns']}
        data={(data?.items ?? []) as Record<string, unknown>[]}
        keyField="id"
        isLoading={isLoading}
        emptyTitle="No HIGH-risk records"
        emptyDescription="No children are currently flagged as HIGH risk in this zone."
        pagination={
          data && data.count > 20
            ? { page, pageSize: 20, total: data.count, onPageChange: setPage }
            : undefined
        }
      />
    </div>
  );
}
