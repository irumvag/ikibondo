'use client';

import { useState } from 'react';
import {
  Syringe, AlertCircle, ChevronLeft, ChevronRight,
  X, Phone, MapPin, Calendar, Clock, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useVaccinationQueue } from '@/lib/api/queries';
import { getChildHistory, getChildNotes, type HealthRecordDetail, type ClinicalNote } from '@/lib/api/nurse';
import { type VaccinationRecord } from '@/lib/api/chw';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

// ── helpers ────────────────────────────────────────────────────────────────────

const RISK_COLOR: Record<string, string> = {
  HIGH: 'var(--danger)', MEDIUM: 'var(--warn)', LOW: 'var(--success)',
};
const RISK_VARIANT: Record<string, 'danger' | 'warn' | 'success' | 'default'> = {
  HIGH: 'danger', MEDIUM: 'warn', LOW: 'success', UNKNOWN: 'default',
};
const NOTE_TYPE_VARIANT: Record<string, 'danger' | 'warn' | 'info' | 'default'> = {
  REFERRAL: 'danger', FOLLOW_UP: 'warn', OBSERVATION: 'info', GENERAL: 'default',
};

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Child Detail Panel ─────────────────────────────────────────────────────────

function ChildDetailPanel({
  rec,
  onClose,
}: {
  rec: VaccinationRecord;
  onClose: () => void;
}) {
  const { data: history = [], isLoading: histLoading } = useQuery({
    queryKey: ['child-history', rec.child],
    queryFn: () => getChildHistory(rec.child),
    staleTime: 30_000,
    enabled: !!rec.child,
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['child-notes-chw', rec.child],
    queryFn: () => getChildNotes(rec.child),
    staleTime: 30_000,
    enabled: !!rec.child,
  });

  const latest = history[0] ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div
        className="ml-auto h-full w-full max-w-lg flex flex-col shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg)', borderLeft: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div>
            <h3
              className="text-lg font-bold"
              style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
            >
              {rec.child_name}
            </h3>
            <div className="flex flex-wrap gap-2 mt-1">
              {rec.zone_name && (
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <MapPin size={11} /> {rec.zone_name}
                </span>
              )}
              {rec.guardian_name && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  👤 {rec.guardian_name}
                </span>
              )}
              {rec.guardian_phone && (
                <a
                  href={`tel:${rec.guardian_phone}`}
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: 'var(--primary)' }}
                >
                  <Phone size={11} /> {rec.guardian_phone}
                </a>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--bg-sand)]"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">

          {/* Upcoming dose card */}
          <div
            className="rounded-2xl p-4 flex flex-col gap-3"
            style={{
              background: rec.is_overdue ? '#fef2f2' : 'var(--bg-elev)',
              border: `1px solid ${rec.is_overdue ? 'var(--danger)' : 'var(--border)'}`,
            }}
          >
            <div className="flex items-center gap-2">
              <Syringe size={16} style={{ color: rec.is_overdue ? 'var(--danger)' : 'var(--primary)' }} />
              <span className="text-sm font-semibold" style={{ color: rec.is_overdue ? 'var(--danger)' : 'var(--ink)' }}>
                {rec.vaccine_name}
                <span className="ml-1.5 font-mono text-xs opacity-70">({rec.vaccine_code})</span>
              </span>
              {rec.is_overdue && (
                <span
                  className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--danger)', color: 'white' }}
                >
                  Overdue
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p style={{ color: 'var(--text-muted)' }}>Scheduled date</p>
                <p className="font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
                  {fmtDate(rec.scheduled_date)}
                </p>
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)' }}>Status</p>
                <p className="font-semibold mt-0.5" style={{ color: rec.is_overdue ? 'var(--danger)' : 'var(--ink)' }}>
                  {rec.status}
                </p>
              </div>
              {rec.dropout_risk_tier && (
                <div>
                  <p style={{ color: 'var(--text-muted)' }}>Dropout risk</p>
                  <p
                    className="font-semibold mt-0.5"
                    style={{ color: RISK_COLOR[rec.dropout_risk_tier] ?? 'var(--ink)' }}
                  >
                    {rec.dropout_risk_tier}
                  </p>
                </div>
              )}
              {rec.dropout_probability && (
                <div>
                  <p style={{ color: 'var(--text-muted)' }}>Dropout probability</p>
                  <p className="font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
                    {(parseFloat(rec.dropout_probability) * 100).toFixed(0)}%
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Latest health record */}
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              Latest health record
            </h4>
            {histLoading ? (
              <Skeleton className="h-28 rounded-xl" />
            ) : !latest ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No health records yet.</p>
            ) : (
              <div
                className="rounded-2xl p-4 flex flex-col gap-3"
                style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Calendar size={11} /> {fmtDate(latest.measurement_date)}
                  </div>
                  <Badge variant={RISK_VARIANT[latest.risk_level] ?? 'default'}>
                    {latest.risk_level}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Weight', value: latest.weight_kg ? `${latest.weight_kg} kg` : null },
                    { label: 'Height', value: latest.height_cm ? `${latest.height_cm} cm` : null },
                    { label: 'MUAC',   value: latest.muac_cm ? `${latest.muac_cm} cm` : null },
                    { label: 'Temp',   value: latest.temperature_c ? `${latest.temperature_c}°C` : null },
                    { label: 'SpO2',   value: (latest as HealthRecordDetail & { spo2?: string | null }).spo2 ? `${(latest as HealthRecordDetail & { spo2?: string | null }).spo2}%` : null },
                    { label: 'Oedema', value: latest.oedema ? 'Yes' : 'No' },
                  ].filter((m) => m.value !== null).map((m) => (
                    <div key={m.label}>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.label}</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>{m.value}</p>
                    </div>
                  ))}
                </div>
                {latest.nutrition_status_display && (
                  <div className="pt-2 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    Nutrition: <span className="font-medium" style={{ color: 'var(--ink)' }}>{latest.nutrition_status_display}</span>
                  </div>
                )}
                {latest.symptom_flags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {latest.symptom_flags.map((f) => (
                      <span key={f} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fef2f2', color: 'var(--danger)' }}>
                        {f}
                      </span>
                    ))}
                  </div>
                )}
                {latest.notes && (
                  <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>"{latest.notes}"</p>
                )}
              </div>
            )}
          </section>

          {/* Recent records timeline */}
          {history.length > 1 && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                Visit history
              </h4>
              <div className="flex flex-col gap-2">
                {history.slice(1, 5).map((hr) => (
                  <div
                    key={hr.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(hr.measurement_date)}</p>
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                        {[hr.weight_kg && `${hr.weight_kg} kg`, hr.height_cm && `${hr.height_cm} cm`, hr.muac_cm && `MUAC ${hr.muac_cm}`].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <Badge variant={RISK_VARIANT[hr.risk_level] ?? 'default'}>{hr.risk_level}</Badge>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Nurse notes */}
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              Nurse notes &amp; advice
            </h4>
            {notesLoading ? (
              <Skeleton className="h-16 rounded-xl" />
            ) : notes.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No notes from the nurse yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {notes.map((n: ClinicalNote) => (
                  <div
                    key={n.id}
                    className="rounded-xl p-3 flex flex-col gap-1.5 border"
                    style={{
                      borderColor: n.is_pinned ? 'var(--warn)' : 'var(--border)',
                      background: n.is_pinned ? 'color-mix(in srgb, var(--warn) 8%, var(--bg-elev))' : 'var(--bg-elev)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={NOTE_TYPE_VARIANT[n.note_type] ?? 'default'}>{n.note_type_display}</Badge>
                      {n.is_pinned && <span className="text-xs font-medium" style={{ color: 'var(--warn)' }}>📌 Pinned</span>}
                      <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(n.created_at)}</span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--ink)' }}>{n.content}</p>
                    {n.author_name && (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>— {n.author_name}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Footer hint */}
        <div
          className="px-5 py-3 border-t text-xs text-center shrink-0"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          <AlertTriangle size={12} className="inline mr-1" style={{ color: 'var(--warn)' }} />
          To administer a vaccine, refer the parent to the health facility.
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function VaccinesPage() {
  const [page,     setPage]     = useState(1);
  const [selected, setSelected] = useState<VaccinationRecord | null>(null);

  const { data, isLoading } = useVaccinationQueue(page);

  const items      = data?.items ?? [];
  const totalCount = data?.count ?? 0;
  const pageSize   = 30;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            Vaccination queue
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {isLoading ? '—' : totalCount} scheduled {totalCount !== 1 ? 'doses' : 'dose'} for your assigned children
          </p>
        </div>
        {totalCount > 0 && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium"
            style={{ backgroundColor: '#fef2f2', color: 'var(--danger)' }}
          >
            <AlertCircle size={14} />
            {totalCount} pending
          </div>
        )}
      </div>

      {/* Info strip */}
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
        style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
      >
        <CheckCircle2 size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
        Tap any row to view the child's details, visit history, and nurse notes.
        Vaccines are administered by nurses at the health facility.
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Syringe size={32} />}
          title="Queue empty"
          description="No scheduled doses for your assigned children at this time."
        />
      ) : (
        <>
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div className="overflow-x-auto">
              {/* Head */}
              <div
                className="grid grid-cols-[1fr_1fr_130px_90px_80px_90px] gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider min-w-[640px]"
                style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-elev)', borderBottom: '1px solid var(--border)' }}
              >
                <span>Child</span>
                <span>Zone / Guardian</span>
                <span>Vaccine</span>
                <span>Scheduled</span>
                <span>Overdue</span>
                <span>Dropout</span>
              </div>

              {/* Rows */}
              {items.map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => setSelected(rec)}
                  className="w-full grid grid-cols-[1fr_1fr_130px_90px_80px_90px] gap-3 items-center px-4 py-3.5 border-b text-left hover:bg-[var(--bg-sand)] transition-colors min-w-[640px]"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                    {rec.child_name}
                  </span>
                  <span className="flex flex-col gap-0.5 min-w-0">
                    {rec.zone_name && (
                      <span className="text-xs truncate flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <MapPin size={10} /> {rec.zone_name}
                      </span>
                    )}
                    {rec.guardian_name && (
                      <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                        {rec.guardian_name}
                      </span>
                    )}
                  </span>
                  <span className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
                    {rec.vaccine_name}{' '}
                    <span className="font-mono text-xs">({rec.vaccine_code})</span>
                  </span>
                  <span className="text-xs whitespace-nowrap" style={{ color: 'var(--ink)' }}>
                    {rec.scheduled_date}
                  </span>
                  <span>
                    {rec.is_overdue && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fef2f2', color: 'var(--danger)' }}>
                        Overdue
                      </span>
                    )}
                  </span>
                  <span>
                    {rec.dropout_risk_tier && (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${RISK_COLOR[rec.dropout_risk_tier] ?? 'var(--text-muted)'}20`,
                          color: RISK_COLOR[rec.dropout_risk_tier] ?? 'var(--text-muted)',
                        }}
                      >
                        {rec.dropout_risk_tier}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-muted)' }}>
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-medium disabled:opacity-40 transition-colors hover:bg-[var(--bg-sand)]"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
                >
                  <ChevronLeft size={13} /> Prev
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-medium disabled:opacity-40 transition-colors hover:bg-[var(--bg-sand)]"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
                >
                  Next <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Overdue summary */}
          {items.some((r) => r.is_overdue) && (
            <div
              className="flex items-start gap-3 px-4 py-3 rounded-xl border text-sm"
              style={{ background: '#fef2f2', borderColor: 'var(--danger)' }}
            >
              <Clock size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
              <div>
                <p className="font-semibold" style={{ color: 'var(--danger)' }}>
                  {items.filter((r) => r.is_overdue).length} overdue dose{items.filter((r) => r.is_overdue).length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--danger)', opacity: 0.8 }}>
                  Remind parents to bring their child to the health facility as soon as possible.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Child detail panel */}
      {selected && (
        <ChildDetailPanel rec={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
