'use client';

import { useState, useRef } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Pin, ClipboardList, TrendingUp, Cpu,
  Printer, Trash2, RotateCcw, AlertTriangle,
} from 'lucide-react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceArea,
} from 'recharts';
import { useGrowthData, useChild, useChildHistory, useChildNotes, QK } from '@/lib/api/queries';
import { createChildNote } from '@/lib/api/nurse';
import { apiClient } from '@/lib/api/client';
import { predictRisk, buildFeaturesFromRecord } from '@/lib/api/ml';
import type { PredictRiskResult } from '@/lib/api/ml';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import type { GrowthData, HealthRecordDetail, ClinicalNote } from '@/lib/api/nurse';

// ── WHO growth chart colours ──────────────────────────────────────────────────
// p3  / p97 = red boundary (below p3 = wasted/stunted; above p97 = obese)
// p50        = green median
// actual     = deep blue — child's real data
const WHO = {
  p3:     '#dc2626', // red
  p50:    '#16a34a', // green
  p97:    '#dc2626', // red
  actual: '#1d4ed8', // deep blue
  band:   'rgba(22,163,74,0.06)', // faint green fill between p3 and p97
};

type ChartMode = 'weight' | 'height';

function buildChartData(growth: GrowthData, mode: ChartMode) {
  const who = mode === 'weight'
    ? growth.who_percentiles.weight_for_age
    : growth.who_percentiles.height_for_age;
  const allAges = new Map<number, Record<string, number | null>>();

  (['p3', 'p50', 'p97'] as const).forEach((band) => {
    (who[band] ?? []).forEach((p) => {
      const entry = allAges.get(p.age_months) ?? { age: p.age_months };
      entry[band] = p.value;
      allAges.set(p.age_months, entry);
    });
  });

  growth.measurements.forEach((m) => {
    const val = mode === 'weight' ? m.weight_kg : m.height_cm;
    if (val == null) return;
    const entry = allAges.get(m.age_months) ?? { age: m.age_months };
    entry.actual = val;
    allAges.set(m.age_months, entry);
  });

  return Array.from(allAges.values()).sort((a, b) => (a.age as number) - (b.age as number));
}

