'use client';

import { useState } from 'react';
import { MapPin, ChevronDown, ChevronRight, Globe } from 'lucide-react';
import { useAdminCamps, useAdminZones } from '@/lib/api/queries';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Camp, Zone } from '@/lib/api/admin';

// ── Camp status badge ─────────────────────────────────────────────────────────

function statusVariant(s: string) {
  if (s === 'ACTIVE') return 'success';
  if (s === 'INACTIVE') return 'default';
  return 'warn';
}

// ── Zone sub-table rendered inline ───────────────────────────────────────────

const ZONE_COLUMNS = [
  { key: 'name',   header: 'Zone name', width: '180px' },
  { key: 'code',   header: 'Code',      width: '90px'  },
  {
    key: 'status', header: 'Status', width: '100px',
    render: (v: unknown) => <Badge variant={statusVariant(v as string)}>{v as string}</Badge>,
  },
  {
    key: 'estimated_population', header: 'Est. pop.', width: '110px',
    render: (v: unknown) => (v ? (v as number).toLocaleString() : '—'),
  },
  {
    key: 'estimated_households', header: 'Households', width: '110px',
    render: (v: unknown) => (v ? (v as number).toLocaleString() : '—'),
  },
];

function ZonesPanel({ campId }: { campId: string }) {
  const { data: zones, isLoading } = useAdminZones(campId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 py-2">
        {[0, 1].map((i) => <Skeleton key={i} className="h-8 rounded-lg" />)}
      </div>
    );
  }

  return (
    <DataTable
      columns={ZONE_COLUMNS as Parameters<typeof DataTable>[0]['columns']}
      data={(zones ?? []) }
      keyField="id"
      emptyTitle="No zones yet"
      emptyDescription="Zones will appear here once added to this camp."
    />
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

const CAMP_COLUMNS = (
  expanded: string | null,
  onToggle: (id: string) => void,
) => [
  {
    key: 'name', header: 'Camp name', width: '200px',
    render: (_: unknown, row: unknown) => {
      const camp = row as Camp;
      return (
        <button
          type="button"
          className="flex items-center gap-1.5 text-left font-medium hover:underline"
          style={{ color: 'var(--ink)' }}
          onClick={() => onToggle(camp.id)}
        >
          {expanded === camp.id
            ? <ChevronDown size={14} aria-hidden="true" />
            : <ChevronRight size={14} aria-hidden="true" />}
          {camp.name}
        </button>
      );
    },
  },
  { key: 'code',     header: 'Code',     width: '90px'  },
  { key: 'district', header: 'District', width: '130px', render: (v: unknown) => (v as string) || '—' },
  { key: 'province', header: 'Province', width: '130px', render: (v: unknown) => (v as string) || '—' },
  {
    key: 'status', header: 'Status', width: '100px',
    render: (v: unknown) => <Badge variant={statusVariant(v as string)}>{v as string}</Badge>,
  },
  {
    key: 'active_children_count', header: 'Children', width: '100px',
    render: (v: unknown) => (v as number).toLocaleString(),
  },
  {
    key: 'estimated_population', header: 'Est. pop.', width: '110px',
    render: (v: unknown) => (v ? (v as number).toLocaleString() : '—'),
  },
];

export default function CampsPage() {
  const { data: camps, isLoading } = useAdminCamps();
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleExpand = (id: string) => setExpanded((prev) => (prev === id ? null : id));

  const totalChildren = camps?.reduce((sum, c) => sum + c.active_children_count, 0) ?? 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Camps &amp; Zones
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {camps?.length ?? 0} camps &middot; {totalChildren.toLocaleString()} registered children
        </p>
      </div>

      {/* Camp list */}
      <div className="flex flex-col gap-0">
        {isLoading
          ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl mb-2" />)
          : (camps ?? []).map((camp) => (
              <div key={camp.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                {/* Camp row */}
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-sand)] transition-colors text-left"
                  onClick={() => toggleExpand(camp.id)}
                  aria-expanded={expanded === camp.id}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}
                  >
                    <Globe size={15} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-4 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
                      {camp.name}
                    </span>
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}>
                      {camp.code}
                    </span>
                    <Badge variant={statusVariant(camp.status)}>{camp.status}</Badge>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {camp.active_children_count.toLocaleString()} children
                    </span>
                    {camp.district && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        <MapPin size={12} className="inline mr-0.5" aria-hidden="true" />
                        {camp.district}
                      </span>
                    )}
                  </div>
                  {expanded === camp.id
                    ? <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                    : <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />}
                </button>

                {/* Zones panel */}
                {expanded === camp.id && (
                  <div className="px-6 pb-4 pt-2" style={{ backgroundColor: 'var(--bg-sand)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                      Zones in {camp.name}
                    </p>
                    <ZonesPanel campId={camp.id} />
                  </div>
                )}
              </div>
            ))}

        {!isLoading && (camps?.length ?? 0) === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
            <Globe size={32} className="mx-auto mb-2 opacity-40" aria-hidden="true" />
            <p className="text-sm font-medium">No camps registered yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

