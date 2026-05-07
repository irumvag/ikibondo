'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  Edit2, Loader2, MessageSquare, X, Pin, Clock,
} from 'lucide-react';
import { listHealthRecords, getChildNotes, type HealthRecordDetail, type ClinicalNote } from '@/lib/api/nurse';
import { amendHealthRecord } from '@/lib/api/chw';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

// ── helpers ────────────────────────────────────────────────────────────────────

const RISK_VARIANT: Record<string, 'danger' | 'warn' | 'success' | 'default'> = {
  HIGH: 'danger', MEDIUM: 'warn', LOW: 'success', UNKNOWN: 'default',
};

const NOTE_TYPE_VARIANT: Record<string, 'danger' | 'warn' | 'info' | 'default'> = {
  REFERRAL: 'danger', FOLLOW_UP: 'warn', OBSERVATION: 'info', GENERAL: 'default',
};

const SYMPTOM_FLAGS = [
  'FEVER','COUGH','DIARRHEA','VOMITING','RASH','CONVULSIONS','LETHARGY','ANOREXIA','DEHYDRATION',
];

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function hoursAgo(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function canAmend(rec: HealthRecordDetail) {
  return hoursAgo(rec.created_at) <= 24;
}

// ── main page ──────────────────────────────────────────────────────────────────

export default function CHWRecordsPage() {
  const qc = useQueryClient();

  const [page, setPage]           = useState(1);
  const [childFilter, setChildFilter] = useState('');
  const [riskFilter, setRiskFilter]   = useState<string>('ALL');
  const [detailRec, setDetailRec]     = useState<HealthRecordDetail | null>(null);
  const [amendRec, setAmendRec]       = useState<HealthRecordDetail | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['chw-records', page, riskFilter],
    queryFn: () => listHealthRecords({
      page,
      page_size: 25,
      risk_level: riskFilter === 'ALL' ? undefined : riskFilter,
    }),
    staleTime: 30_000,
  });

  const records = data?.items ?? [];
  const total   = data?.count ?? 0;
  const pages   = Math.max(1, Math.ceil(total / 25));

  const filtered = childFilter.trim()
    ? records.filter((r) => r.child_name.toLowerCase().includes(childFilter.toLowerCase()))
    : records;

  return (
    <div className="flex flex-col gap-5 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
            Health Records
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {isLoading ? '—' : `${total} records for your assigned children`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-48">
          <input
            type="text"
            value={childFilter}
            onChange={(e) => setChildFilter(e.target.value)}
            placeholder="Filter by child name…"
            className="w-full pl-3 pr-3 py-2 rounded-xl border text-sm outline-none focus:ring-2"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)', color: 'var(--ink)' }}
          />
        </div>
        <div className="flex gap-1">
          {(['ALL','HIGH','MEDIUM','LOW'] as const).map((r) => (
            <button
              key={r}
              onClick={() => { setRiskFilter(r); setPage(1); }}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors"
              style={{
                borderColor: riskFilter === r ? 'var(--ink)' : 'var(--border)',
                background:  riskFilter === r ? 'var(--ink)' : 'transparent',
                color:       riskFilter === r ? 'var(--bg)' : 'var(--text-muted)',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Activity size={28} />}
          title="No records found"
          description="Health records you log during visits will appear here."
        />
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {/* Table header */}
          <div
            className="grid grid-cols-[1fr_100px_90px_80px_80px] gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
            style={{ background: 'var(--bg-elev)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            <span>Child</span>
            <span>Date</span>
            <span>Status</span>
            <span>Risk</span>
            <span>MUAC</span>
          </div>

          {filtered.map((rec) => (
            <RecordRow
              key={rec.id}
              rec={rec}
              onView={() => setDetailRec(rec)}
              onAmend={() => setAmendRec(rec)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-muted)' }}>
          <span>Page {page} of {pages}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>← Prev</Button>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= pages}>Next →</Button>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {detailRec && (
        <RecordDetailDrawer
          rec={detailRec}
          onClose={() => setDetailRec(null)}
          onAmend={() => { setAmendRec(detailRec); setDetailRec(null); }}
        />
      )}

      {/* Amend modal */}
      {amendRec && (
        <AmendModal
          rec={amendRec}
          onClose={() => setAmendRec(null)}
          onSaved={(updated) => {
            qc.invalidateQueries({ queryKey: ['chw-records'] });
            setAmendRec(null);
            setDetailRec(updated);
          }}
        />
      )}
    </div>
  );
}

// ── RecordRow ──────────────────────────────────────────────────────────────────

function RecordRow({ rec, onView, onAmend }: {
  rec: HealthRecordDetail;
  onView: () => void;
  onAmend: () => void;
}) {
  const amendable = canAmend(rec);
  return (
    <div
      className="grid grid-cols-[1fr_100px_90px_80px_80px] gap-3 items-center px-4 py-3.5 border-b last:border-b-0 hover:bg-[var(--bg-sand)] cursor-pointer transition-colors"
      style={{ borderColor: 'var(--border)' }}
      onClick={onView}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{rec.child_name}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {rec.data_source === 'CHW' ? 'Field visit' : rec.data_source}
          {rec.recorded_by_name ? ` · ${rec.recorded_by_name}` : ''}
        </p>
      </div>
      <span className="text-xs" style={{ color: 'var(--ink)' }}>{fmtDate(rec.measurement_date)}</span>
      <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
        {rec.nutrition_status_display}
      </span>
      <Badge variant={RISK_VARIANT[rec.risk_level] ?? 'default'}>{rec.risk_level}</Badge>
      <div className="flex items-center gap-1.5">
        <span className="text-xs" style={{ color: 'var(--ink)' }}>
          {rec.muac_cm ? `${rec.muac_cm} cm` : '—'}
        </span>
        {amendable && (
          <button
            onClick={(e) => { e.stopPropagation(); onAmend(); }}
            className="p-1 rounded-lg hover:opacity-80 transition-opacity"
            title="Edit (within 24h)"
          >
            <Edit2 size={11} style={{ color: 'var(--primary)' }} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── RecordDetailDrawer ─────────────────────────────────────────────────────────

function RecordDetailDrawer({ rec, onClose, onAmend }: {
  rec: HealthRecordDetail;
  onClose: () => void;
  onAmend: () => void;
}) {
  const amendable = canAmend(rec);

  const { data: notes = [] } = useQuery<ClinicalNote[]>({
    queryKey: ['child-notes', rec.child],
    queryFn: () => getChildNotes(rec.child),
  });

  // Filter notes linked to this record
  const recNotes  = notes.filter((n) => n.health_record === rec.id);
  const childNotes = notes.filter((n) => !n.health_record);

  const factorsRaw = rec.risk_factors;
  const factorEntries: [string, number][] = Array.isArray(factorsRaw)
    ? (factorsRaw as string[]).map((f) => [f, 1])
    : Object.entries(factorsRaw as Record<string, number>).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxFactor = factorEntries[0]?.[1] ?? 1;

  const barColor =
    rec.risk_level === 'HIGH'   ? 'var(--danger)' :
    rec.risk_level === 'MEDIUM' ? 'var(--warn)'   : 'var(--success)';

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="h-full w-full max-w-md flex flex-col overflow-hidden shadow-2xl"
        style={{ background: 'var(--bg)', borderLeft: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)' }}
        >
          <div>
            <p className="font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
              {rec.child_name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {fmtDate(rec.measurement_date)}
              {rec.zone_name ? ` · ${rec.zone_name}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {amendable && (
              <button
                onClick={onAmend}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium hover:opacity-80"
                style={{ background: 'var(--primary)', color: '#fff' }}
              >
                <Edit2 size={12} /> Edit
              </button>
            )}
            {!amendable && (
              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                <Clock size={11} /> 24h window passed
              </span>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-sand)]">
              <X size={18} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
          {/* Risk + nutrition */}
          <div className="rounded-xl border p-4 flex flex-col gap-2.5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Assessment</span>
              <Badge variant={RISK_VARIANT[rec.risk_level] ?? 'default'}>{rec.risk_level} risk</Badge>
            </div>
            <Row label="Nutrition status" value={rec.nutrition_status_display} />
            {rec.ml_confidence && (
              <Row label="ML confidence" value={`${(parseFloat(rec.ml_confidence) * 100).toFixed(1)}%`} />
            )}
          </div>

          {/* Measurements */}
          <div className="rounded-xl border p-4 flex flex-col gap-2.5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Measurements</span>
            <div className="grid grid-cols-2 gap-y-2">
              <Row label="Weight" value={rec.weight_kg ? `${rec.weight_kg} kg` : '—'} />
              <Row label="Height" value={rec.height_cm ? `${rec.height_cm} cm` : '—'} />
              <Row label="MUAC" value={rec.muac_cm ? `${rec.muac_cm} cm` : '—'} />
              <Row label="Oedema" value={rec.oedema ? 'Yes ⚠️' : 'No'} />
              {rec.temperature_c && <Row label="Temp" value={`${rec.temperature_c}°C`} />}
              {rec.weight_for_height_z && <Row label="WFH z" value={parseFloat(rec.weight_for_height_z).toFixed(2)} />}
              {rec.height_for_age_z  && <Row label="HFA z" value={parseFloat(rec.height_for_age_z).toFixed(2)} />}
            </div>
          </div>

          {/* Symptoms */}
          {rec.symptom_flags?.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Symptoms</span>
              <div className="flex flex-wrap gap-1.5">
                {rec.symptom_flags.map((s) => (
                  <span key={s} className="text-xs px-2.5 py-1 rounded-full border" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: '#fef2f2' }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes from CHW */}
          {rec.notes && (
            <div className="rounded-xl p-3.5 text-sm" style={{ background: 'var(--bg-elev)', color: 'var(--ink)' }}>
              <p className="text-xs font-semibold uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>Field notes</p>
              {rec.notes}
            </div>
          )}

          {/* SHAP factors */}
          {factorEntries.length > 0 && (
            <div className="rounded-xl border p-4 flex flex-col gap-3" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Risk factors (AI)</span>
              {factorEntries.map(([name, val]) => (
                <div key={name}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--ink)' }}>{name.replace(/_/g, ' ')}</span>
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{typeof val === 'number' ? val.toFixed(3) : val}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min((val / maxFactor) * 100, 100)}%`, background: barColor }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Nurse clinical notes */}
          {(recNotes.length > 0 || childNotes.length > 0) && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <MessageSquare size={14} style={{ color: 'var(--primary)' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Nurse notes & advice
                </span>
              </div>
              {[...recNotes, ...childNotes].map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          )}

          {recNotes.length === 0 && childNotes.length === 0 && (
            <div className="rounded-xl p-4 text-center text-sm" style={{ background: 'var(--bg-elev)', color: 'var(--text-muted)' }}>
              <MessageSquare size={18} className="mx-auto mb-1.5 opacity-40" />
              No nurse notes on this record yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="font-medium" style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  );
}

function NoteCard({ note }: { note: ClinicalNote }) {
  return (
    <div
      className="rounded-xl p-3.5 flex flex-col gap-1.5"
      style={{
        background: note.is_pinned ? 'color-mix(in srgb, var(--warn) 8%, transparent)' : 'var(--card)',
        border: `1px solid ${note.is_pinned ? 'var(--warn)' : 'var(--border)'}`,
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={NOTE_TYPE_VARIANT[note.note_type] ?? 'default'}>{note.note_type_display}</Badge>
        {note.is_pinned && <Pin size={11} style={{ color: 'var(--warn)' }} />}
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
          {note.author_name ?? 'Nurse'} · {fmtDate(note.created_at)}
        </span>
      </div>
      <p className="text-sm" style={{ color: 'var(--ink)' }}>{note.content}</p>
    </div>
  );
}

// ── AmendModal ─────────────────────────────────────────────────────────────────

function AmendModal({ rec, onClose, onSaved }: {
  rec: HealthRecordDetail;
  onClose: () => void;
  onSaved: (updated: HealthRecordDetail) => void;
}) {
  const [reason, setReason]     = useState('');
  const [weight, setWeight]     = useState(rec.weight_kg ?? '');
  const [height, setHeight]     = useState(rec.height_cm ?? '');
  const [muac, setMuac]         = useState(rec.muac_cm ?? '');
  const [oedema, setOedema]     = useState(rec.oedema);
  const [temp, setTemp]         = useState(rec.temperature_c ?? '');
  const [notes, setNotes]       = useState(rec.notes ?? '');
  const [symptoms, setSymptoms] = useState<string[]>(rec.symptom_flags ?? []);
  const [error, setError]       = useState('');

  const amendMut = useMutation({
    mutationFn: () => amendHealthRecord(rec.id, {
      reason: reason.trim(),
      weight_kg:   weight !== '' ? parseFloat(String(weight)) : null,
      height_cm:   height !== '' ? parseFloat(String(height)) : null,
      muac_cm:     muac   !== '' ? parseFloat(String(muac))   : null,
      oedema,
      temperature_c: temp !== '' ? parseFloat(String(temp)) : null,
      symptom_flags: symptoms,
      notes: notes || undefined,
    }),
    onSuccess: (updated) => onSaved(updated),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to save amendment.');
    },
  });

  const toggleSym = (k: string) =>
    setSymptoms((p) => p.includes(k) ? p.filter((s) => s !== k) : [...p, k]);

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
        {/* Header */}
        <div className="px-5 py-4 border-b shrink-0 flex items-center justify-between" style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)' }}>
          <div>
            <p className="font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
              Edit record — {rec.child_name}
            </p>
            <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--warn)' }}>
              <Clock size={11} />
              Within 24h window · {fmtDate(rec.measurement_date)}
            </p>
          </div>
          <button onClick={onClose}><X size={18} style={{ color: 'var(--text-muted)' }} /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 flex flex-col gap-4">
          {/* Reason (required) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              Reason for amendment <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Scale was miscalibrated, re-weighed child"
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)', color: 'var(--ink)' }}
            />
          </div>

          {/* Measurements */}
          <div className="grid grid-cols-3 gap-3">
            <Input label="Weight (kg)" type="number" step="0.1" value={String(weight)} onChange={(e) => setWeight(e.target.value)} placeholder="7.5" />
            <Input label="Height (cm)" type="number" step="0.1" value={String(height)} onChange={(e) => setHeight(e.target.value)} placeholder="72" />
            <Input label="MUAC (cm)"   type="number" step="0.1" value={String(muac)}   onChange={(e) => setMuac(e.target.value)}   placeholder="11.5" />
          </div>
          <Input label="Temperature (°C)" type="number" step="0.1" value={String(temp)} onChange={(e) => setTemp(e.target.value)} placeholder="37.2" />

          {/* Oedema */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={oedema}
              onClick={() => setOedema(!oedema)}
              className="relative w-10 h-6 rounded-full transition-colors shrink-0"
              style={{ background: oedema ? 'var(--danger)' : 'var(--border)' }}
            >
              <span className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform"
                style={{ transform: oedema ? 'translateX(1.25rem)' : 'translateX(0.25rem)' }} />
            </button>
            <span className="text-sm" style={{ color: 'var(--ink)' }}>Bilateral pitting oedema</span>
          </div>

          {/* Symptoms */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Symptoms</p>
            <div className="flex flex-wrap gap-2">
              {SYMPTOM_FLAGS.map((k) => {
                const active = symptoms.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleSym(k)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={{
                      borderColor: active ? 'var(--ink)' : 'var(--border)',
                      background:  active ? 'var(--ink)' : 'transparent',
                      color:       active ? 'var(--bg)' : 'var(--text-muted)',
                    }}
                  >
                    {k.charAt(0) + k.slice(1).toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Field notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border text-sm resize-none outline-none focus:ring-2"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)', color: 'var(--ink)' }}
              placeholder="Observations, follow-up actions…"
            />
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t shrink-0 flex gap-2" style={{ borderColor: 'var(--border)' }}>
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            className="flex-1"
            loading={amendMut.isPending}
            onClick={() => {
              if (!reason.trim()) { setError('Please provide a reason for this amendment.'); return; }
              setError('');
              amendMut.mutate();
            }}
          >
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
