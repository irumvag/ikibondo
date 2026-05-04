'use client';

import { useState } from 'react';
import {
  Cpu, CheckCircle, XCircle, Calendar, Tag, Activity,
  Layers, BarChart2, Play, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useModelInfo, usePredictions } from '@/lib/api/queries';
import { predictRisk, buildFeaturesFromRecord } from '@/lib/api/ml';
import type { PredictRiskResult } from '@/lib/api/ml';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

// ── Helpers ───────────────────────────────────────────────────────────────────

function riskVariant(level: string) {
  if (level === 'HIGH') return 'danger';
  if (level === 'MEDIUM') return 'warn';
  return 'success';
}

function MetricRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between py-3 border-b last:border-b-0"
      style={{ borderColor: 'var(--border)' }}
    >
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  );
}

function PctBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-sand)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(value * 100, 100)}%`, backgroundColor: color }} />
      </div>
      <span className="text-sm font-semibold w-12 text-right" style={{ color: 'var(--ink)' }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

// ── Manual Predict Panel ──────────────────────────────────────────────────────

interface PredictForm {
  weight_kg: string; height_cm: string; muac_cm: string; age_months: string;
  sex: string; oedema: boolean;
  temperature_c: string; respiratory_rate: string; heart_rate: string; spo2: string;
  has_fever: boolean; has_cough: boolean; has_diarrhea: boolean; has_vomiting: boolean;
  visit_count: string; days_since_last_visit: string; vaccination_coverage: string;
}

const EMPTY_FORM: PredictForm = {
  weight_kg: '', height_cm: '', muac_cm: '', age_months: '', sex: 'M', oedema: false,
  temperature_c: '', respiratory_rate: '', heart_rate: '', spo2: '',
  has_fever: false, has_cough: false, has_diarrhea: false, has_vomiting: false,
  visit_count: '', days_since_last_visit: '', vaccination_coverage: '',
};

function PredictPanel() {
  const [form, setForm] = useState<PredictForm>(EMPTY_FORM);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PredictRiskResult | null>(null);
  const [error, setError] = useState('');

  const set = (k: keyof PredictForm, v: string | boolean) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const features = buildFeaturesFromRecord({
        weight_kg: form.weight_kg, height_cm: form.height_cm, muac_cm: form.muac_cm,
        age_months: form.age_months ? Number(form.age_months) : undefined,
        sex: form.sex,
        oedema: form.oedema,
        temperature_c: form.temperature_c,
        respiratory_rate: form.respiratory_rate ? Number(form.respiratory_rate) : undefined,
        heart_rate: form.heart_rate ? Number(form.heart_rate) : undefined,
        spo2: form.spo2 ? Number(form.spo2) : undefined,
      });
      // Add extra features
      if (form.has_fever) features.has_fever = 1;
      if (form.has_cough) features.has_cough = 1;
      if (form.has_diarrhea) features.has_diarrhea = 1;
      if (form.has_vomiting) features.has_vomiting = 1;
      if (form.oedema) features.has_oedema = 1;
      if (form.visit_count) features.visit_count = Number(form.visit_count);
      if (form.days_since_last_visit) features.days_since_last_visit = Number(form.days_since_last_visit);
      if (form.vaccination_coverage) features.vaccination_coverage = Number(form.vaccination_coverage) / 100;

      const res = await predictRisk(features);
      setResult(res);
    } catch {
      setError('Prediction failed. Ensure the ML model is loaded on the backend.');
    } finally {
      setRunning(false);
    }
  };

  const barColor = (level: string) =>
    level === 'HIGH' ? 'var(--danger)' : level === 'MEDIUM' ? 'var(--warn)' : 'var(--success)';

  const factorEntries = result
    ? Object.entries(result.top_factors)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 8)
    : [];
  const maxFactor = factorEntries.length > 0 ? Math.max(...factorEntries.map(([, v]) => Math.abs(v))) : 1;

  return (
    <div
      className="rounded-2xl border p-6 flex flex-col gap-5"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
    >
      <div className="flex items-center gap-2">
        <Play size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        <p className="text-base font-semibold" style={{ color: 'var(--ink)' }}>Manual predict</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Anthropometrics */}
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          Anthropometrics
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Input label="Weight (kg)" type="number" step="0.1" value={form.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} />
          <Input label="Height (cm)" type="number" step="0.1" value={form.height_cm} onChange={(e) => set('height_cm', e.target.value)} />
          <Input label="MUAC (cm)" type="number" step="0.1" value={form.muac_cm} onChange={(e) => set('muac_cm', e.target.value)} />
          <Input label="Age (months)" type="number" value={form.age_months} onChange={(e) => set('age_months', e.target.value)} />
        </div>

        <div className="flex gap-4 mb-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Sex</label>
            <select
              value={form.sex}
              onChange={(e) => set('sex', e.target.value)}
              className="text-sm px-3 py-2 rounded-lg border outline-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
            >
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer self-end pb-1.5">
            <input type="checkbox" checked={form.oedema} onChange={(e) => set('oedema', e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm" style={{ color: 'var(--ink)' }}>Oedema</span>
          </label>
        </div>

        {/* Vitals */}
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          Vitals
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Input label="Temperature (°C)" type="number" step="0.1" value={form.temperature_c} onChange={(e) => set('temperature_c', e.target.value)} />
          <Input label="Respiratory rate" type="number" value={form.respiratory_rate} onChange={(e) => set('respiratory_rate', e.target.value)} />
          <Input label="Heart rate" type="number" value={form.heart_rate} onChange={(e) => set('heart_rate', e.target.value)} />
          <Input label="SpO₂ (%)" type="number" value={form.spo2} onChange={(e) => set('spo2', e.target.value)} />
        </div>

        {/* Symptoms */}
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          Symptoms &amp; history
        </p>
        <div className="flex flex-wrap gap-4 mb-4">
          {(['has_fever', 'has_cough', 'has_diarrhea', 'has_vomiting'] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form[k]} onChange={(e) => set(k, e.target.checked)} className="w-4 h-4 rounded" />
              <span className="text-sm capitalize" style={{ color: 'var(--ink)' }}>{k.replace('has_', '')}</span>
            </label>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          <Input label="Visit count" type="number" value={form.visit_count} onChange={(e) => set('visit_count', e.target.value)} />
          <Input label="Days since last visit" type="number" value={form.days_since_last_visit} onChange={(e) => set('days_since_last_visit', e.target.value)} />
          <Input label="Vaccination coverage (%)" type="number" step="1" min="0" max="100" value={form.vaccination_coverage} onChange={(e) => set('vaccination_coverage', e.target.value)} />
        </div>

        {error && <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>{error}</p>}

        <Button type="submit" variant="primary" loading={running}>
          <Play size={15} className="mr-1.5" aria-hidden="true" />
          Run prediction
        </Button>
      </form>

      {/* Result */}
      {result && (
        <div
          className="rounded-xl border p-5 flex flex-col gap-4"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-sand)' }}
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Prediction result</p>
              <Badge variant={riskVariant(result.risk_level)} className="text-base px-3 py-1">
                {result.risk_level} risk
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>AI Confidence</p>
              <p className="text-3xl font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-fraunces)' }}>
                {Math.round(result.confidence * 100)}%
              </p>
              <PctBar value={result.confidence} color={barColor(result.risk_level)} />
            </div>
          </div>

          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Model version: {result.model_version}</p>

          {/* SHAP factors */}
          {factorEntries.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                Top contributing factors (SHAP)
              </p>
              <div className="flex flex-col gap-2">
                {factorEntries.map(([feature, value]) => (
                  <div key={feature} className="flex items-center gap-3">
                    <span className="text-xs w-40 truncate shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {feature.replace(/_/g, ' ')}
                    </span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-elev)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(Math.abs(value) / maxFactor) * 100}%`,
                          backgroundColor: value > 0 ? barColor(result.risk_level) : 'var(--text-muted)',
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono w-14 text-right shrink-0" style={{ color: 'var(--ink)' }}>
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

