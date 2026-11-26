'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHealthRecords, QK } from '@/lib/api/queries';
import { adminAmendRecord } from '@/lib/api/admin';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { useToast } from '@/contexts/ToastContext';
import { apiClient } from '@/lib/api/client';
import type { HealthRecordDetail } from '@/lib/api/nurse';

// ── Filters ───────────────────────────────────────────────────────────────────

type RecordsT = ReturnType<typeof useTranslations<'nurse.records'>>;

// Filter options use translated text, so they are built from t.
const riskOptions = (t: RecordsT) => [
  { value: '',        label: t('allRiskLevels') },
  { value: 'HIGH',    label: 'HIGH'    },
  { value: 'MEDIUM',  label: 'MEDIUM'  },
  { value: 'LOW',     label: 'LOW'     },
  { value: 'UNKNOWN', label: t('unknown') },
];

const statusOptions = (t: RecordsT) => [
  { value: '',       label: t('allStatuses') },
  { value: 'SAM',    label: 'SAM'    },
  { value: 'MAM',    label: 'MAM'    },
  { value: 'NORMAL', label: t('normal') },
];

function riskVariant(r: string) {
  if (r === 'HIGH') return 'danger';
  if (r === 'MEDIUM') return 'warn';
  if (r === 'LOW') return 'success';
  return 'default';
}

// ── SHAP detail drawer ────────────────────────────────────────────────────────

function ShapPanel({ record, onClose }: { record: HealthRecordDetail; onClose: () => void }) {
  const t = useTranslations('nurse.records');
  const factors = record.risk_factors;
  const entries: [string, number][] = (() => {
    if (!factors) return [];
    if (Array.isArray(factors)) {
      // Could be string[] or {feature, value}[] from backend
      return (factors as unknown[]).map((f): [string, number] => {
        if (f && typeof f === 'object' && 'feature' in f) {
          const o = f as { feature: unknown; value?: unknown };
          return [String(o.feature ?? ''), Number(o.value ?? 1)];
        }
        return [String(f), 1];
      });
    }
    if (typeof factors === 'object') {
      return Object.entries(factors as Record<string, unknown>)
        .map(([k, v]): [string, number] => [k, Number(v)])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    }
    return [];
  })();
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
        >{t('close')}</button>
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
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
              <div className="text-sm font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{val}</div>
            </div>
          ))}
        </div>

        {/* SHAP bars */}
        <div>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>{t('featureContributionsShap')}</p>
          {entries.length > 0 ? (
            <div className="flex flex-col gap-3">
              {entries.map(([name, val]) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: 'var(--ink)' }}>{String(name).replace(/_/g, ' ')}</span>
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
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('noShapDataAvailable')}</p>
          )}
        </div>

        {/* Symptom flags */}
        {record.symptom_flags?.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>{t('symptomFlags')}</p>
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
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>{t('zScores')}</p>
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

// ── Add Health Record Modal ───────────────────────────────────────────────────

const TODAY_STR = new Date().toISOString().split('T')[0];

interface ChildOption { id: string; full_name: string; registration_number: string; }

function AddHealthRecordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('nurse.records');
  const qc    = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    child: '', measurement_date: TODAY_STR, weight_kg: '', height_cm: '',
    muac_cm: '', oedema: false, temperature_c: '', notes: '',
  });
  const [error, setError] = useState('');

  const { data: children = [] } = useQuery<ChildOption[]>({
    queryKey: ['nurse', 'children-for-record'],
    queryFn: async () => {
      const { data } = await apiClient.get('/children/', { params: { page_size: 500, is_active: true } });
      return data.data ?? data.results ?? [];
    },
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post('/health-records/', body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health-records'] });
      toast.success(t('healthRecordAdded'));
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? t('failedToSaveRecord'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.child) { setError(t('pleaseSelectAChild')); return; }
    if (!form.weight_kg && !form.height_cm && !form.muac_cm) {
      setError(t('enterAtLeastOne')); return;
    }
    setError('');
    const body: Record<string, unknown> = { child: form.child, measurement_date: form.measurement_date, oedema: form.oedema };
    if (form.weight_kg)     body.weight_kg     = parseFloat(form.weight_kg);
    if (form.height_cm)     body.height_cm     = parseFloat(form.height_cm);
    if (form.muac_cm)       body.muac_cm       = parseFloat(form.muac_cm);
    if (form.temperature_c) body.temperature_c = parseFloat(form.temperature_c);
    if (form.notes)         body.notes         = form.notes;
    mutation.mutate(body);
  };

  const set = (k: string, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('addHealthRecord')}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" loading={mutation.isPending} onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}>{t('saveRecord')}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} id="add-record-form" className="flex flex-col gap-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <Select
          label={t('child')}
          value={form.child}
          onChange={(e) => set('child', e.target.value)}
          required
          options={children.map((c) => ({ value: c.id, label: `${c.full_name} (${c.registration_number})` }))}
          placeholder={t('selectChild')}
        />
        <Input label={t('date')} type="date" value={form.measurement_date} onChange={(e) => set('measurement_date', e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('weightKg')} type="number" step="0.01" value={form.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} placeholder="e.g. 7.5" />
          <Input label={t('heightCm')} type="number" step="0.1"  value={form.height_cm} onChange={(e) => set('height_cm', e.target.value)} placeholder="e.g. 72.0" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('muacCm')}   type="number" step="0.1"  value={form.muac_cm}       onChange={(e) => set('muac_cm', e.target.value)}       placeholder="e.g. 12.5" />
          <Input label={t('tempC')}   type="number" step="0.1"  value={form.temperature_c} onChange={(e) => set('temperature_c', e.target.value)} placeholder="e.g. 37.0" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={form.oedema} onChange={(e) => set('oedema', e.target.checked)} className="w-4 h-4 rounded" />
          <span className="text-sm" style={{ color: 'var(--ink)' }}>{t('bilateralPittingOedema')}</span>
        </label>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="records-notes" className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('notes')}</label>
          <textarea id="records-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder={t('optionalClinicalNotes')}
            className="rounded-xl border px-3 py-2.5 text-sm outline-none resize-none focus:ring-2 focus:ring-[var(--ink)] focus:border-transparent"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }} />
        </div>
      </form>
    </Modal>
  );
}

