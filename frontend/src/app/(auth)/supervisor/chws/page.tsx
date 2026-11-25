'use client';

import { useState } from 'react';
import { Activity, Phone } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAdminZones, useCHWActivity } from '@/lib/api/queries';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import type { CHWActivity } from '@/lib/api/supervisor';

const COLUMNS = [
  { key: 'full_name', header: 'CHW Name', width: '180px' },
  {
    key: 'phone_number', header: 'Phone', width: '140px',
    render: (v: unknown) =>
      v ? (
        <span className="flex items-center gap-1 text-sm">
          <Phone size={12} aria-hidden="true" />
          {v as string}
        </span>
      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>,
  },
  {
    key: 'status', header: 'Visit activity', width: '130px',
    render: (v: unknown) => (
      <Badge variant={(v as string) === 'active' ? 'success' : 'warn'}>
        {(v as string) === 'active' ? 'Active this week' : 'No recent visits'}
      </Badge>
    ),
  },
  {
    key: 'visits_7d', header: 'Visits (7d)', width: '110px',
    render: (v: unknown) => (
      <span
        className="font-semibold"
        style={{ color: (v as number) > 0 ? 'var(--ink)' : 'var(--text-muted)' }}
      >
        {v as number}
      </span>
    ),
  },
  {
    key: 'visits_30d', header: 'Visits (30d)', width: '110px',
    render: (v: unknown) => v as number,
  },
  {
    key: 'last_visit_at', header: 'Last visit', width: '140px',
    render: (v: unknown) =>
      v ? new Date(v as string).toLocaleDateString() : (
        <Badge variant="warn">Never</Badge>
      ),
  },
];

export default function CHWsPage() {
  const user = useAuthStore((s) => s.user);
  const campId = user?.camp ?? null;

  const { data: zones, isLoading: zonesLoading } = useAdminZones(campId);
  const [selectedZone, setSelectedZone] = useState('');

  const activeZoneId = selectedZone || zones?.[0]?.id || null;
  const { data: chws, isLoading: chwsLoading } = useCHWActivity(campId, activeZoneId);

  const activeCount  = chws?.filter((c: CHWActivity) => c.status === 'active').length  ?? 0;
  const inactiveCount = chws?.filter((c: CHWActivity) => c.status === 'inactive').length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            CHW Activity
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {chws ? `${activeCount} active · ${inactiveCount} inactive` : 'Tracking field worker visits by zone.'}
          </p>
        </div>

        {zonesLoading ? (
          <Skeleton className="h-8 w-40 rounded-lg" />
        ) : (
          <select
            value={activeZoneId ?? ''}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border outline-none"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--bg-elev)',
              color: 'var(--ink)',
            }}
            aria-label="Select zone"
          >
            {zones?.map((z) => (
              <option key={z.id} value={z.id}>{z.name} ({z.code})</option>
            ))}
          </select>
        )}
      </div>

      {/* Summary chips */}
      {!chwsLoading && chws && (
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-sand)' }}>
            <Activity size={14} style={{ color: 'var(--success, #22c55e)' }} aria-hidden="true" />
            <span style={{ color: 'var(--ink)' }}><strong>{activeCount}</strong> active this week</span>
          </div>
          {inactiveCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-sand)' }}>
              <Activity size={14} style={{ color: 'var(--warn, #f59e0b)' }} aria-hidden="true" />
              <span style={{ color: 'var(--ink)' }}><strong>{inactiveCount}</strong> inactive</span>
            </div>
          )}
        </div>
      )}

      <DataTable
        columns={COLUMNS as Parameters<typeof DataTable>[0]['columns']}
        data={(chws ?? []) }
        keyField="user_id"
        isLoading={chwsLoading || zonesLoading}
        emptyTitle="No CHWs assigned"
        emptyDescription="No community health workers are assigned to this zone yet."
      />
    </div>
  );
}

