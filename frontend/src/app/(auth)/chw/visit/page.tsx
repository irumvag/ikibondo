'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { createVisit, type VisitResult } from '@/lib/api/chw';
import { listCampChildren, type SupervisedChild } from '@/lib/api/supervisor';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const SYMPTOM_FLAGS = [
  { key: 'FEVER',       label: 'Fever'        },
  { key: 'COUGH',       label: 'Cough'        },
  { key: 'DIARRHEA',    label: 'Diarrhea'     },
  { key: 'VOMITING',    label: 'Vomiting'     },
  { key: 'RASH',        label: 'Rash'         },
  { key: 'CONVULSIONS', label: 'Convulsions'  },
  { key: 'LETHARGY',    label: 'Lethargy'     },
  { key: 'ANOREXIA',    label: 'Anorexia'     },
  { key: 'DEHYDRATION', label: 'Dehydration'  },
];

const RISK_COLOR: Record<string, string> = {
  HIGH:    'var(--danger)',
  MEDIUM:  'var(--warn)',
  LOW:     'var(--success)',
  UNKNOWN: 'var(--text-muted)',
};

const RISK_BG: Record<string, string> = {
  HIGH:    '#fef2f2',
  MEDIUM:  '#fffbeb',
  LOW:     '#f0fdf4',
  UNKNOWN: 'var(--bg-sand)',
};

const todayStr = () => new Date().toISOString().split('T')[0];

interface FormState {
  measurement_date: string;
  weight_kg:        string;
  height_cm:        string;
  muac_cm:          string;
  oedema:           boolean;
  temperature_c:    string;
  respiratory_rate: string;
  heart_rate:       string;
  spo2:             string;
  symptom_flags:    string[];
  notes:            string;
}

const EMPTY_FORM: FormState = {
  measurement_date: todayStr(),
  weight_kg: '', height_cm: '', muac_cm: '',
  oedema: false,
  temperature_c: '', respiratory_rate: '', heart_rate: '', spo2: '',
  symptom_flags: [],
  notes: '',
};

