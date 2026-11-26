'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useHighRiskRecords, useAdminZones } from '@/lib/api/queries';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import type { HealthRecord } from '@/lib/api/supervisor';

type ColumnsT = ReturnType<typeof useTranslations<'supervisor.alerts'>>;

const COLUMNS = (t: ColumnsT) => [
  { key: 'child_name',     header: t('colChild'),       width: '160px' },
  {
    key: 'measurement_date', header: t('colDate'), width: '120px',
    render: (v: unknown) => new Date(v as string).toLocaleDateString(),
  },
  { key: 'zone_name', header: t('colZone'), width: '130px', render: (v: unknown) => (v as string) || '—' },
  {
    key: 'weight_kg', header: t('colWeightKg'), width: '110px',
    render: (v: unknown) => (v != null ? `${parseFloat(v as string).toFixed(1)} kg` : '—'),
  },
  {
    key: 'muac_cm', header: t('colMuacCm'), width: '110px',
    render: (v: unknown) => (v != null ? `${parseFloat(v as string).toFixed(1)} cm` : '—'),
  },
  {
    key: 'nutrition_status_display', header: t('colStatus'), width: '100px',
    render: (_: unknown, row: unknown) => {
      const r = row as HealthRecord;
      const variant = r.nutrition_status === 'SAM' ? 'danger' : r.nutrition_status === 'MAM' ? 'warn' : 'success';
      return <Badge variant={variant}>{r.nutrition_status_display}</Badge>;
    },
  },
  {
    key: 'risk_factors', header: t('colKeyRiskFactors'), width: '220px',
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
    key: 'ml_confidence', header: t('colConfidence'), width: '100px',
    render: (v: unknown) => (v != null ? `${Math.round(parseFloat(v as string) * 100)}%` : '—'),
  },
];

export default function AlertsPage() {
  const t = useTranslations('supervisor.alerts');
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
          >{t('highRiskAlerts')}</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('childrenFlaggedHighBy')}</p>
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
          aria-label={t('filterByZone')}
        >
          <option value="">{t('allZones')}</option>
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
          <AlertTriangle size={16} aria-hidden="true" />{t('highRiskRecords', { count: data!.count })}</div>
      )}

      <DataTable
        columns={COLUMNS(t) as Parameters<typeof DataTable>[0]['columns']}
        data={(data?.items ?? []) }
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

