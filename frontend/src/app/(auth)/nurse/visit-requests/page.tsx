'use client';

import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { useAdminVisitRequests } from '@/lib/api/queries';

function UrgencyBadge({ urgency }: { urgency: string }) {
  const map: Record<string, string> = { URGENT: 'var(--danger)', SOON: 'var(--warn)', ROUTINE: 'var(--success)' };
  const color = map[urgency] ?? 'var(--ink)';
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: `color-mix(in srgb, ${color} 14%, var(--bg-elev))`, color }}>
      {urgency}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { PENDING: 'var(--warn)', ACCEPTED: 'var(--primary)', DECLINED: 'var(--danger)', COMPLETED: 'var(--success)' };
  const color = map[status] ?? 'var(--ink)';
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: `color-mix(in srgb, ${color} 14%, var(--bg-elev))`, color }}>
      {status}
    </span>
  );
}

const STATUSES = ['', 'PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED'];

export default function NurseVisitRequestsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useAdminVisitRequests({ status: status || undefined, page });
  const total = data?.count ?? 0;
  const items = data?.results ?? [];
  const totalPages = Math.ceil(total / 50);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
          Visit Requests
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Parent-requested home visits in your camp · {total} total
        </p>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {STATUSES.map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }} style={{
            border: `1px solid ${status === s ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 20, padding: '5px 14px', cursor: 'pointer', fontSize: 13,
            background: status === s ? 'color-mix(in srgb, var(--primary) 10%, var(--bg-elev))' : 'var(--bg-elev)',
            color: status === s ? 'var(--primary)' : 'var(--ink)', fontWeight: status === s ? 600 : 400,
          }}>
            {s || 'All'}
          </button>
        ))}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {items.map(r => (
            <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-elev)', padding: 14 }}>
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
                <p style={{ fontSize: 13, margin: '0 0 8px', color: 'var(--ink)' }}>{r.concern_text}</p>
              )}

              {r.symptom_flags && r.symptom_flags.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                  {r.symptom_flags.map(s => (
                    <span key={s} style={{ fontSize: 11, border: '1px solid var(--warn)', color: 'var(--warn)', borderRadius: 6, padding: '1px 6px' }}>{s}</span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <span>CHW: {r.assigned_chw_name ?? 'Unassigned'}</span>
                {r.eta && <span>ETA: {new Date(r.eta).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
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

const btnSec: React.CSSProperties = {
  background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--ink)',
};
