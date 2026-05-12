'use client';

import { useState, useEffect, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import {
  Users, Phone, AlertTriangle, CheckCircle, Clock, Syringe,
  Loader2, Search, ChevronDown, ChevronUp, UserCircle,
} from 'lucide-react';
import {
  listCHWFamilies, createVisit, type CHWFamily, type CHWChildSummary, type VisitResult,
} from '@/lib/api/chw';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

// ── constants ──────────────────────────────────────────────────────────────────

const RISK_META: Record<string, { variant: 'danger' | 'warn' | 'success' | 'default'; dot: string }> = {
  HIGH:    { variant: 'danger',  dot: 'var(--danger)'  },
  MEDIUM:  { variant: 'warn',    dot: 'var(--warn)'    },
  LOW:     { variant: 'success', dot: 'var(--success)'  },
  UNKNOWN: { variant: 'default', dot: 'var(--text-muted)' },
};

const RISK_BG: Record<string, string> = {
  HIGH: '#fef2f2', MEDIUM: '#fffbeb', LOW: '#f0fdf4', UNKNOWN: 'var(--bg-sand)',
};

const SYMPTOM_FLAGS = [
  { key: 'FEVER',       label: 'Fever'       },
  { key: 'COUGH',       label: 'Cough'       },
  { key: 'DIARRHEA',    label: 'Diarrhea'    },
  { key: 'VOMITING',    label: 'Vomiting'    },
  { key: 'RASH',        label: 'Rash'        },
  { key: 'CONVULSIONS', label: 'Convulsions' },
  { key: 'LETHARGY',    label: 'Lethargy'    },
  { key: 'ANOREXIA',    label: 'Anorexia'    },
  { key: 'DEHYDRATION', label: 'Dehydration' },
];

interface FormState {
  measurement_date: string;
  weight_kg: string; height_cm: string; muac_cm: string;
  oedema: boolean;
  temperature_c: string; respiratory_rate: string; heart_rate: string; spo2: string;
  symptom_flags: string[];
  notes: string;
}

const todayStr = () => new Date().toISOString().split('T')[0];
const EMPTY_FORM: FormState = {
  measurement_date: todayStr(),
  weight_kg: '', height_cm: '', muac_cm: '',
  oedema: false,
  temperature_c: '', respiratory_rate: '', heart_rate: '', spo2: '',
  symptom_flags: [],
  notes: '',
};

// ── helpers ────────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function num(s: string): number | undefined { return s.trim() === '' ? undefined : parseFloat(s); }
function intNum(s: string): number | undefined { return s.trim() === '' ? undefined : parseInt(s, 10); }

// ── main component ─────────────────────────────────────────────────────────────

function CaseloadInner() {
  const searchParams = useSearchParams();
  const preChildId = searchParams.get('child');

  const [filter, setFilter]       = useState('');
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [visitChild, setVisitChild] = useState<CHWChildSummary | null>(null);
  const [form, setForm]           = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [result, setResult]       = useState<VisitResult | null>(null);

  const { data: families = [], isLoading } = useQuery({
    queryKey: ['chw-families'],
    queryFn: listCHWFamilies,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Pre-open visit modal when ?child= is in URL
  useEffect(() => {
    if (!preChildId || families.length === 0) return;
    for (const fam of families) {
      const child = fam.children.find((c) => c.id === preChildId);
      if (child) {
        setVisitChild(child);
        setForm({ ...EMPTY_FORM, measurement_date: todayStr() });
        break;
      }
    }
  }, [preChildId, families]);

  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const toggleSymptom = (key: string) =>
    setF('symptom_flags', form.symptom_flags.includes(key)
      ? form.symptom_flags.filter((s) => s !== key)
      : [...form.symptom_flags, key]);

  const openVisit = (child: CHWChildSummary) => {
    setVisitChild(child);
    setForm({ ...EMPTY_FORM, measurement_date: todayStr() });
    setFormError('');
    setResult(null);
  };

  const closeVisit = () => {
    setVisitChild(null);
    setResult(null);
    setFormError('');
  };

  const handleSubmit = async () => {
    if (!visitChild) return;
    setSubmitting(true);
    setFormError('');
    try {
      const res = await createVisit({
        child: visitChild.id,
        measurement_date: form.measurement_date,
        weight_kg: num(form.weight_kg),
        height_cm: num(form.height_cm),
        muac_cm: num(form.muac_cm),
        oedema: form.oedema,
        temperature_c: num(form.temperature_c),
        respiratory_rate: intNum(form.respiratory_rate),
        heart_rate: intNum(form.heart_rate),
        spo2: intNum(form.spo2),
        symptom_flags: form.symptom_flags.length > 0 ? form.symptom_flags : undefined,
        notes: form.notes || undefined,
        data_source: 'CHW',
      });
      setResult(res);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? 'Failed to save visit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFamily = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const filtered = families.filter((f) =>
    !filter.trim() ||
    f.full_name.toLowerCase().includes(filter.toLowerCase()) ||
    f.children.some((c) => c.full_name.toLowerCase().includes(filter.toLowerCase()))
  );

  const totalChildren = families.reduce((sum, f) => sum + f.children.length, 0);

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            My Caseload
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {isLoading ? '—' : `${families.length} families · ${totalChildren} children`}
          </p>
        </div>
        {!isLoading && families.some((f) => f.children.some((c) => c.risk_level === 'HIGH')) && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium shrink-0"
            style={{ background: '#fef2f2', color: 'var(--danger)' }}
          >
            <AlertTriangle size={14} />
            High risk children
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search family or child name…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--bg-elev)',
            color: 'var(--ink)',
          }}
        />
      </div>

      {/* Family list */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={28} />}
          title="No families assigned"
          description="Your supervisor has not assigned any families to you yet."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((family) => {
            const isOpen = expanded.has(family.id);
            const highRiskKids = family.children.filter((c) => c.risk_level === 'HIGH').length;
            const overdueVax = family.children.reduce((s, c) => s + c.overdue_vaccines, 0);

            return (
              <div
                key={family.id}
                className="rounded-xl border overflow-hidden"
                style={{
                  borderColor: highRiskKids > 0 ? 'var(--danger)' : 'var(--border)',
                  background: 'var(--card)',
                }}
              >
                {/* Family header row */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--bg-sand)] transition-colors"
                  onClick={() => toggleFamily(family.id)}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'var(--bg-elev)' }}
                  >
                    <UserCircle size={20} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
                        {family.full_name}
                      </span>
                      {family.has_account && (
                        <Badge variant="info">App user</Badge>
                      )}
                      {highRiskKids > 0 && (
                        <Badge variant="danger">{highRiskKids} high risk</Badge>
                      )}
                      {overdueVax > 0 && (
                        <Badge variant="warn">{overdueVax} overdue vax</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs" style={{ color: 'var(--text-muted)' }}>
                      {family.phone_number && (
                        <a
                          href={`tel:${family.phone_number}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 hover:underline"
                          style={{ color: 'var(--primary)' }}
                        >
                          <Phone size={11} />{family.phone_number}
                        </a>
                      )}
                      <span>{family.children.length} child{family.children.length !== 1 ? 'ren' : ''}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {isOpen ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                </button>

                {/* Children */}
                {isOpen && (
                  <div className="border-t divide-y" style={{ borderColor: 'var(--border)' }}>
                    {family.children.length === 0 ? (
                      <p className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                        No children registered for this family.
                      </p>
                    ) : (
                      family.children.map((child) => (
                        <ChildRow
                          key={child.id}
                          child={child}
                          onLogVisit={() => openVisit(child)}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Visit modal */}
      {visitChild && (
        <VisitModal
          child={visitChild}
          form={form}
          setF={setF}
          toggleSymptom={toggleSymptom}
          submitting={submitting}
          error={formError}
          result={result}
          onSubmit={handleSubmit}
          onClose={closeVisit}
          onAnother={() => { setResult(null); setForm({ ...EMPTY_FORM, measurement_date: todayStr() }); setFormError(''); }}
        />
      )}
    </div>
  );
}

export default function CaseloadPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col gap-3 max-w-2xl mx-auto w-full">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    }>
      <CaseloadInner />
    </Suspense>
  );
}

// ── ChildRow ──────────────────────────────────────────────────────────────────

function ChildRow({ child, onLogVisit }: { child: CHWChildSummary; onLogVisit: () => void }) {
  const risk = RISK_META[child.risk_level] ?? RISK_META.UNKNOWN;

  return (
    <div className="px-4 py-3 flex items-start justify-between gap-3" style={{ background: 'var(--bg)' }}>
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {/* Risk dot */}
        <span
          className="mt-1.5 shrink-0"
          style={{
            display: 'inline-block',
            width: 8, height: 8,
            borderRadius: '50%',
            background: risk.dot,
          }}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{child.full_name}</span>
            <Badge variant={risk.variant}>{child.risk_level}</Badge>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {child.age_display} · {child.sex === 'M' ? 'Male' : 'Female'} · {child.registration_number}
            {child.zone_name ? ` · ${child.zone_name}` : ''}
          </p>

          {/* Indicators row */}
          <div className="flex flex-wrap gap-2 mt-1.5">
            {/* Last visit */}
            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              <Clock size={10} />
              {child.last_visit_date
                ? `Last visit: ${child.last_visit_days_ago === 0 ? 'Today' : child.last_visit_days_ago === 1 ? 'Yesterday' : `${child.last_visit_days_ago}d ago`}`
                : 'Never visited'}
            </span>

            {/* Overdue vaccines */}
            {child.overdue_vaccines > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--danger)' }}>
                <Syringe size={10} />
                {child.overdue_vaccines} overdue
              </span>
            )}

            {/* Next vaccine */}
            {child.next_vaccine_name && child.overdue_vaccines === 0 && (
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Syringe size={10} />
                Next: {child.next_vaccine_name}
                {child.next_vaccine_date ? ` on ${fmtDate(child.next_vaccine_date)}` : ''}
              </span>
            )}

            {/* Upcoming */}
            {child.upcoming_vaccines > 0 && !child.next_vaccine_name && (
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Syringe size={10} />
                {child.upcoming_vaccines} upcoming
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={onLogVisit}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
        style={{ background: 'var(--primary)', color: '#fff' }}
      >
        Log Visit
      </button>
    </div>
  );
}

// ── VisitModal ────────────────────────────────────────────────────────────────

function VisitModal({
  child, form, setF, toggleSymptom, submitting, error, result,
  onSubmit, onClose, onAnother,
}: {
  child: CHWChildSummary;
  form: FormState;
  setF: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  toggleSymptom: (key: string) => void;
  submitting: boolean;
  error: string;
  result: VisitResult | null;
  onSubmit: () => void;
  onClose: () => void;
  onAnother: () => void;
}) {
  const riskColor = (r: string) =>
    r === 'HIGH' ? 'var(--danger)' : r === 'MEDIUM' ? 'var(--warn)' : r === 'LOW' ? 'var(--success)' : 'var(--text-muted)';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border flex flex-col overflow-hidden shadow-xl"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)', maxHeight: '90vh' }}
      >
        {/* Modal header */}
        <div
          className="px-5 py-4 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)' }}
        >
          <div>
            <p className="font-bold text-base" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
              Log visit — {child.full_name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {child.age_display} · {child.registration_number}
              {child.zone_name ? ` · ${child.zone_name}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-lg leading-none px-2"
            style={{ color: 'var(--text-muted)' }}
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 flex flex-col gap-5">
          {result ? (
            /* ── Result screen ── */
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-3 text-center py-2">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: RISK_BG[result.risk_level] ?? 'var(--bg-sand)', color: riskColor(result.risk_level) }}
                >
                  {result.risk_level === 'HIGH'
                    ? <AlertTriangle size={26} />
                    : <CheckCircle size={26} />}
                </div>
                <div>
                  <p className="font-bold text-lg" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
                    Visit recorded
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {result.child_name} · {result.measurement_date}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border p-4 flex flex-col gap-2.5" style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)' }}>
                {[
                  ['Nutrition status', result.nutrition_status_display],
                  result.ml_confidence ? ['ML confidence', `${(parseFloat(result.ml_confidence) * 100).toFixed(1)}%`] : null,
                  result.weight_for_height_z ? ['WFH z-score', parseFloat(result.weight_for_height_z).toFixed(2)] : null,
                  result.height_for_age_z ? ['HFA z-score', parseFloat(result.height_for_age_z).toFixed(2)] : null,
                ].filter((x): x is string[] => x !== null).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                    <span className="font-medium" style={{ color: 'var(--ink)' }}>{v}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Risk level</span>
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: `${riskColor(result.risk_level)}20`, color: riskColor(result.risk_level) }}
                  >
                    {result.risk_level}
                  </span>
                </div>
              </div>

              {result.risk_level === 'HIGH' && (
                <div className="rounded-xl p-3 text-sm" style={{ background: '#fef2f2', borderLeft: '3px solid var(--danger)', color: 'var(--danger)' }}>
                  High risk — refer to nearest health facility immediately.
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="secondary" className="flex-1" onClick={onClose}>Done</Button>
                <Button variant="primary" className="flex-1" onClick={onAnother}>Log another child</Button>
              </div>
            </div>
          ) : (
            /* ── Visit form ── */
            <>
              <Input
                label="Visit date"
                type="date"
                value={form.measurement_date}
                onChange={(e) => setF('measurement_date', e.target.value)}
                required
              />

              {/* Measurements */}
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>Measurements</p>
                <div className="grid grid-cols-3 gap-3">
                  <Input label="Weight (kg)" type="number" step="0.1" min="0" value={form.weight_kg} onChange={(e) => setF('weight_kg', e.target.value)} placeholder="7.5" />
                  <Input label="Height (cm)" type="number" step="0.1" min="0" value={form.height_cm} onChange={(e) => setF('height_cm', e.target.value)} placeholder="72" />
                  <Input label="MUAC (cm)"   type="number" step="0.1" min="0" value={form.muac_cm}   onChange={(e) => setF('muac_cm', e.target.value)}   placeholder="11.5" />
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.oedema}
                    onClick={() => setF('oedema', !form.oedema)}
                    className="relative w-10 h-6 rounded-full transition-colors shrink-0"
                    style={{ background: form.oedema ? 'var(--danger)' : 'var(--border)' }}
                  >
                    <span
                      className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform"
                      style={{ transform: form.oedema ? 'translateX(1.25rem)' : 'translateX(0.25rem)' }}
                    />
                  </button>
                  <span className="text-sm" style={{ color: 'var(--ink)' }}>Bilateral pitting oedema</span>
                </div>
              </div>

              {/* Vitals */}
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>
                  Vitals <span className="font-normal text-xs" style={{ color: 'var(--text-muted)' }}>(optional)</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Temperature (°C)" type="number" step="0.1" value={form.temperature_c} onChange={(e) => setF('temperature_c', e.target.value)} placeholder="37.2" />
                  <Input label="Resp. rate (/min)" type="number" step="1" value={form.respiratory_rate} onChange={(e) => setF('respiratory_rate', e.target.value)} placeholder="28" />
                  <Input label="Heart rate (bpm)" type="number" step="1" value={form.heart_rate} onChange={(e) => setF('heart_rate', e.target.value)} placeholder="110" />
                  <Input label="SpO2 (%)" type="number" step="1" min="0" max="100" value={form.spo2} onChange={(e) => setF('spo2', e.target.value)} placeholder="97" />
                </div>
              </div>

              {/* Symptoms */}
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>
                  Symptoms <span className="font-normal text-xs" style={{ color: 'var(--text-muted)' }}>(select all that apply)</span>
                </p>
                <div className="flex flex-wrap gap-2">
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
                          background:      active ? 'var(--ink)' : 'transparent',
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
                  Notes <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(optional)</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setF('notes', e.target.value)}
                  rows={3}
                  placeholder="Observations, referrals, follow-up…"
                  className="w-full px-3 py-2.5 rounded-xl border text-sm resize-none outline-none focus:ring-2"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)', color: 'var(--ink)' }}
                />
              </div>

              {error && (
                <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
              )}
            </>
          )}
        </div>

        {/* Footer (submit) */}
        {!result && (
          <div className="px-5 py-4 border-t shrink-0 flex gap-2" style={{ borderColor: 'var(--border)' }}>
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              className="flex-1"
              loading={submitting}
              onClick={onSubmit}
            >
              {submitting && <Loader2 size={14} className="animate-spin mr-1" />}
              Save &amp; get risk score
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
