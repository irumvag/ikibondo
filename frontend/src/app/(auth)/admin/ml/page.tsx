'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Cpu, CheckCircle, XCircle, Calendar, Tag, Activity,
  Layers, BarChart2, Play, ChevronLeft, ChevronRight,
  Database, Plus, ArrowUpCircle, RotateCcw,
} from 'lucide-react';
import { useModelInfo, usePredictions } from '@/lib/api/queries';
import { predictRisk, buildFeaturesFromRecord } from '@/lib/api/ml';
import type { PredictRiskResult } from '@/lib/api/ml';
import {
  listMLModelVersions, createMLModelVersion, promoteMLModelVersion, rollbackMLModelVersion,
} from '@/lib/api/admin';
import type { MLModelVersion } from '@/lib/api/admin';
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
  const t = useTranslations('admin.ml');
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
      setError(t('predictionFailedEnsureThe'));
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
        <p className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{t('manualPredict')}</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Anthropometrics */}
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>{t('anthropometrics')}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Input label={t('weightKg')} type="number" step="0.1" value={form.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} />
          <Input label={t('heightCm')} type="number" step="0.1" value={form.height_cm} onChange={(e) => set('height_cm', e.target.value)} />
          <Input label={t('muacCm')} type="number" step="0.1" value={form.muac_cm} onChange={(e) => set('muac_cm', e.target.value)} />
          <Input label={t('ageMonths')} type="number" value={form.age_months} onChange={(e) => set('age_months', e.target.value)} />
        </div>

        <div className="flex gap-4 mb-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <label htmlFor="ml-sex" className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('sex')}</label>
            <select id="ml-sex"
              value={form.sex}
              onChange={(e) => set('sex', e.target.value)}
              className="text-sm px-3 py-2 rounded-lg border outline-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
            >
              <option value="M">{t('male')}</option>
              <option value="F">{t('female')}</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer self-end pb-1.5">
            <input type="checkbox" checked={form.oedema} onChange={(e) => set('oedema', e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm" style={{ color: 'var(--ink)' }}>{t('oedema')}</span>
          </label>
        </div>

        {/* Vitals */}
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>{t('vitals')}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Input label={t('temperatureC')} type="number" step="0.1" value={form.temperature_c} onChange={(e) => set('temperature_c', e.target.value)} />
          <Input label={t('respiratoryRate')} type="number" value={form.respiratory_rate} onChange={(e) => set('respiratory_rate', e.target.value)} />
          <Input label={t('heartRate')} type="number" value={form.heart_rate} onChange={(e) => set('heart_rate', e.target.value)} />
          <Input label={t('spo')} type="number" value={form.spo2} onChange={(e) => set('spo2', e.target.value)} />
        </div>

        {/* Symptoms */}
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>{t('symptomsHistory')}</p>
        <div className="flex flex-wrap gap-4 mb-4">
          {(['has_fever', 'has_cough', 'has_diarrhea', 'has_vomiting'] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form[k]} onChange={(e) => set(k, e.target.checked)} className="w-4 h-4 rounded" />
              <span className="text-sm capitalize" style={{ color: 'var(--ink)' }}>{k.replace('has_', '')}</span>
            </label>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          <Input label={t('visitCount')} type="number" value={form.visit_count} onChange={(e) => set('visit_count', e.target.value)} />
          <Input label={t('daysSinceLastVisit')} type="number" value={form.days_since_last_visit} onChange={(e) => set('days_since_last_visit', e.target.value)} />
          <Input label={t('vaccinationCoverage')} type="number" step="1" min="0" max="100" value={form.vaccination_coverage} onChange={(e) => set('vaccination_coverage', e.target.value)} />
        </div>

        {error && <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>{error}</p>}

        <Button type="submit" variant="primary" loading={running}>
          <Play size={15} className="mr-1.5" aria-hidden="true" />{t('runPrediction')}</Button>
      </form>

      {/* Result */}
      {result && (
        <div
          className="rounded-xl border p-5 flex flex-col gap-4"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-sand)' }}
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{t('predictionResult')}</p>
              <Badge variant={riskVariant(result.risk_level)} className="text-base px-3 py-1">{t('risk', { risk_level: result.risk_level })}</Badge>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('aiConfidence')}</p>
              <p className="text-3xl font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-fraunces)' }}>
                {Math.round(result.confidence * 100)}%
              </p>
              <PctBar value={result.confidence} color={barColor(result.risk_level)} />
            </div>
          </div>

          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('modelVersion', { model_version: result.model_version })}</p>

          {/* SHAP factors */}
          {factorEntries.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>{t('topContributingFactorsShap')}</p>
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
  const t = useTranslations('admin.ml');
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
          <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{t('predictionLog')}</p>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('records', { total: total.toLocaleString() })}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-sand)' }}>
              {['Child', 'Risk level', 'Confidence', 'Model version', 'Date'].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-2.5 text-xs font-semibold whitespace-nowrap"
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
                    <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('noPredictionsLoggedYet')}</td>
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
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('pageOf', { page: page, totalPages: totalPages })}</span>
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

