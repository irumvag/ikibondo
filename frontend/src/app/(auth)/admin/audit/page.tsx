'use client';

import { useState } from 'react';
import { ScrollText, ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react';
import { usePredictions, useAuditLog } from '@/lib/api/queries';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

// ── ML predictions tab ────────────────────────────────────────────────────────

const MODEL_OPTIONS = [
  { value: '',             label: 'All models'  },
  { value: 'malnutrition', label: 'Malnutrition' },
];

function riskVariant(label: string) {
  if (label === 'HIGH' || label === 'SAM') return 'danger';
  if (label === 'MEDIUM' || label === 'MAM') return 'warn';
  return 'success';
}

const PRED_COLUMNS = [
  { key: 'child_name',     header: 'Child',         width: '180px' },
  { key: 'model_version',  header: 'Model version', width: '110px' },
  {
    key: 'predicted_label', header: 'Prediction', width: '120px',
    render: (v: unknown) => <Badge variant={riskVariant(v as string)}>{v as string}</Badge>,
  },
  {
    key: 'confidence', header: 'Confidence', width: '130px',
    render: (v: unknown) => (
      <div className="flex items-center gap-2">
        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-sand)' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.round((v as number) * 100)}%`, backgroundColor: 'var(--ink)' }}
          />
        </div>
        <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
          {Math.round((v as number) * 100)}%
        </span>
      </div>
    ),
  },
  {
    key: 'created_at', header: 'Date', width: '170px',
    render: (v: unknown) => new Date(v as string).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
  },
];

function PredictionsTab() {
  const [modelFilter, setModelFilter] = useState('');
  const { data: predictions, isLoading } = usePredictions(modelFilter || undefined);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <BarChart2 size={15} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
            {predictions?.length ?? 0} records
          </span>
        </div>
        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none ml-auto"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          aria-label="Filter by model"
        >
          {MODEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <DataTable
        columns={PRED_COLUMNS as Parameters<typeof DataTable>[0]['columns']}
        data={predictions ?? []}
        keyField="id"
        isLoading={isLoading}
        emptyTitle="No predictions yet"
        emptyDescription="ML predictions will appear here once the model has run."
      />
    </div>
  );
}

// ── System audit log tab ──────────────────────────────────────────────────────

const AUDIT_COLUMNS = [
  {
    key: 'timestamp', header: 'Time', width: '160px',
    render: (v: unknown) => new Date(v as string).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }),
  },
  { key: 'user_name', header: 'User',   width: '150px' },
  {
    key: 'action', header: 'Action', width: '80px',
    render: (v: unknown) => {
      const action = (v as string).toLowerCase();
      const variant = action === 'delete' ? 'danger' : action === 'create' ? 'success' : 'default';
      return <Badge variant={variant} className="capitalize">{v as string}</Badge>;
    },
  },
  { key: 'model',       header: 'Resource',    width: '120px' },
  { key: 'object_repr', header: 'Object',      width: '200px' },
];

function AuditLogTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditLog({ page });
  const totalPages = Math.ceil((data?.count ?? 0) / 30);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {(data?.count ?? 0).toLocaleString()} total events
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <span className="text-xs mr-2" style={{ color: 'var(--text-muted)' }}>
              Page {page} / {totalPages}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft size={14} aria-hidden="true" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight size={14} aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
      <DataTable
        columns={AUDIT_COLUMNS as Parameters<typeof DataTable>[0]['columns']}
        data={data?.results ?? []}
        keyField="id"
        isLoading={isLoading}
        emptyTitle="No audit events"
        emptyDescription="System actions will be logged here once they occur."
      />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'predictions' | 'audit';

export default function AuditPage() {
  const [tab, setTab] = useState<Tab>('predictions');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'predictions', label: 'ML Predictions' },
    { id: 'audit',       label: 'System Audit'   },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
          Audit Log
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          ML prediction history and system activity events.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl self-start" style={{ backgroundColor: 'var(--bg-sand)' }}>
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: tab === id ? 'var(--bg-elev)' : 'transparent',
              color: tab === id ? 'var(--ink)' : 'var(--text-muted)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'predictions' ? <PredictionsTab /> : <AuditLogTab />}
    </div>
  );
}
