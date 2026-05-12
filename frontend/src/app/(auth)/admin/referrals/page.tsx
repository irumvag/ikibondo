'use client';

import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { GitBranch, CheckCircle } from 'lucide-react';
import { useAdminReferrals, useAdminCamps, QK } from '@/lib/api/queries';
import { completeReferral } from '@/lib/api/admin';
import type { AdminReferral } from '@/lib/api/admin';

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING:   'var(--warn)',
    COMPLETED: 'var(--success)',
    CANCELLED: 'var(--text-muted)',
  };
  const color = map[status] ?? 'var(--ink)';
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
      background: `color-mix(in srgb, ${color} 14%, var(--bg-elev))`,
      color,
    }}>
      {status}
    </span>
  );
}

// ── Complete modal ────────────────────────────────────────────────────────────

function CompleteModal({
  referral, onDone, onCancel,
}: { referral: AdminReferral; onDone: () => void; onCancel: () => void }) {
  const [outcome, setOutcome] = useState('');
  const mut = useMutation({
    mutationFn: () => completeReferral(referral.id, outcome),
    onSuccess: onDone,
  });
  return (
    <div style={overlay}>
      <div style={modal}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Complete Referral — {referral.child_name}</h3>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-muted)' }}>
          Facility: <strong style={{ color: 'var(--ink)' }}>{referral.target_facility}</strong>
        </p>
        <label style={lbl}>Outcome notes (required)</label>
        <textarea
          value={outcome}
          onChange={e => setOutcome(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
          placeholder="Describe the referral outcome…"
        />
        {mut.isError && (
          <p style={{ color: 'var(--danger)', fontSize: 13, margin: '6px 0 0' }}>Failed to complete referral.</p>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnSecondary}>Cancel</button>
          <button
            onClick={() => mut.mutate()}
            disabled={!outcome.trim() || mut.isPending}
            style={{
              background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8,
              padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              opacity: (!outcome.trim() || mut.isPending) ? 0.5 : 1,
            }}
          >
            <CheckCircle size={14} style={{ marginRight: 5, verticalAlign: 'middle' }} />
            {mut.isPending ? 'Saving…' : 'Mark Complete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const STATUSES = ['', 'PENDING', 'COMPLETED', 'CANCELLED'];

export default function AdminReferralsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [camp, setCamp] = useState('');
  const [page, setPage] = useState(1);
  const [completeTarget, setCompleteTarget] = useState<AdminReferral | null>(null);

  const { data: camps } = useAdminCamps();
  const { data, isLoading, isError } = useAdminReferrals({
    status: status || undefined,
    camp: camp || undefined,
    page,
  });

  const total = data?.count ?? 0;
  const items = data?.results ?? [];
  const totalPages = Math.ceil(total / 20);

  function invalidate() {
    qc.invalidateQueries({ queryKey: QK.adminReferrals() });
    setCompleteTarget(null);
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <GitBranch size={22} />
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Referrals</h1>
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

      {/* Table */}
      {isLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : isError ? (
        <p style={{ color: 'var(--danger)' }}>Failed to load referrals.</p>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          <GitBranch size={36} style={{ marginBottom: 8, opacity: 0.4 }} />
          <p>No referrals found.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={th}>Child</th>
                <th style={th}>Referred by</th>
                <th style={th}>Facility</th>
                <th style={th}>Reason</th>
                <th style={th}>Status</th>
                <th style={th}>Date</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={td}><span style={{ fontWeight: 600 }}>{r.child_name}</span></td>
                  <td style={td}>{r.referred_by_name ?? '—'}</td>
                  <td style={td}>{r.target_facility}</td>
                  <td style={{ ...td, maxWidth: 200 }}>
                    <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {r.reason}
                    </span>
                  </td>
                  <td style={td}><StatusBadge status={r.status} /></td>
                  <td style={td}>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td style={td}>
                    {r.status === 'PENDING' && (
                      <button
                        onClick={() => setCompleteTarget(r)}
                        style={{
                          background: 'none', border: '1px solid var(--success)', color: 'var(--success)',
                          borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 12,
                        }}
                      >
                        Complete
                      </button>
                    )}
                    {r.outcome && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }} title={r.outcome}>
                        Outcome logged
                      </span>
                    )}
                  </td>
                </tr>
              ))}
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

      {completeTarget && (
        <CompleteModal referral={completeTarget} onDone={invalidate} onCancel={() => setCompleteTarget(null)} />
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
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
  padding: 24, width: 420, maxWidth: '90vw',
};
const btnSecondary: React.CSSProperties = {
  background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--ink)',
};
