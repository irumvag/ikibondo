'use client';

import { useState } from 'react';
import { ClipboardList, ChevronRight, ChevronDown } from 'lucide-react';
import { useHealthRecords, useAdminZones } from '@/lib/api/queries';
import { useAuthStore } from '@/store/authStore';

function RiskBadge({ level }: { level: string | null }) {
  if (!level) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const map: Record<string, string> = { HIGH: 'var(--danger)', MEDIUM: 'var(--warn)', LOW: 'var(--success)' };
  const color = map[level] ?? 'var(--ink)';
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: `color-mix(in srgb, ${color} 12%, var(--bg-elev))`, color }}>{level}</span>;
}

function NutBadge({ status }: { status: string | null }) {
  if (!status) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const map: Record<string, string> = { SAM: 'var(--danger)', MAM: 'var(--warn)', NORMAL: 'var(--success)' };
  const color = map[status] ?? 'var(--ink)';
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: `color-mix(in srgb, ${color} 12%, var(--bg-elev))`, color }}>{status}</span>;
}

function RecordExpanded({ record }: { record: Record<string, unknown> }) {
  return (
    <tr>
      <td colSpan={9} style={{ padding: '10px 16px', background: 'color-mix(in srgb, var(--primary) 4%, var(--bg-elev))', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, fontSize: 12 }}>
          {[
            ['WHZ', record.weight_for_height_z], ['HAZ', record.height_for_age_z],
            ['WAZ', record.weight_for_age_z], ['BMI-Z', record.bmi_z],
            ['Temp °C', record.temperature_c], ['HR', record.heart_rate],
            ['RR', record.respiratory_rate], ['SpO₂', record.spo2],
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
              <span key={s} style={{ fontSize: 11, border: '1px solid var(--warn)', color: 'var(--warn)', borderRadius: 6, padding: '1px 6px', marginRight: 4 }}>{s}</span>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}

const RISK_OPTIONS = ['', 'HIGH', 'MEDIUM', 'LOW'];
const NUT_OPTIONS  = ['', 'SAM', 'MAM', 'NORMAL'];

export default function SupervisorHealthRecordsPage() {
  const user = useAuthStore(s => s.user);
  const campId = user?.camp ?? null;
  const [riskLevel, setRiskLevel] = useState('');
  const [nutritionStatus, setNutritionStatus] = useState('');
  const [zone, setZone] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: zones } = useAdminZones(campId);
  const { data, isLoading, isError } = useHealthRecords({
    risk_level: riskLevel || undefined,
    nutrition_status: nutritionStatus || undefined,
    zone: zone || undefined,
    page,
  });

  const total = (data as { count?: number })?.count ?? 0;
  const records = (data as { results?: Record<string, unknown>[] })?.results ?? (Array.isArray(data) ? data as Record<string, unknown>[] : []);
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
          Health Records
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{total} records in your camp</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <select value={riskLevel} onChange={e => { setRiskLevel(e.target.value); setPage(1); }} style={filterSt}>
          <option value="">All risk levels</option>
          {RISK_OPTIONS.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={nutritionStatus} onChange={e => { setNutritionStatus(e.target.value); setPage(1); }} style={filterSt}>
          <option value="">All nutrition</option>
          {NUT_OPTIONS.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={zone} onChange={e => { setZone(e.target.value); setPage(1); }} style={filterSt}>
          <option value="">All zones</option>
          {(zones ?? []).map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
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
                {['', 'Child', 'Date', 'Wt (kg)', 'Ht (cm)', 'MUAC', 'Nutrition', 'Risk', 'Recorded by'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
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
                    </tr>
                    {isExpanded && <RecordExpanded key={`${id}-exp`} record={r} />}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={btnSec}>← Prev</button>
          <span style={{ lineHeight: '32px', fontSize: 13 }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={btnSec}>Next →</button>
        </div>
      )}
    </div>
  );
}

const filterSt: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', background: 'var(--bg-elev)', color: 'var(--ink)', fontSize: 13 };
const td: React.CSSProperties = { padding: '10px 10px', verticalAlign: 'middle' };
const btnSec: React.CSSProperties = { background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--ink)' };
