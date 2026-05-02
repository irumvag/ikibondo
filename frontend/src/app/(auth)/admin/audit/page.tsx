'use client';

import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { usePredictions } from '@/lib/api/queries';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';

const MODEL_OPTIONS = [
  { value: '',             label: 'All models'  },
  { value: 'malnutrition', label: 'Malnutrition' },
  { value: 'growth',       label: 'Growth'       },
  { value: 'vaccination',  label: 'Vaccination'  },
];

function labelVariant(model: string, label: string) {
  if (model === 'malnutrition') {
    if (label === 'SAM')  return 'danger';
    if (label === 'MAM')  return 'warn';
    return 'success';
  }
  if (model === 'growth') {
    return label === 'risk' ? 'danger' : 'success';
  }
  if (model === 'vaccination') {
    if (label === 'HIGH')   return 'danger';
    if (label === 'MEDIUM') return 'warn';
    return 'success';
  }
  return 'default';
}

const COLUMNS = [
  { key: 'child_name',     header: 'Child',        width: '160px' },
  {
    key: 'model_name', header: 'Model', width: '140px',
    render: (v: unknown) => (
      <span className="capitalize text-sm">{(v as string).replace('_', ' ')}</span>
    ),
  },
  { key: 'model_version', header: 'Version', width: '80px' },
  {
    key: 'predicted_label', header: 'Prediction', width: '120px',
    render: (v: unknown, row: unknown) => {
      const r = row as { model_name: string; predicted_label: string };
      return <Badge variant={labelVariant(r.model_name, r.predicted_label)}>{v as string}</Badge>;
    },
  },
  {
    key: 'confidence', header: 'Confidence', width: '110px',
    render: (v: unknown) => `${Math.round((v as number) * 100)}%`,
  },
  {
    key: 'created_at', header: 'Date', width: '160px',
    render: (v: unknown) =>
      new Date(v as string).toLocaleString(undefined, {
        dateStyle: 'medium', timeStyle: 'short',
      }),
  },
];

export default function AuditPage() {
  const [modelFilter, setModelFilter] = useState('');
  const { data: predictions, isLoading } = usePredictions(modelFilter || undefined);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Audit Log
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Last 50 ML predictions — review model decisions and confidence levels.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ScrollText size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
            {predictions?.length ?? 0} records
          </span>
        </div>
        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none ml-auto"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: 'var(--bg-elev)',
            color: 'var(--ink)',
          }}
          aria-label="Filter by model"
        >
          {MODEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={COLUMNS as Parameters<typeof DataTable>[0]['columns']}
        data={(predictions ?? []) as Record<string, unknown>[]}
        keyField="id"
        isLoading={isLoading}
        emptyTitle="No predictions yet"
        emptyDescription="ML predictions will appear here once the model has run for at least one child."
      />
    </div>
  );
}
