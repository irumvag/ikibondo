'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react';
import { usePredictions, useAuditLog } from '@/lib/api/queries';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

type ColumnsT = ReturnType<typeof useTranslations<'admin.audit'>>;

// ── ML predictions tab ────────────────────────────────────────────────────────

const MODEL_OPTIONS = (t: ColumnsT) => [
  { value: '',             label: t('optAllModels')  },
  { value: 'malnutrition', label: t('optMalnutrition') },
];

function riskVariant(label: string) {
  if (label === 'HIGH' || label === 'SAM') return 'danger';
  if (label === 'MEDIUM' || label === 'MAM') return 'warn';
  return 'success';
}

const PRED_COLUMNS = (t: ColumnsT) => [
  { key: 'child_name',     header: t('colChild'),         width: '180px' },
  { key: 'model_version',  header: t('colModelVersion'), width: '110px' },
  {
    key: 'predicted_label', header: t('colPrediction'), width: '120px',
    render: (v: unknown) => <Badge variant={riskVariant(v as string)}>{v as string}</Badge>,
  },
  {
    key: 'confidence', header: t('colConfidence'), width: '130px',
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
    key: 'created_at', header: t('colDate'), width: '170px',
    render: (v: unknown) => new Date(v as string).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
  },
];

function PredictionsTab() {
  const t = useTranslations('admin.audit');
  const [modelFilter, setModelFilter] = useState('');
  const { data: predictions, isLoading } = usePredictions(modelFilter || undefined);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <BarChart2 size={15} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('records', { value: predictions?.length ?? 0 })}</span>
        </div>
        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none ml-auto"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          aria-label={t('filterByModel')}
        >
          {MODEL_OPTIONS(t).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <DataTable
        columns={PRED_COLUMNS(t) as Parameters<typeof DataTable>[0]['columns']}
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

const AUDIT_COLUMNS = (t: ColumnsT) => [
  {
    key: 'timestamp', header: t('colTime'), width: '150px',
    render: (v: unknown) => new Date(v as string).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }),
  },
  {
    key: 'user_display', header: t('colUser'), width: '140px',
    render: (v: unknown) => <span className="truncate max-w-[130px] inline-block" title={v as string}>{(v as string) || '—'}</span>,
  },
  {
    key: 'action', header: t('colAction'), width: '90px',
    render: (v: unknown) => {
      const a = (v as string);
      const variant = a === 'DELETE' ? 'danger' : a === 'CREATE' ? 'success' : 'default';
      return <Badge variant={variant}>{a}</Badge>;
    },
  },
  {
    key: 'status_code', header: t('colStatus'), width: '75px',
    render: (v: unknown) => {
      const code = v as number;
      const variant = code < 300 ? 'success' : code >= 400 ? 'danger' : 'warn';
      return <Badge variant={variant}>{code}</Badge>;
    },
  },
  { key: 'method', header: t('colMethod'), width: '75px' },
  {
    key: 'path', header: t('colPath'), width: '240px',
    render: (v: unknown) => (
      <span className="font-mono text-xs truncate max-w-[230px] inline-block" title={v as string}>{v as string}</span>
    ),
  },
  {
    key: 'ip_address', header: 'IP', width: '110px',
    render: (v: unknown) => <span className="font-mono text-xs">{(v as string) ?? '—'}</span>,
  },
];

function AuditLogTab() {
  const t = useTranslations('admin.audit');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditLog({ page });
  const totalPages = Math.ceil((data?.count ?? 0) / 30);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('totalEvents', { value: (data?.count ?? 0).toLocaleString() })}</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <span className="text-xs mr-2" style={{ color: 'var(--text-muted)' }}>{t('page', { page: page, totalPages: totalPages })}</span>
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
        columns={AUDIT_COLUMNS(t) as Parameters<typeof DataTable>[0]['columns']}
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
  const t = useTranslations('admin.audit');
  const [tab, setTab] = useState<Tab>('predictions');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'predictions', label: t('mlPredictions') },
    { id: 'audit',       label: t('systemAudit')   },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>{t('auditLog')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('mlPredictionHistoryAnd')}</p>
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