// ── Amend modal ───────────────────────────────────────────────────────────────

function AmendModal({ record, open, onDone, onCancel }: {
  record: HealthRecordDetail; open: boolean; onDone: () => void; onCancel: () => void;
}) {
  const t = useTranslations('nurse.records');
  const toast = useToast();
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [muacCm,   setMuacCm]   = useState('');
  const [notes,    setNotes]    = useState('');
  const [reason,   setReason]   = useState('');

  const mut = useMutation({
    mutationFn: () => adminAmendRecord(record.id, {
      ...(weightKg ? { weight_kg: parseFloat(weightKg) } : {}),
      ...(heightCm ? { height_cm: parseFloat(heightCm) } : {}),
      ...(muacCm   ? { muac_cm:   parseFloat(muacCm)   } : {}),
      ...(notes    ? { notes }                           : {}),
      amendment_reason: reason,
    }),
    onSuccess: () => { toast.success(t('recordAmended')); onDone(); },
    onError: () => { toast.error(t('amendmentFailedPleaseTry')); },
  });

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={t('amendTitle', { name: record.child_name })}
      description={t('leaveFieldsBlankTo')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>{t('cancel')}</Button>
          <Button variant="primary" loading={mut.isPending}
            onClick={() => mut.mutate()} disabled={!reason.trim()}>{t('saveAmendment')}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {mut.isError && <Alert variant="danger">{t('amendmentFailedPleaseTry')}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('weightKg')} type="number" step="0.01" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="e.g. 7.5" />
          <Input label={t('heightCm')} type="number" step="0.1"  value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="e.g. 72.0" />
        </div>
        <Input label={t('muacCm')} type="number" step="0.1" value={muacCm} onChange={e => setMuacCm(e.target.value)} placeholder="e.g. 12.5" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="records-notes-2" className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('notes')}</label>
          <textarea id="records-notes-2" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder={t('optionalUpdate')}
            className="rounded-xl border px-3 py-2.5 text-sm outline-none resize-none"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="records-amendment-reason" className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('amendmentReason')}{' '}<span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <textarea id="records-amendment-reason" value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder={t('whyIsThisRecord')}
            className="rounded-xl border px-3 py-2.5 text-sm outline-none resize-none"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }} />
        </div>
      </div>
    </Modal>
  );
}