function GrowthChart({ growth, childName }: { growth: GrowthData; childName: string }) {
  const [mode, setMode] = useState<ChartMode>('weight');
  const printRef = useRef<HTMLDivElement>(null);
  const data = buildChartData(growth, mode);
  const yLabel = mode === 'weight' ? 'Weight (kg)' : 'Height (cm)';

  // Compute p3/p97 range for the green band
  const p3min  = Math.min(...data.map((d) => (d.p3  as number) ?? Infinity).filter(isFinite));
  const p97max = Math.max(...data.map((d) => (d.p97 as number) ?? -Infinity).filter(isFinite));

  const handlePrint = () => {
    const node = printRef.current;
    if (!node) return;
    node.classList.add('print-region');
    window.print();
    // Remove class after print dialog closes (small timeout for Firefox)
    setTimeout(() => node.classList.remove('print-region'), 500);
  };

  return (
    <div>
      {/* Controls row */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-2">
          {(['weight', 'height'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: mode === m ? 'var(--ink)' : 'var(--bg-sand)',
                color: mode === m ? 'var(--bg)' : 'var(--text-muted)',
              }}
            >
              {m === 'weight' ? 'Weight for age' : 'Height for age'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="no-print flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors hover:opacity-80"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', backgroundColor: 'var(--bg-sand)' }}
          title="Print growth chart"
        >
          <Printer size={14} aria-hidden="true" />
          Print
        </button>
      </div>

      {/* The chart — wrapped in ref for print targeting */}
      <div ref={printRef}>
        {/* Print-only header */}
        <div className="hidden print:block mb-4">
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
            WHO Growth Chart — {childName}
          </h2>
          <p style={{ fontSize: 12, color: '#555' }}>
            {mode === 'weight' ? 'Weight for age' : 'Height for age'} · Printed {new Date().toLocaleDateString()}
          </p>
        </div>

        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data} margin={{ top: 8, right: 20, bottom: 16, left: 0 }}>
            {/* Healthy band: between p3 and p97 */}
            {isFinite(p3min) && isFinite(p97max) && (
              <ReferenceArea y1={p3min} y2={p97max} fill={WHO.band} />
            )}
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="age"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickCount={8}
              label={{ value: 'Age (months)', position: 'insideBottom', offset: -6, fontSize: 11 }}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 12, fontSize: 11 }}
              tick={{ fontSize: 11 }}
              width={48}
            />
            <Tooltip
              formatter={(value, name) => [
                value != null ? Number(value).toFixed(1) : '—',
                name === 'actual' ? 'Measurement'
                  : name === 'p3'  ? 'p3 — lower limit'
                  : name === 'p50' ? 'p50 — median'
                  : 'p97 — upper limit',
              ]}
              labelFormatter={(v) => `Age: ${v} months`}
            />
            <Legend
              formatter={(v) =>
                v === 'actual' ? 'Child measurement'
                  : v === 'p3'  ? 'p3 (3rd %ile)'
                  : v === 'p50' ? 'p50 median'
                  : 'p97 (97th %ile)'
              }
            />
            {/* p3 — red dashed lower limit */}
            <Line
              type="monotone" dataKey="p3"
              stroke={WHO.p3} strokeDasharray="5 3" dot={false} strokeWidth={1.5}
              connectNulls name="p3"
            />
            {/* p50 — green median */}
            <Line
              type="monotone" dataKey="p50"
              stroke={WHO.p50} strokeDasharray="8 3" dot={false} strokeWidth={2}
              connectNulls name="p50"
            />
            {/* p97 — red dashed upper limit */}
            <Line
              type="monotone" dataKey="p97"
              stroke={WHO.p97} strokeDasharray="5 3" dot={false} strokeWidth={1.5}
              connectNulls name="p97"
            />
            {/* Actual child measurements — solid blue */}
            <Line
              type="monotone" dataKey="actual"
              stroke={WHO.actual} strokeWidth={2.5}
              dot={{ r: 4, fill: WHO.actual, strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              connectNulls name="actual"
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend explainer */}
        <div className="flex flex-wrap gap-4 mt-3">
          {[
            { color: WHO.actual, label: 'Child measurements', solid: true },
            { color: WHO.p50,    label: 'p50 median (WHO)',   solid: false },
            { color: WHO.p3,     label: 'p3 / p97 limits',   solid: false },
          ].map(({ color, label, solid }) => (
            <div key={label} className="flex items-center gap-1.5">
              <svg width="24" height="4" aria-hidden="true">
                {solid
                  ? <line x1="0" y1="2" x2="24" y2="2" stroke={color} strokeWidth="2.5" />
                  : <line x1="0" y1="2" x2="24" y2="2" stroke={color} strokeWidth="2" strokeDasharray="5 3" />
                }
              </svg>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-3 rounded-sm" style={{ backgroundColor: WHO.band, border: `1px solid ${WHO.p50}` }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Normal range (p3–p97)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Health history row ────────────────────────────────────────────────────────

function riskVariant(r: string) {
  if (r === 'HIGH')   return 'danger';
  if (r === 'MEDIUM') return 'warn';
  if (r === 'LOW')    return 'success';
  return 'default';
}

function HistoryRow({ record }: { record: HealthRecordDetail }) {
  const [open, setOpen] = useState(false);
  const factors = record.risk_factors as Record<string, number> | string[] | null;

  const factorEntries: [string, number][] = Array.isArray(factors)
    ? factors.map((f) => [f, 1])
    : factors
      ? Object.entries(factors as Record<string, number>).sort((a, b) => b[1] - a[1]).slice(0, 5)
      : [];

  const maxFactor = factorEntries[0]?.[1] ?? 1;

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-sand)] transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="text-sm shrink-0 w-24" style={{ color: 'var(--text-muted)' }}>
          {new Date(record.measurement_date).toLocaleDateString()}
        </div>
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          <Badge variant={riskVariant(record.risk_level)}>{record.risk_level}</Badge>
          <span className="text-sm" style={{ color: 'var(--ink)' }}>
            {record.nutrition_status_display || record.nutrition_status}
          </span>
          {record.weight_kg && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {parseFloat(record.weight_kg).toFixed(1)} kg
            </span>
          )}
          {record.height_cm && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {parseFloat(record.height_cm).toFixed(1)} cm
            </span>
          )}
          {record.muac_cm && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              MUAC {parseFloat(record.muac_cm).toFixed(1)} cm
            </span>
          )}
        </div>
        <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
          {open ? 'Hide' : 'SHAP'}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2" style={{ backgroundColor: 'var(--bg-sand)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Feature contributions to {record.risk_level} risk
          </p>
          {factorEntries.length > 0 ? (
            <div className="flex flex-col gap-2">
              {factorEntries.map(([name, val]) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs w-44 truncate" style={{ color: 'var(--ink)' }}>{name.replace(/_/g, ' ')}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min((val / maxFactor) * 100, 100)}%`,
                        backgroundColor: record.risk_level === 'HIGH' ? 'var(--danger)' : 'var(--ink)',
                      }}
                    />
                  </div>
                  <span className="text-xs w-12 text-right font-mono" style={{ color: 'var(--text-muted)' }}>
                    {typeof val === 'number' ? val.toFixed(3) : val}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No feature breakdown available.</p>
          )}
          {record.ml_confidence && (
            <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
              Confidence: <strong style={{ color: 'var(--ink)' }}>{Math.round(parseFloat(record.ml_confidence) * 100)}%</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Notes panel ───────────────────────────────────────────────────────────────

const NOTE_TYPES = [
  { value: 'GENERAL',     label: 'General'           },
  { value: 'OBSERVATION', label: 'Observation'        },
  { value: 'FOLLOW_UP',   label: 'Follow-Up Required' },
  { value: 'REFERRAL',    label: 'Referral'           },
];

function NotesPanel({ childId }: { childId: string }) {
  const qc = useQueryClient();
  const { data: notes, isLoading } = useChildNotes(childId);
  const [noteType, setNoteType] = useState('GENERAL');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await createChildNote(childId, { note_type: noteType, content: content.trim() });
      setContent('');
      qc.invalidateQueries({ queryKey: QK.childNotes(childId) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <select
          value={noteType}
          onChange={(e) => setNoteType(e.target.value)}
          className="text-sm px-3 py-2 rounded-lg border outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
          aria-label="Note type"
        >
          {NOTE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a clinical note..."
          rows={3}
          className="text-sm px-3 py-2 rounded-lg border outline-none resize-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
        />
        <Button variant="primary" size="sm" onClick={handleSave} loading={saving} disabled={!content.trim()}>
          Save note
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : notes && notes.length > 0 ? (
        <div className="flex flex-col gap-2">
          {notes.map((note: ClinicalNote) => (
            <div
              key={note.id}
              className="rounded-xl p-3 flex flex-col gap-1"
              style={{ backgroundColor: note.is_pinned ? 'var(--med-bg)' : 'var(--bg-sand)' }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={
                  note.note_type === 'FOLLOW_UP' ? 'warn' :
                  note.note_type === 'REFERRAL'  ? 'danger' :
                  'default'
                }>
                  {note.note_type_display}
                </Badge>
                {note.is_pinned && <Pin size={12} style={{ color: 'var(--warn)' }} aria-hidden="true" />}
                <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                  {note.author_name ?? '—'} · {new Date(note.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--ink)' }}>{note.content}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No notes yet.</p>
      )}
    </div>
  );
}

// ── ML Predict panel ──────────────────────────────────────────────────────────

function MLPredictPanel({ history }: { history: HealthRecordDetail[] | undefined }) {
  const [result, setResult] = useState<PredictRiskResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const latestRecord = history?.[0];

  const handlePredict = async () => {
    if (!latestRecord) return;
    setRunning(true);
    setError('');
    try {
      const features = buildFeaturesFromRecord({
        weight_kg: latestRecord.weight_kg,
        height_cm: latestRecord.height_cm,
        muac_cm: latestRecord.muac_cm,
        oedema: latestRecord.oedema ?? false,
        temperature_c: latestRecord.temperature_c,
      });
      if (latestRecord.weight_for_height_z) features.weight_for_height_z = parseFloat(latestRecord.weight_for_height_z);
      if (latestRecord.height_for_age_z)    features.height_for_age_z    = parseFloat(latestRecord.height_for_age_z);
      if (latestRecord.weight_for_age_z)    features.weight_for_age_z    = parseFloat(latestRecord.weight_for_age_z);
      const flags = latestRecord.symptom_flags ?? [];
      if (flags.includes('fever'))    features.has_fever    = 1;
      if (flags.includes('cough'))    features.has_cough    = 1;
      if (flags.includes('diarrhea')) features.has_diarrhea = 1;
      if (flags.includes('vomiting')) features.has_vomiting = 1;
      if (latestRecord.oedema)        features.has_oedema   = 1;
      const res = await predictRisk(features);
      setResult(res);
    } catch {
      setError('Prediction failed. Ensure the ML model is loaded.');
    } finally {
      setRunning(false);
    }
  };

  const barColor = (level: string) =>
    level === 'HIGH' ? 'var(--danger)' : level === 'MEDIUM' ? 'var(--warn)' : 'var(--success)';

  const factorEntries = result
    ? Object.entries(result.top_factors).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 8)
    : [];
  const maxFactor = factorEntries.length > 0 ? Math.max(...factorEntries.map(([, v]) => Math.abs(v))) : 1;

  return (
    <div className="flex flex-col gap-5">
      {latestRecord ? (
        <div className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-sand)' }}>
          <p className="font-semibold mb-2" style={{ color: 'var(--ink)' }}>Latest record features</p>
          <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            {latestRecord.weight_kg && <span>Weight: <strong style={{ color: 'var(--ink)' }}>{latestRecord.weight_kg} kg</strong></span>}
            {latestRecord.height_cm && <span>Height: <strong style={{ color: 'var(--ink)' }}>{latestRecord.height_cm} cm</strong></span>}
            {latestRecord.muac_cm   && <span>MUAC: <strong style={{ color: 'var(--ink)' }}>{latestRecord.muac_cm} cm</strong></span>}
            <span>Date: <strong style={{ color: 'var(--ink)' }}>{new Date(latestRecord.measurement_date).toLocaleDateString()}</strong></span>
          </div>
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No health records available to run prediction. Record a visit first.
        </p>
      )}

      {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

      <Button variant="primary" onClick={handlePredict} loading={running} disabled={!latestRecord} className="self-start">
        <Cpu size={15} className="mr-1.5" aria-hidden="true" />
        Run ML prediction
      </Button>

      {result && (
        <div className="rounded-xl border p-5 flex flex-col gap-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Risk prediction</p>
              <Badge variant={result.risk_level === 'HIGH' ? 'danger' : result.risk_level === 'MEDIUM' ? 'warn' : 'success'} className="text-sm px-3 py-1">
                {result.risk_level} risk
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Confidence</p>
              <p className="text-3xl font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-fraunces)' }}>
                {Math.round(result.confidence * 100)}%
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-24 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-sand)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.round(result.confidence * 100)}%`, backgroundColor: barColor(result.risk_level) }} />
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Model: {result.model_version}</p>
          {factorEntries.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>SHAP feature contributions</p>
              <div className="flex flex-col gap-2">
                {factorEntries.map(([feature, value]) => (
                  <div key={feature} className="flex items-center gap-3">
                    <span className="text-xs w-40 truncate" style={{ color: 'var(--text-muted)' }}>{feature.replace(/_/g, ' ')}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-sand)' }}>
                      <div className="h-full rounded-full" style={{ width: `${(Math.abs(value) / maxFactor) * 100}%`, backgroundColor: value > 0 ? barColor(result.risk_level) : 'var(--text-muted)' }} />
                    </div>
                    <span className="text-xs font-mono w-14 text-right" style={{ color: 'var(--ink)' }}>
                      {value > 0 ? '+' : ''}{value.toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Delete panel ──────────────────────────────────────────────────────────────

function DeletePanel({ childId, childName, deletionRequestedAt }: {
  childId: string;
  childName: string;
  deletionRequestedAt: string | null;
}) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const dueDate = deletionRequestedAt
    ? new Date(new Date(deletionRequestedAt).getTime() + 3 * 24 * 60 * 60 * 1000)
    : null;
  const msLeft = dueDate ? dueDate.getTime() - Date.now() : 0;
  const daysLeft = dueDate ? Math.ceil(msLeft / (1000 * 60 * 60 * 24)) : 0;

  const requestDeletion = async () => {
    setLoading(true);
    setError('');
    try {
      await apiClient.post(`/children/${childId}/request-deletion/`);
      qc.invalidateQueries({ queryKey: QK.child(childId) });
      setConfirm(false);
    } catch {
      setError('Could not request deletion. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const cancelDeletion = async () => {
    setLoading(true);
    setError('');
    try {
      await apiClient.post(`/children/${childId}/cancel-deletion/`);
      qc.invalidateQueries({ queryKey: QK.child(childId) });
    } catch {
      setError('Could not cancel deletion.');
    } finally {
      setLoading(false);
    }
  };

  if (deletionRequestedAt) {
    return (
      <div className="rounded-2xl border p-5 flex flex-col gap-3" style={{ borderColor: '#fca5a5', backgroundColor: 'var(--high-bg)' }}>
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} style={{ color: 'var(--danger)', marginTop: 2 }} aria-hidden="true" />
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--danger)' }}>
              Deletion pending — {daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining` : 'due today'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {childName}&apos;s record will be permanently deleted on {dueDate?.toLocaleDateString()}.
              All health records, visit history, and notes will be removed. This cannot be undone.
            </p>
          </div>
        </div>
        {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
        <Button variant="secondary" onClick={cancelDeletion} loading={loading}>
          <RotateCcw size={14} className="mr-1.5" aria-hidden="true" />
          Cancel deletion
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-5 flex flex-col gap-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
      <div>
        <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>Delete child record</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          The record will be permanently removed after a 3-day grace period. You can cancel at any time before then.
        </p>
      </div>
      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}

      {!confirm ? (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="self-start flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
          style={{ borderColor: 'var(--danger)', color: 'var(--danger)', backgroundColor: 'transparent' }}
        >
          <Trash2 size={13} aria-hidden="true" />
          Request deletion
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border p-3" style={{ borderColor: '#fca5a5', backgroundColor: 'var(--high-bg)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>
              Are you sure you want to delete {childName}?
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              All associated records will be permanently removed after 3 days. This action affects all linked health data.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirm(false)} disabled={loading} className="flex-1">
              Cancel
            </Button>
            <button
              type="button"
              onClick={requestDeletion}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
              style={{ backgroundColor: 'var(--danger)', color: '#fff' }}
            >
              {loading ? 'Requesting…' : 'Yes, request deletion'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ChildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<'chart' | 'history' | 'notes' | 'ml'>('chart');

  const { data: child, isLoading: childLoading }     = useChild(id);
  const { data: growth, isLoading: growthLoading }   = useGrowthData(id);
  const { data: history, isLoading: historyLoading } = useChildHistory(id);

  if (childLoading) {
    return (
      <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  const c = child as Record<string, unknown> | undefined;
  const deletionRequestedAt = (c?.deletion_requested_at as string) ?? null;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      {/* Back link */}
      <Link
        href="/nurse/children"
        className="no-print flex items-center gap-1.5 text-sm w-fit"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Children
      </Link>

      {/* Deletion pending banner */}
      {deletionRequestedAt && (
        <div className="no-print flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm" style={{ backgroundColor: 'var(--high-bg)', color: 'var(--danger)' }}>
          <AlertTriangle size={15} aria-hidden="true" />
          This record is scheduled for deletion.
        </div>
      )}

      {/* Child card */}
      <div
        className="rounded-2xl border p-5 flex flex-wrap gap-6"
        style={{ borderColor: deletionRequestedAt ? '#fca5a5' : 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
          style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
          aria-hidden="true"
        >
          {(c?.full_name as string)?.charAt(0) ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
            {(c?.full_name as string) ?? '—'}
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {(c?.registration_number as string) ?? ''} &middot; {(c?.age_display as string) ?? ''} &middot;{' '}
            {(c?.sex as string) === 'M' ? 'Male' : (c?.sex as string) === 'F' ? 'Female' : '—'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Guardian: {(c?.guardian_name as string) || '—'}
            {c?.guardian_phone ? ` · ${c.guardian_phone}` : ''}
          </p>
        </div>
        <div className="flex items-start">
          <Badge variant={(c?.is_active as boolean) ? 'success' : 'default'}>
            {(c?.is_active as boolean) ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      {/* Tab bar */}
      <div className="no-print flex gap-1 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {[
          { key: 'chart',   label: 'Growth chart',   icon: TrendingUp   },
          { key: 'history', label: 'Visit history',  icon: ClipboardList },
          { key: 'notes',   label: 'Clinical notes', icon: Pin           },
          { key: 'ml',      label: 'ML Prediction',  icon: Cpu           },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key as typeof activeTab)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
            style={{
              borderColor: activeTab === key ? 'var(--ink)' : 'transparent',
              color: activeTab === key ? 'var(--ink)' : 'var(--text-muted)',
            }}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'chart' && (
          growthLoading
            ? <Skeleton className="h-72 rounded-2xl" />
            : growth
              ? (
                <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
                  <GrowthChart growth={growth} childName={(c?.full_name as string) ?? ''} />
                </div>
              )
              : <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No growth data available yet.</p>
        )}

        {activeTab === 'history' && (
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
            {historyLoading
              ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 m-2 rounded-lg" />)
              : history && history.length > 0
                ? history.map((r: HealthRecordDetail) => <HistoryRow key={r.id} record={r} />)
                : <p className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>No visit history yet.</p>
            }
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
            <NotesPanel childId={id} />
          </div>
        )}

        {activeTab === 'ml' && (
          <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
            <MLPredictPanel history={history} />
          </div>
        )}
      </div>

      {/* ── Danger zone ─── */}
      <div className="no-print mt-4 flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Danger zone
        </p>
        <DeletePanel
          childId={id}
          childName={(c?.full_name as string) ?? 'this child'}
          deletionRequestedAt={deletionRequestedAt}
        />
      </div>
    </div>
  );
}
