'use client';

import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { useAdminVisitRequests, useAdminCamps } from '@/lib/api/queries';

// ── Badges ────────────────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }: { urgency: string }) {
  const map: Record<string, string> = {
    URGENT:  'var(--danger)',
    SOON:    'var(--warn)',
    ROUTINE: 'var(--success)',
  };
  const color = map[urgency] ?? 'var(--ink)';
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
      background: `color-mix(in srgb, ${color} 14%, var(--bg-elev))`, color,
    }}>
      {urgency}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING:   'var(--warn)',
    ACCEPTED:  'var(--primary)',
    DECLINED:  'var(--danger)',
    COMPLETED: 'var(--success)',
  };
  const color = map[status] ?? 'var(--ink)';
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
      background: `color-mix(in srgb, ${color} 14%, var(--bg-elev))`, color,
    }}>
      {status}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const STATUSES = ['', 'PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED'];

export default function AdminVisitRequestsPage() {
  const [status, setStatus] = useState('');
  const [camp, setCamp] = useState('');
  const [page, setPage] = useState(1);

  const { data: camps } = useAdminCamps();
  const { data, isLoading, isError } = useAdminVisitRequests({
    status: status || undefined,
    camp: camp || undefined,
    page,
  });

  const total = data?.count ?? 0;
  const items = data?.results ?? [];
  const totalPages = Math.ceil(total / 50);

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <ClipboardCheck size={22} />
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Visit Requests</h1>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 13 }}>{total} total</span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            style={{
              border: `1px solid ${status === s ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 20, padding: '5px 14px', cursor: 'pointer', fontSize: 13,
              background: status === s ? 'color-mix(in srgb, var(--primary) 10%, var(--bg-elev))' : 'var(--bg-elev)',
              color: status === s ? 'var(--primary)' : 'var(--ink)', fontWeight: status === s ? 600 : 400,
            }}
          >
            {s || 'All'}
          </button>
        ))}
        <select
          value={camp}
          onChange={e => { setCamp(e.target.value); setPage(1); }}
          style={{ marginLeft: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', background: 'var(--bg-elev)', color: 'var(--ink)', fontSize: 13 }}
        >
          <option value="">All camps</option>
          {camps?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Cards */}
      {isLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : isError ? (
        <p style={{ color: 'var(--danger)' }}>Failed to load visit requests.</p>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          <ClipboardCheck size={36} style={{ marginBottom: 8, opacity: 0.4 }} />
          <p>No visit requests found.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {items.map(r => (
            <div key={r.id} style={{
              border: '1px solid var(--border)', borderRadius: 10,
              background: 'var(--bg-elev)', padding: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.child_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    By {r.requested_by_name ?? 'Unknown'} · {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <UrgencyBadge urgency={r.urgency} />
                  <StatusBadge status={r.status} />
                </div>
              </div>

              {r.concern_text && (
                <p style={{ fontSize: 13, margin: '0 0 8px', color: 'var(--ink)' }}>
                  {r.concern_text}
                </p>
              )}

              {r.symptom_flags && r.symptom_flags.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                  {r.symptom_flags.map(s => (
                    <span key={s} style={{
                      fontSize: 11, border: '1px solid var(--warn)', color: 'var(--warn)',
                      borderRadius: 6, padding: '1px 6px',
                    }}>{s}</span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                <span>CHW: {r.assigned_chw_name ?? 'Unassigned'}</span>
                {r.eta && <span>ETA: {new Date(r.eta).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
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
    </div>
  );
}

const btnSecondary: React.CSSProperties = {
  background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--ink)',
};