// ── Table columns ─────────────────────────────────────────────────────────────

const buildColumns = (
  t: RecordsT,
  onSelect: (r: HealthRecordDetail) => void,
  onAmend: (r: HealthRecordDetail) => void,
) => [
  {
    key: 'child_name', header: t('colChild'), width: '160px',
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
    key: 'measurement_date', header: t('colDate'), width: '110px',
    render: (v: unknown) => new Date(v as string).toLocaleDateString(),
  },
  { key: 'zone_name', header: t('colZone'), width: '120px', render: (v: unknown) => (v as string) || '—' },
  {
    key: 'risk_level', header: t('colRisk'), width: '100px',
    render: (v: unknown) => <Badge variant={riskVariant(v as string)}>{v as string}</Badge>,
  },
  {
    key: 'nutrition_status_display', header: t('colStatus'), width: '100px',
    render: (v: unknown, row: unknown) => {
      const r = row as HealthRecordDetail;
      const variant = r.nutrition_status === 'SAM' ? 'danger' : r.nutrition_status === 'MAM' ? 'warn' : 'success';
      return <Badge variant={variant}>{(v as string) || r.nutrition_status}</Badge>;
    },
  },
  {
    key: 'weight_kg', header: t('colWeight'), width: '90px',
    render: (v: unknown) => v ? `${parseFloat(v as string).toFixed(1)} kg` : '—',
  },
  {
    key: 'muac_cm', header: t('colMuac'), width: '90px',
    render: (v: unknown) => v ? `${parseFloat(v as string).toFixed(1)} cm` : '—',
  },
  {
    key: 'id', header: '', width: '130px',
    render: (_: unknown, row: unknown) => {
      const r = row as HealthRecordDetail;
      return (
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="text-xs font-medium hover:underline"
            style={{ color: 'var(--text-muted)' }} onClick={() => onSelect(r)}>
            SHAP
          </button>
          <button type="button" className="text-xs font-medium hover:underline"
            style={{ color: 'var(--ink)' }} onClick={() => onAmend(r)}>
            {t('amend')}
          </button>
        </div>
      );
    },
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function RecordsPage() {
  const t = useTranslations('nurse.records');
  const qc = useQueryClient();
  const [riskFilter, setRiskFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]                 = useState(1);
  const [selected, setSelected]         = useState<HealthRecordDetail | null>(null);
  const [showAdd, setShowAdd]           = useState(false);
  const [amendTarget, setAmendTarget]   = useState<HealthRecordDetail | null>(null);

  const { data, isLoading } = useHealthRecords({
    risk_level:        riskFilter   || undefined,
    nutrition_status:  statusFilter || undefined,
    page,
  });

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >{t('healthRecords')}</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {data ? t('recordsCount', { count: data.count }) : t('allHealthRecordsClick')}
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowAdd(true)}>
          <Plus size={15} className="mr-1.5" aria-hidden="true" />{t('addRecord')}</Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <ClipboardList size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        <Select
          value={riskFilter}
          onChange={(e) => { setRiskFilter(e.target.value); setPage(1); }}
          options={riskOptions(t)}
          aria-label={t('filterByRiskLevel')}
          className="w-40"
        />
        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          options={statusOptions(t)}
          aria-label={t('filterByNutritionStatus')}
          className="w-36"
        />
      </div>

      <DataTable
        columns={buildColumns(t, setSelected, setAmendTarget) as Parameters<typeof DataTable>[0]['columns']}
        data={(data?.items ?? []) }
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

      {/* Add record modal */}
      <AddHealthRecordModal open={showAdd} onClose={() => setShowAdd(false)} />

      {/* Amend modal */}
      {amendTarget && (
        <AmendModal
          record={amendTarget}
          open={!!amendTarget}
          onDone={() => {
            qc.invalidateQueries({ queryKey: QK.healthRecords({}) });
            setAmendTarget(null);
          }}
          onCancel={() => setAmendTarget(null)}
        />
      )}

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

