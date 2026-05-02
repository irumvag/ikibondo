'use client';

import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { useHealthRecords } from '@/lib/api/queries';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import type { HealthRecordDetail } from '@/lib/api/nurse';

// ── Filters ───────────────────────────────────────────────────────────────────

const RISK_OPTIONS = [
  { value: '',        label: 'All risk levels' },
  { value: 'HIGH',    label: 'HIGH'    },
  { value: 'MEDIUM',  label: 'MEDIUM'  },
  { value: 'LOW',     label: 'LOW'     },
  { value: 'UNKNOWN', label: 'Unknown' },
];

const STATUS_OPTIONS = [
  { value: '',       label: 'All statuses' },
  { value: 'SAM',    label: 'SAM'    },
  { value: 'MAM',    label: 'MAM'    },
  { value: 'NORMAL', label: 'Normal' },
];

function riskVariant(r: string) {
  if (r === 'HIGH') return 'danger';
  if (r === 'MEDIUM') return 'warn';
  if (r === 'LOW') return 'success';
  return 'default';
}

// ── SHAP detail drawer ────────────────────────────────────────────────────────

function ShapPanel({ record, onClose }: { record: HealthRecordDetail; onClose: () => void }) {
  const factors = record.risk_factors as Record<string, number> | string[] | null;
  const entries: [string, number][] = Array.isArray(factors)
    ? factors.map((f) => [f, 1])
    : factors
      ? Object.entries(factors as Record<string, number>).sort((a, b) => b[1] - a[1]).slice(0, 8)
      : [];
  const maxVal = entries[0]?.[1] ?? 1;

  return (
    <div
      className="fixed inset-y-0 right-0 z-40 w-full sm:w-96 shadow-xl flex flex-col border-l"
      style={{ backgroundColor: 'var(--bg-elev)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{record.child_name}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {new Date(record.measurement_date).toLocaleDateString(undefined, { dateStyle: 'long' })}
          </p>
        </div>
        <button
          type="button"
          className="text-sm px-3 py-1.5 rounded-lg hover:bg-[var(--bg-sand)]"
          style={{ color: 'var(--text-muted)' }}
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
        {/* Vitals summary */}
        <div
          className="rounded-xl p-4 flex flex-wrap gap-4"
          style={{ backgroundColor: 'var(--bg-sand)' }}
        >
          {[
            ['Risk',       <Badge key="r" variant={riskVariant(record.risk_level)}>{record.risk_level}</Badge>],
            ['Status',     record.nutrition_status_display || record.nutrition_status],
            ['Weight',     record.weight_kg ? `${parseFloat(record.weight_kg).toFixed(1)} kg` : '—'],
            ['Height',     record.height_cm ? `${parseFloat(record.height_cm).toFixed(1)} cm` : '—'],
            ['MUAC',       record.muac_cm   ? `${parseFloat(record.muac_cm).toFixed(1)} cm`   : '—'],
            ['Confidence', record.ml_confidence ? `${Math.round(parseFloat(record.ml_confidence) * 100)}%` : '—'],
          ].map(([label, val]) => (
            <div key={label as string}>
              <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
              <div className="text-sm font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{val}</div>
            </div>
          ))}
        </div>

        {/* SHAP bars */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Feature contributions (SHAP)
          </p>
          {entries.length > 0 ? (
            <div className="flex flex-col gap-3">
              {entries.map(([name, val]) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: 'var(--ink)' }}>{name.replace(/_/g, ' ')}</span>
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      {typeof val === 'number' ? val.toFixed(3) : val}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min((val / maxVal) * 100, 100)}%`,
                        backgroundColor: record.risk_level === 'HIGH' ? 'var(--danger, #ef4444)'
                          : record.risk_level === 'MEDIUM' ? 'var(--warn, #f59e0b)'
                          : 'var(--ink)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No SHAP data available for this record.
            </p>
          )}
        </div>

        {/* Symptom flags */}
        {record.symptom_flags?.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Symptom flags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {record.symptom_flags.map((f) => (
                <Badge key={f} variant="warn">{f}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Z-scores */}
        {(record.weight_for_height_z || record.height_for_age_z || record.weight_for_age_z) && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Z-scores
            </p>
            <div className="flex flex-col gap-1">
              {[
                ['WHZ (weight/height)', record.weight_for_height_z],
                ['HAZ (height/age)',    record.height_for_age_z],
                ['WAZ (weight/age)',    record.weight_for_age_z],
              ].map(([label, val]) => val != null && (
                <div key={label as string} className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span
                    className="font-semibold"
                    style={{ color: parseFloat(val as string) < -2 ? 'var(--danger, #ef4444)' : 'var(--ink)' }}
                  >
                    {parseFloat(val as string).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Table columns ─────────────────────────────────────────────────────────────

const buildColumns = (onSelect: (r: HealthRecordDetail) => void) => [
  {
    key: 'child_name', header: 'Child', width: '160px',
    render: (_: unknown, row: unknown) => {
      const r = row as HealthRecordDetail;
      return (
        <button
          type="button"
          className="text-left font-medium text-sm hover:underline"
          style={{ color: 'var(--ink)' }}
          onClick={() => onSelect(r)}
        >
          {r.child_name}
        </button>
      );
    },
  },
  {
    key: 'measurement_date', header: 'Date', width: '110px',
    render: (v: unknown) => new Date(v as string).toLocaleDateString(),
  },
  { key: 'zone_name', header: 'Zone', width: '120px', render: (v: unknown) => (v as string) || '—' },
  {
    key: 'risk_level', header: 'Risk', width: '100px',
    render: (v: unknown) => <Badge variant={riskVariant(v as string)}>{v as string}</Badge>,
  },
  {
    key: 'nutrition_status_display', header: 'Status', width: '100px',
    render: (v: unknown, row: unknown) => {
      const r = row as HealthRecordDetail;
      const variant = r.nutrition_status === 'SAM' ? 'danger' : r.nutrition_status === 'MAM' ? 'warn' : 'success';
      return <Badge variant={variant}>{(v as string) || r.nutrition_status}</Badge>;
    },
  },
  {
    key: 'weight_kg', header: 'Weight', width: '90px',
    render: (v: unknown) => v ? `${parseFloat(v as string).toFixed(1)} kg` : '—',
  },
  {
    key: 'muac_cm', header: 'MUAC', width: '90px',
    render: (v: unknown) => v ? `${parseFloat(v as string).toFixed(1)} cm` : '—',
  },
  {
    key: 'id', header: '', width: '80px',
    render: (_: unknown, row: unknown) => (
      <button
        type="button"
        className="text-xs font-medium hover:underline"
        style={{ color: 'var(--text-muted)' }}
        onClick={() => onSelect(row as HealthRecordDetail)}
      >
        SHAP
      </button>
    ),
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function RecordsPage() {
  const [riskFilter, setRiskFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]                 = useState(1);
  const [selected, setSelected]         = useState<HealthRecordDetail | null>(null);

  const { data, isLoading } = useHealthRecords({
    risk_level:        riskFilter   || undefined,
    nutrition_status:  statusFilter || undefined,
    page,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Health Records
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {data ? `${data.count.toLocaleString()} records` : 'All health records — click any row to view SHAP explanations.'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <ClipboardList size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        <select
          value={riskFilter}
          onChange={(e) => { setRiskFilter(e.target.value); setPage(1); }}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          aria-label="Filter by risk level"
        >
          {RISK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          aria-label="Filter by nutrition status"
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <DataTable
        columns={buildColumns(setSelected) as Parameters<typeof DataTable>[0]['columns']}
        data={(data?.items ?? []) as Record<string, unknown>[]}
        keyField="id"
        isLoading={isLoading}
        emptyTitle="No records found"
        emptyDescription="No health records match the selected filters."
        pagination={
          data && data.count > 20
            ? { page, pageSize: 20, total: data.count, onPageChange: setPage }
            : undefined
        }
      />

      {/* SHAP drawer + backdrop */}
      {selected && (
        <>
          <div
            className="fixed inset-0 z-30"
            style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
            onClick={() => setSelected(null)}
            aria-hidden="true"
          />
          <ShapPanel record={selected} onClose={() => setSelected(null)} />
        </>
      )}
    </div>
  );
}