// ── Model Version Registry ────────────────────────────────────────────────────

// Model names: messages/en.json admin.ml.modelName.<model>
const MODEL_NAMES = ['malnutrition', 'growth', 'vaccination'] as const;
const isModelName = (v: string): v is (typeof MODEL_NAMES)[number] => (MODEL_NAMES as readonly string[]).includes(v);

interface RegisterForm {
  model_name: string; version: string; file_path: string;
  f1_score: string; recall: string; precision: string; notes: string;
}

const EMPTY_REGISTER: RegisterForm = {
  model_name: 'malnutrition', version: '', file_path: '', f1_score: '', recall: '', precision: '', notes: '',
};

function ModelRegistry() {
  const t = useTranslations('admin.ml');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RegisterForm>(EMPTY_REGISTER);
  const [formError, setFormError] = useState('');

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['admin', 'ml', 'versions'],
    queryFn: listMLModelVersions,
  });

  const createMutation = useMutation({
    mutationFn: (f: RegisterForm) => createMLModelVersion({
      model_name: f.model_name,
      version: f.version,
      file_path: f.file_path || undefined,
      f1_score: f.f1_score ? Number(f.f1_score) : undefined,
      recall: f.recall ? Number(f.recall) : undefined,
      precision: f.precision ? Number(f.precision) : undefined,
      notes: f.notes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'ml', 'versions'] });
      setShowForm(false);
      setForm(EMPTY_REGISTER);
      setFormError('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? t('failedToRegisterVersion'));
    },
  });

  const promoteMutation = useMutation({
    mutationFn: promoteMLModelVersion,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ml', 'versions'] }),
  });

  const rollbackMutation = useMutation({
    mutationFn: rollbackMLModelVersion,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ml', 'versions'] }),
  });

  // Group by model_name
  const grouped: Record<string, MLModelVersion[]> = {};
  for (const v of versions) {
    (grouped[v.model_name] ??= []).push(v);
  }

  return (
    <div
      className="rounded-2xl border p-6 flex flex-col gap-5"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Database size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>{t('modelVersionRegistry')}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setShowForm((s) => !s)}>
          <Plus size={14} className="mr-1" aria-hidden="true" />{t('registerVersion')}</Button>
      </div>

      {/* Register form */}
      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}
          className="flex flex-col gap-3 rounded-xl border p-4"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-sand)' }}
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="ml-model" className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('model')}</label>
              <select id="ml-model"
                value={form.model_name}
                onChange={(e) => setForm({ ...form, model_name: e.target.value })}
                className="text-sm px-3 py-2 rounded-lg border outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
              >
                {MODEL_NAMES.map((m) => <option key={m} value={m}>{t(`modelName.${m}`)}</option>)}
              </select>
            </div>
            <Input
              label={t('versionEGV2')}
              value={form.version}
              onChange={(e) => setForm({ ...form, version: e.target.value })}
              required
            />
          </div>
          <Input
            label={t('filePathRelativeTo')}
            value={form.file_path}
            onChange={(e) => setForm({ ...form, file_path: e.target.value })}
          />
          <div className="grid sm:grid-cols-3 gap-3">
            <Input label={t('f1Score')} type="number" step="0.0001" min="0" max="1" value={form.f1_score} onChange={(e) => setForm({ ...form, f1_score: e.target.value })} />
            <Input label={t('recall')} type="number" step="0.0001" min="0" max="1" value={form.recall} onChange={(e) => setForm({ ...form, recall: e.target.value })} />
            <Input label={t('precision')} type="number" step="0.0001" min="0" max="1" value={form.precision} onChange={(e) => setForm({ ...form, precision: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="ml-notes" className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('notes')}</label>
            <textarea id="ml-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="text-sm px-3 py-2 rounded-lg border outline-none resize-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
            />
          </div>
          {formError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{formError}</p>}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" loading={createMutation.isPending}>{t('register')}</Button>
            <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setFormError(''); }}>{t('cancel')}</Button>
          </div>
        </form>
      )}

      {/* Version table */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>{t('noVersionsRegisteredYet')}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([modelName, vers]) => (
            <div key={modelName}>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                {isModelName(modelName) ? t(`modelName.${modelName}`) : modelName}
              </p>
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                {vers.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0 flex-wrap"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={v.deployed ? 'success' : 'default'}>
                        {v.deployed ? t('deployed') : v.version}
                      </Badge>
                      {v.deployed && <span className="text-xs font-mono" style={{ color: 'var(--ink)' }}>{v.version}</span>}
                    </div>
                    <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {v.f1_score && <span>F1 {(parseFloat(v.f1_score) * 100).toFixed(1)}%</span>}
                      {v.recall && <span>{t('recall2', { value: (parseFloat(v.recall) * 100).toFixed(1) })}</span>}
                      {v.precision && <span>{t('prec', { value: (parseFloat(v.precision) * 100).toFixed(1) })}</span>}
                    </div>
                    <span className="text-xs ml-auto shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {new Date(v.created_at).toLocaleDateString()}
                      {v.uploaded_by_name && ` · ${v.uploaded_by_name}`}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      {!v.deployed && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={promoteMutation.isPending && promoteMutation.variables === v.id}
                          onClick={() => promoteMutation.mutate(v.id)}
                          title={t('promoteToDeployed')}
                        >
                          <ArrowUpCircle size={12} className="mr-1" aria-hidden="true" />{t('promote')}</Button>
                      )}
                      {v.deployed && (
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={rollbackMutation.isPending && rollbackMutation.variables === v.id}
                          onClick={() => rollbackMutation.mutate(v.id)}
                          title={t('rollbackToPreviousVersion')}
                        >
                          <RotateCcw size={12} className="mr-1" aria-hidden="true" />{t('rollback')}</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────


export default function MLModelPage() {
  const t = useTranslations('admin.ml');
  const { data: info, isLoading, isError } = useModelInfo();

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >{t('mlModels')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('riskClassifierMalnutritionGrowth')}</p>
      </div>

      {/* Primary risk model status card */}
      <div
        className="rounded-2xl border p-6 flex flex-col gap-5"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        <div className="flex items-center gap-2">
          <Cpu size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <p className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{t('riskModelPrimary')}</p>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
          </div>
        ) : isError ? (
          <p className="text-sm" style={{ color: 'var(--danger)' }}>{t('couldNotLoadModel')}</p>
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
                {info!.model_loaded ? t('riskModelLoadedAnd') : t('riskModelNotLoaded')}
              </span>
            </div>

            {/* Metrics */}
            <div>
              <MetricRow label={t('version')} value={<span className="flex items-center gap-1.5"><Tag size={13} aria-hidden="true" />{info!.version}</span>} />
              <MetricRow
                label={t('trainedAt')}
                value={info!.trained_at
                  ? <span className="flex items-center gap-1.5"><Calendar size={13} aria-hidden="true" />{new Date(info!.trained_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                  : '—'
                }
              />
              <MetricRow label={t('featureCount')} value={<span className="flex items-center gap-1.5"><Layers size={13} aria-hidden="true" />{t('features', { n_features: info!.n_features })}</span>} />
            </div>

            {/* Accuracy metrics */}
            {(info!.macro_f1 != null || info!.high_recall != null) && (
              <div className="flex flex-col gap-4">
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('performanceMetrics')}</p>
                {info!.macro_f1 != null && (
                  <div>
                    <p className="text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      <Activity size={13} className="inline mr-1" aria-hidden="true" />{t('macroF1')}</p>
                    <PctBar value={info!.macro_f1} color="var(--ink)" />
                  </div>
                )}
                {info!.high_recall != null && (
                  <div>
                    <p className="text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      <Activity size={13} className="inline mr-1" aria-hidden="true" />{t('highRiskRecall')}</p>
                    <PctBar value={info!.high_recall} color="var(--danger, #ef4444)" />
                  </div>
                )}
              </div>
            )}

            {/* Secondary model statuses */}
            {info!.models && (
              <div>
                <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>{t('secondaryModelsModelloader')}</p>
                <div className="flex flex-col gap-2">
                  {(Object.entries(info!.models) as [string, boolean][]).map(([key, loaded]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-sm" style={{ color: 'var(--ink)' }}>{isModelName(key) ? t(`modelName.${key}`) : key}</span>
                      <span
                        className="flex items-center gap-1.5 text-sm font-semibold"
                        style={{ color: loaded ? 'var(--success)' : 'var(--danger)' }}
                      >
                        {loaded
                          ? <><CheckCircle size={14} aria-hidden="true" /> Loaded</>
                          : <><XCircle size={14} aria-hidden="true" /> Not loaded</>}
                      </span>
                    </div>
                  ))}
                </div>
                {!Object.values(info!.models).every(Boolean) && (
                  <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>{t('run')}{' '}
                    <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-elev)' }}>{t('pythonMlScriptsTrain')}</code>{' '}{t('toTrainAndSave')}{' '}
                    <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-elev)' }}>{t('mlModels2')}</code>
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Model version registry */}
      <ModelRegistry />

      {/* Manual predict */}
      <PredictPanel />

      {/* Prediction history */}
      <PredictionHistory />

      {/* Retrain note */}
      <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}>
        <p>
          <strong style={{ color: 'var(--ink)' }}>{t('toRetrain')}</strong>{' '}{t('run2')}{' '}
          <code className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-elev)' }}>{t('pythonMAppsMl')}</code>{' '}{t('fromTheBackendDirectory')}</p>
      </div>
    </div>
  );
}