export default function NewVisitPage() {
  const user   = useAuthStore((s) => s.user);
  const campId = user?.camp ?? '';

  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState<SupervisedChild[]>([]);
  const [searching,  setSearching]  = useState(false);
  const [child,      setChild]      = useState<SupervisedChild | null>(null);
  const [form,       setForm]       = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [result,     setResult]     = useState<VisitResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim() || child) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await listCampChildren({ camp: campId || undefined, search: query.trim(), page_size: 8 });
        setResults(res.items);
      } catch { setResults([]); }
      finally   { setSearching(false); }
    }, 300);
  }, [query, campId, child]);

  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const toggleSymptom = (key: string) =>
    setF('symptom_flags', form.symptom_flags.includes(key)
      ? form.symptom_flags.filter((s) => s !== key)
      : [...form.symptom_flags, key]);

  const num = (s: string): number | undefined =>
    s.trim() === '' ? undefined : parseFloat(s);

  const intNum = (s: string): number | undefined =>
    s.trim() === '' ? undefined : parseInt(s, 10);

  const handleSubmit = async () => {
    if (!child) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await createVisit({
        child:            child.id,
        measurement_date: form.measurement_date,
        weight_kg:        num(form.weight_kg),
        height_cm:        num(form.height_cm),
        muac_cm:          num(form.muac_cm),
        oedema:           form.oedema,
        temperature_c:    num(form.temperature_c),
        respiratory_rate: intNum(form.respiratory_rate),
        heart_rate:       intNum(form.heart_rate),
        spo2:             intNum(form.spo2),
        symptom_flags:    form.symptom_flags.length > 0 ? form.symptom_flags : undefined,
        notes:            form.notes || undefined,
        data_source:      'CHW',
      });
      setResult(res);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to save visit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ───────────────────────────────────────────────────────────
  if (result) {
    const color = RISK_COLOR[result.risk_level] ?? RISK_COLOR.UNKNOWN;
    const bg    = RISK_BG[result.risk_level]    ?? RISK_BG.UNKNOWN;

    // SHAP risk factors
    const factorsRaw = result.risk_factors;
    const factorEntries: [string, number][] = Array.isArray(factorsRaw)
      ? factorsRaw.map((f) => [f as string, 1])
      : factorsRaw
        ? Object.entries(factorsRaw as Record<string, number>)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
        : [];
    const maxFactor = factorEntries[0]?.[1] ?? 1;

    const barColor =
      result.risk_level === 'HIGH'   ? 'var(--danger, #ef4444)' :
      result.risk_level === 'MEDIUM' ? 'var(--warn, #f59e0b)'   : 'var(--ink)';

    return (
      <div className="flex flex-col gap-6 max-w-md mx-auto pt-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: bg, color }}
          >
            {result.risk_level === 'HIGH'
              ? <AlertTriangle size={28} aria-hidden="true" />
              : <CheckCircle   size={28} aria-hidden="true" />}
          </div>
          <div>
            <h2
              className="text-2xl font-bold"
              style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
            >
              Visit recorded
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {result.child_name} &middot; {result.measurement_date}
            </p>
          </div>
        </div>

        <div
          className="rounded-2xl border p-5 flex flex-col gap-3"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
        >
          {[
            ['Nutrition status', result.nutrition_status_display],
            result.ml_confidence
              ? ['ML confidence', `${(parseFloat(result.ml_confidence) * 100).toFixed(1)}%`]
              : null,
            result.weight_for_height_z
              ? ['WFH z-score', parseFloat(result.weight_for_height_z).toFixed(2)]
              : null,
            result.height_for_age_z
              ? ['HFA z-score', parseFloat(result.height_for_age_z).toFixed(2)]
              : null,
          ]
            .filter((x): x is string[] => x !== null)
            .map(([k, v]) => (
              <div key={String(k)} className="flex justify-between items-center text-sm">
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span className="font-medium" style={{ color: 'var(--ink)' }}>{v}</span>
              </div>
            ))}

          {/* Risk badge row */}
          <div className="flex justify-between items-center text-sm pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Risk level</span>
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {result.risk_level}
            </span>
          </div>
        </div>

        {/* SHAP risk factor bars */}
        {factorEntries.length > 0 && (
          <div
            className="rounded-2xl border p-5 flex flex-col gap-3"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Top contributing factors (SHAP)
            </p>
            <div className="flex flex-col gap-3">
              {factorEntries.map(([name, val]) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--ink)' }}>
                      {name.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      {typeof val === 'number' ? val.toFixed(3) : val}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min((val / maxFactor) * 100, 100)}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.risk_level === 'HIGH' && (
          <div
            className="rounded-xl p-4 text-sm"
            style={{ backgroundColor: '#fef2f2', borderLeft: '3px solid var(--danger)', color: 'var(--danger)' }}
          >
            High risk detected. Please refer this child to the nearest health facility immediately.
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => { setResult(null); setChild(null); setQuery(''); setForm(EMPTY_FORM); }}
          >
            Log another
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => window.history.back()}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto w-full">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Log a visit
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Find the child then record measurements
        </p>
      </div>

      {/* Child search / selected chip */}
      {!child ? (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
            Find child <span aria-hidden="true" style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or registration number..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm bg-[var(--bg-elev)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ink)] border-[var(--border)] transition-colors"
            />
          </div>
          {searching && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Searching…</p>
          )}
          {results.length > 0 && (
            <div
              className="rounded-xl border overflow-hidden divide-y"
              style={{ borderColor: 'var(--border)' }}
            >
              {results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setChild(c); setQuery(''); setResults([]); }}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--bg-sand)] transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{c.full_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {c.registration_number} &middot; {c.age_display} &middot; {c.sex === 'M' ? 'Male' : 'Female'}
                      {c.zone_name ? ` · Zone: ${c.zone_name}` : ''}
                    </p>
                    {c.guardian_name && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Guardian: {c.guardian_name}{c.guardian_phone ? ` · ${c.guardian_phone}` : ''}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No children found.</p>
          )}
        </div>
      ) : (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3 border"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{child.full_name}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {child.registration_number} &middot; {child.age_display}
              {child.zone_name ? ` · Zone: ${child.zone_name}` : ''}
              {child.camp_name ? ` · ${child.camp_name}` : ''}
            </p>
            {child.guardian_name && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Guardian: {child.guardian_name}{child.guardian_phone ? ` · ${child.guardian_phone}` : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setChild(null); setResults([]); }}
            className="text-xs px-2.5 py-1 rounded-lg transition-colors hover:opacity-80"
            style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-sand)' }}
          >
            Change
          </button>
        </div>
      )}

      {/* Visit form */}
      {child && (
        <div className="flex flex-col gap-6">
          <Input
            label="Visit date"
            type="date"
            value={form.measurement_date}
            onChange={(e) => setF('measurement_date', e.target.value)}
            required
          />

          {/* Anthropometric */}
          <div>
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--ink)' }}>
              Measurements
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Weight (kg)"
                type="number"
                step="0.1"
                min="0"
                value={form.weight_kg}
                onChange={(e) => setF('weight_kg', e.target.value)}
                placeholder="e.g. 7.5"
              />
              <Input
                label="Height (cm)"
                type="number"
                step="0.1"
                min="0"
                value={form.height_cm}
                onChange={(e) => setF('height_cm', e.target.value)}
                placeholder="e.g. 72"
              />
              <Input
                label="MUAC (cm)"
                type="number"
                step="0.1"
                min="0"
                value={form.muac_cm}
                onChange={(e) => setF('muac_cm', e.target.value)}
                placeholder="e.g. 11.5"
              />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={form.oedema}
                onClick={() => setF('oedema', !form.oedema)}
                className="relative w-10 h-6 rounded-full transition-colors shrink-0"
                style={{ backgroundColor: form.oedema ? 'var(--danger)' : 'var(--border)' }}
              >
                <span
                  className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform"
                  style={{ transform: form.oedema ? 'translateX(1.25rem)' : 'translateX(0.25rem)' }}
                />
              </button>
              <span className="text-sm" style={{ color: 'var(--ink)' }}>
                Bilateral pitting oedema
              </span>
            </div>
          </div>

          {/* Vitals */}
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>
              Vitals{' '}
              <span className="font-normal text-xs" style={{ color: 'var(--text-muted)' }}>
                (optional)
              </span>
            </p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Input
                label="Temperature (°C)"
                type="number"
                step="0.1"
                value={form.temperature_c}
                onChange={(e) => setF('temperature_c', e.target.value)}
                placeholder="e.g. 37.2"
              />
              <Input
                label="Resp. rate (/min)"
                type="number"
                step="1"
                value={form.respiratory_rate}
                onChange={(e) => setF('respiratory_rate', e.target.value)}
                placeholder="e.g. 28"
              />
              <Input
                label="Heart rate (bpm)"
                type="number"
                step="1"
                value={form.heart_rate}
                onChange={(e) => setF('heart_rate', e.target.value)}
                placeholder="e.g. 110"
              />
              <Input
                label="SpO2 (%)"
                type="number"
                step="1"
                min="0"
                max="100"
                value={form.spo2}
                onChange={(e) => setF('spo2', e.target.value)}
                placeholder="e.g. 97"
              />
            </div>
          </div>

          {/* Symptoms */}
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>
              Symptoms{' '}
              <span className="font-normal text-xs" style={{ color: 'var(--text-muted)' }}>
                (select all that apply)
              </span>
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {SYMPTOM_FLAGS.map(({ key, label }) => {
                const active = form.symptom_flags.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleSymptom(key)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={{
                      borderColor:     active ? 'var(--ink)' : 'var(--border)',
                      backgroundColor: active ? 'var(--ink)' : 'transparent',
                      color:           active ? 'var(--bg)' : 'var(--text-muted)',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              Notes{' '}
              <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setF('notes', e.target.value)}
              rows={3}
              placeholder="Observations, referrals, follow-up..."
              className="w-full px-3 py-2.5 rounded-xl border text-sm resize-none bg-[var(--bg-elev)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ink)] border-[var(--border)] transition-colors"
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
          )}

          <Button variant="primary" loading={submitting} onClick={handleSubmit}>
            Save visit &amp; get risk score
          </Button>
        </div>
      )}
    </div>
  );
}