// ── Prediction History Table ──────────────────────────────────────────────────

function PredictionHistory() {
  const [page, setPage] = useState(1);
  const { data: predictions, isLoading } = usePredictions();

  const PAGE_SIZE = 15;
  const allItems = predictions ?? [];
  const total = allItems.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const items = allItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div
      className="rounded-2xl border flex flex-col"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <BarChart2 size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>Prediction log</p>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {total.toLocaleString()} records
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-sand)' }}>
              {['Child', 'Risk level', 'Confidence', 'Model version', 'Date'].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    {[0, 1, 2, 3, 4].map((j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              : items.length === 0
              ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                      No predictions logged yet.
                    </td>
                  </tr>
                )
              : items.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-[var(--bg-sand)] transition-colors" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--ink)' }}>
                      {p.child_name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={riskVariant(p.predicted_label)}>
                        {p.predicted_label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-sand)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.round(p.confidence * 100)}%`,
                              backgroundColor:
                                p.predicted_label === 'HIGH' ? 'var(--danger)' :
                                p.predicted_label === 'MEDIUM' ? 'var(--warn)' : 'var(--success)',
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                          {Math.round(p.confidence * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      {p.model_version}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {new Date(p.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-between px-5 py-3 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft size={14} aria-hidden="true" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight size={14} aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MLModelPage() {
  const { data: info, isLoading, isError } = useModelInfo();

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          ML Model
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Malnutrition risk classifier · predictions · SHAP explanations
        </p>
      </div>

      {/* Model status card */}
      <div
        className="rounded-2xl border p-6 flex flex-col gap-5"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        <div className="flex items-center gap-2">
          <Cpu size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <p className="text-base font-semibold" style={{ color: 'var(--ink)' }}>Model status</p>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
          </div>
        ) : isError ? (
          <p className="text-sm" style={{ color: 'var(--danger)' }}>
            Could not load model metadata. Ensure the backend ML service is running.
          </p>
        ) : (
          <>
            {/* Status banner */}
            <div
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{
                backgroundColor: info!.model_loaded ? 'color-mix(in srgb, var(--success) 10%, transparent)' : 'color-mix(in srgb, var(--warn) 10%, transparent)',
                color: info!.model_loaded ? 'var(--success)' : 'var(--warn)',
              }}
            >
              {info!.model_loaded
                ? <CheckCircle size={20} aria-hidden="true" />
                : <XCircle size={20} aria-hidden="true" />}
              <span className="font-semibold text-sm">
                {info!.model_loaded ? 'Model loaded and ready' : 'Model not loaded — run training script'}
              </span>
            </div>

            {/* Metrics */}
            <div>
              <MetricRow label="Version" value={<span className="flex items-center gap-1.5"><Tag size={13} aria-hidden="true" />{info!.version}</span>} />
              <MetricRow
                label="Trained at"
                value={info!.trained_at
                  ? <span className="flex items-center gap-1.5"><Calendar size={13} aria-hidden="true" />{new Date(info!.trained_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                  : '—'
                }
              />
              <MetricRow label="Feature count" value={<span className="flex items-center gap-1.5"><Layers size={13} aria-hidden="true" />{info!.n_features} features</span>} />
            </div>

            {/* Accuracy metrics */}
            {(info!.macro_f1 != null || info!.high_recall != null) && (
              <div className="flex flex-col gap-4">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Performance metrics
                </p>
                {info!.macro_f1 != null && (
                  <div>
                    <p className="text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      <Activity size={13} className="inline mr-1" aria-hidden="true" />Macro F1
                    </p>
                    <PctBar value={info!.macro_f1} color="var(--ink)" />
                  </div>
                )}
                {info!.high_recall != null && (
                  <div>
                    <p className="text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      <Activity size={13} className="inline mr-1" aria-hidden="true" />HIGH-risk recall
                    </p>
                    <PctBar value={info!.high_recall} color="var(--danger, #ef4444)" />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Manual predict */}
      <PredictPanel />

      {/* Prediction history */}
      <PredictionHistory />

      {/* Retrain note */}
      <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}>
        <p>
          <strong style={{ color: 'var(--ink)' }}>To retrain:</strong> run{' '}
          <code className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-elev)' }}>
            python -m apps.ml_engine.training.train_model
          </code>{' '}
          from the backend directory. The model file and metadata will be saved automatically.
        </p>
      </div>
    </div>
  );
}
