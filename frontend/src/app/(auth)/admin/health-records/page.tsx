'use client';

import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { ClipboardList, ChevronDown, ChevronRight } from 'lucide-react';
import { useHealthRecords, useAdminCamps, useAdminZones, QK } from '@/lib/api/queries';
import { adminAmendRecord } from '@/lib/api/admin';

// ── Helpers ───────────────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: string | null }) {
  if (!level) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const map: Record<string, string> = { HIGH: 'var(--danger)', MEDIUM: 'var(--warn)', LOW: 'var(--success)' };
  const color = map[level] ?? 'var(--ink)';
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
      background: `color-mix(in srgb, ${color} 12%, var(--bg-elev))`, color,
    }}>
      {level}
    </span>
  );
}

function NutBadge({ status }: { status: string | null }) {
  if (!status) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const map: Record<string, string> = { SAM: 'var(--danger)', MAM: 'var(--warn)', NORMAL: 'var(--success)' };
  const color = map[status] ?? 'var(--ink)';
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
      background: `color-mix(in srgb, ${color} 12%, var(--bg-elev))`, color,
    }}>
      {status}
    </span>
  );
}

// ── Amend modal ───────────────────────────────────────────────────────────────

interface AmendTarget { id: string; child_name: string }

function AmendModal({ target, onDone, onCancel }: {
  target: AmendTarget; onDone: () => void; onCancel: () => void
}) {
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [muacCm, setMuacCm] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  const mut = useMutation({
    mutationFn: () => adminAmendRecord(target.id, {
      ...(weightKg ? { weight_kg: parseFloat(weightKg) } : {}),
      ...(heightCm ? { height_cm: parseFloat(heightCm) } : {}),
      ...(muacCm ? { muac_cm: parseFloat(muacCm) } : {}),
      ...(notes ? { notes } : {}),
      amendment_reason: reason,
    }),
    onSuccess: onDone,
  });

  return (
    <div style={overlay}>
      <div style={modal}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Amend Record — {target.child_name}</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
          Leave fields blank to keep current values.
        </p>
        {[
          ['Weight (kg)', weightKg, setWeightKg],
          ['Height (cm)', heightCm, setHeightCm],
          ['MUAC (cm)', muacCm, setMuacCm],
        ].map(([label, val, setter]) => (
          <div key={label as string} style={{ marginBottom: 10 }}>
            <label style={lbl}>{label as string}</label>
            <input
              type="number" step="0.1" value={val as string}
              onChange={e => (setter as (v: string) => void)(e.target.value)}
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        ))}
        <div style={{ marginBottom: 10 }}>
          <label style={lbl}>Notes</label>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            rows={2} style={{ ...inputStyle, resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Amendment reason <span style={{ color: 'var(--danger)' }}>*</span></label>
          <textarea
            value={reason} onChange={e => setReason(e.target.value)}
            rows={2} style={{ ...inputStyle, resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
            placeholder="Why is this record being amended?"
          />
        </div>
        {mut.isError && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 10px' }}>Amendment failed.</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnSecondary}>Cancel</button>
          <button
            onClick={() => mut.mutate()}
            disabled={!reason.trim() || mut.isPending}
            style={{
              background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8,
              padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              opacity: (!reason.trim() || mut.isPending) ? 0.5 : 1,
            }}
          >
            {mut.isPending ? 'Saving…' : 'Save Amendment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Row expanded details ──────────────────────────────────────────────────────

function RecordExpanded({ record }: { record: Record<string, unknown> }) {
  return (
    <tr>
      <td colSpan={8} style={{ padding: '10px 16px', background: 'color-mix(in srgb, var(--primary) 4%, var(--bg-elev))' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, fontSize: 12 }}>
          {[
            ['WHZ', record.weight_for_height_z],
            ['HAZ', record.height_for_age_z],
            ['WAZ', record.weight_for_age_z],
            ['BMI-Z', record.bmi_z],
            ['Temp (°C)', record.temperature_c],
            ['HR', record.heart_rate],
            ['RR', record.respiratory_rate],
            ['SpO₂', record.spo2],
            ['Oedema', record.oedema ? 'Yes' : 'No'],
          ].map(([label, val]) => (
            <div key={label as string}>
              <span style={{ color: 'var(--text-muted)' }}>{label as string}: </span>
              <strong>{val != null ? String(val) : '—'}</strong>
            </div>
          ))}
        </div>
        {Array.isArray(record.symptom_flags) && (record.symptom_flags as string[]).length > 0 && (
          <div style={{ marginTop: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Symptoms: </span>
            {(record.symptom_flags as string[]).map(s => (
              <span key={s} style={{
                fontSize: 11, border: '1px solid var(--warn)', color: 'var(--warn)',
                borderRadius: 6, padding: '1px 6px', marginRight: 4,
              }}>{s}</span>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const RISK_OPTIONS = ['', 'HIGH', 'MEDIUM', 'LOW'];
const NUT_OPTIONS  = ['', 'SAM', 'MAM', 'NORMAL'];

export default function AdminHealthRecordsPage() {
  const qc = useQueryClient();
  const [riskLevel, setRiskLevel] = useState('');
  const [nutritionStatus, setNutritionStatus] = useState('');
  const [camp, setCamp] = useState('');
  const [zone, setZone] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [amendTarget, setAmendTarget] = useState<AmendTarget | null>(null);

  const { data: camps } = useAdminCamps();
  const { data: zones } = useAdminZones(camp || null);
  const { data, isLoading, isError } = useHealthRecords({
    risk_level: riskLevel || undefined,
    nutrition_status: nutritionStatus || undefined,
    zone: zone || undefined,
    page,
  });

  const total = (data as { count?: number })?.count ?? 0;
  const records = (data as { results?: Record<string, unknown>[] })?.results ?? (Array.isArray(data) ? data as Record<string, unknown>[] : []);
  const totalPages = Math.ceil(total / 20);

  function invalidate() {
    qc.invalidateQueries({ queryKey: QK.healthRecords({}) });
    setAmendTarget(null);
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <ClipboardList size={22} />
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Health Records</h1>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 13 }}>{total} records</span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={riskLevel} onChange={e => { setRiskLevel(e.target.value); setPage(1); }} style={filterSelect}>
          <option value="">All risk levels</option>
          {RISK_OPTIONS.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={nutritionStatus} onChange={e => { setNutritionStatus(e.target.value); setPage(1); }} style={filterSelect}>
          <option value="">All nutrition</option>
          {NUT_OPTIONS.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={camp} onChange={e => { setCamp(e.target.value); setZone(''); setPage(1); }} style={filterSelect}>
          <option value="">All camps</option>
          {camps?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {zones && zones.length > 0 && (
          <select value={zone} onChange={e => { setZone(e.target.value); setPage(1); }} style={filterSelect}>
            <option value="">All zones</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : isError ? (
        <p style={{ color: 'var(--danger)' }}>Failed to load records.</p>
      ) : records.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          <ClipboardList size={36} style={{ marginBottom: 8, opacity: 0.4 }} />
          <p>No records found.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={th}></th>
                <th style={th}>Child</th>
                <th style={th}>Date</th>
                <th style={th}>Wt (kg)</th>
                <th style={th}>Ht (cm)</th>
                <th style={th}>MUAC</th>
                <th style={th}>Nutrition</th>
                <th style={th}>Risk</th>
                <th style={th}>Recorded by</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const id = r.id as string;
                const isExpanded = expandedId === id;
                return (
                  <>
                    <tr key={id} style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border)' }}>
                      <td style={{ ...td, width: 24, cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : id)}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td style={td}><span style={{ fontWeight: 600 }}>{r.child_name as string}</span></td>
                      <td style={td}>{new Date(r.measurement_date as string).toLocaleDateString()}</td>
                      <td style={td}>{r.weight_kg != null ? String(r.weight_kg) : '—'}</td>
                      <td style={td}>{r.height_cm != null ? String(r.height_cm) : '—'}</td>
                      <td style={td}>{r.muac_cm != null ? String(r.muac_cm) : '—'}</td>
                      <td style={td}><NutBadge status={r.nutrition_status as string | null} /></td>
                      <td style={td}><RiskBadge level={r.risk_level as string | null} /></td>
                      <td style={td}>{(r.recorded_by_name as string | null) ?? '—'}</td>
                      <td style={td}>
                        <button
                          onClick={() => setAmendTarget({ id, child_name: r.child_name as string })}
                          style={{
                            background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                            padding: '3px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--ink)',
                          }}
                        >
                          Amend
                        </button>
                      </td>
                    </tr>
                    {isExpanded && <RecordExpanded key={`${id}-detail`} record={r} />}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={btnSecondary}>← Prev</button>
          <span style={{ lineHeight: '32px', fontSize: 13 }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={btnSecondary}>Next →</button>
        </div>
      )}

      {amendTarget && (
        <AmendModal target={amendTarget} onDone={invalidate} onCancel={() => setAmendTarget(null)} />
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px',
  background: 'var(--bg-elev)', color: 'var(--ink)', fontSize: 13,
};
const filterSelect: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px',
  background: 'var(--bg-elev)', color: 'var(--ink)', fontSize: 13,
};
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 };
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontWeight: 600, fontSize: 12 };
const td: React.CSSProperties = { padding: '10px 10px', verticalAlign: 'middle' };
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 999,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modal: React.CSSProperties = {
  background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 12,
  padding: 24, width: 440, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto',
};
const btnSecondary: React.CSSProperties = {
  background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--ink)',
};
