'use client';

import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Inbox, Send, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAdminConsultations, QK } from '@/lib/api/queries';
import { replyConsultation, resolveConsultation, disputeConsultation } from '@/lib/api/admin';
import type { Consultation } from '@/lib/api/admin';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: 'var(--primary)', ESCALATED: 'var(--warn)', RESOLVED: 'var(--success)',
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

function ConsultationCard({ c, onRefresh }: { c: Consultation; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState('');

  const replyMut   = useMutation({ mutationFn: () => replyConsultation(c.id, replyText),   onSuccess: () => { setReplyText(''); onRefresh(); } });
  const resolveMut = useMutation({ mutationFn: () => resolveConsultation(c.id),            onSuccess: onRefresh });
  const disputeMut = useMutation({ mutationFn: () => disputeConsultation(c.id),            onSuccess: onRefresh });

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-elev)', marginBottom: 12 }}>
      <div onClick={() => setExpanded(x => !x)} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{c.child_name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            By {c.opened_by_name ?? 'Unknown'} · {new Date(c.opened_at).toLocaleDateString()}
            {c.disputed_ai && <span style={{ marginLeft: 8, color: 'var(--warn)', fontWeight: 600 }}>⚠ AI disputed</span>}
          </div>
        </div>
        <StatusBadge status={c.status} />
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
          {c.messages && c.messages.length > 0 && (
            <div style={{ margin: '12px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {c.messages.map(m => (
                <div key={m.id} style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                  <strong style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.author_name ?? 'Unknown'}</strong>
                  <p style={{ margin: '4px 0 0' }}>{m.body}</p>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(m.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {c.status !== 'RESOLVED' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'flex-end' }}>
              <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply…" rows={2}
                style={{ flex: 1, resize: 'vertical', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 13, background: 'var(--bg-elev)', color: 'var(--ink)' }} />
              <button onClick={() => replyMut.mutate()} disabled={!replyText.trim() || replyMut.isPending}
                style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, opacity: (!replyText.trim() || replyMut.isPending) ? 0.5 : 1 }}>
                <Send size={14} /> Reply
              </button>
            </div>
          )}

          {c.status !== 'RESOLVED' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => resolveMut.mutate()} disabled={resolveMut.isPending}
                style={{ background: 'none', border: '1px solid var(--success)', color: 'var(--success)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                <CheckCircle size={13} /> Resolve
              </button>
              {!c.disputed_ai && (
                <button onClick={() => disputeMut.mutate()} disabled={disputeMut.isPending}
                  style={{ background: 'none', border: '1px solid var(--warn)', color: 'var(--warn)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <AlertTriangle size={13} /> Dispute AI
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const STATUSES = ['', 'OPEN', 'ESCALATED', 'RESOLVED'];
const STATUS_LABELS: Record<string, string> = { '': 'All', OPEN: 'Open', ESCALATED: 'Escalated', RESOLVED: 'Resolved' };

export default function SupervisorConsultationsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useAdminConsultations({ status: status || undefined, page });
  const total = data?.count ?? 0;
  const items = data?.results ?? [];
  const totalPages = Math.ceil(total / 20);

  const onRefresh = () => qc.invalidateQueries({ queryKey: QK.adminConsultations() });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
          Consultations
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          CHW ↔ Nurse threads in your camp · {total} total
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {STATUSES.map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }} style={{
            border: `1px solid ${status === s ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 20, padding: '5px 14px', cursor: 'pointer', fontSize: 13,
            background: status === s ? 'color-mix(in srgb, var(--primary) 10%, var(--bg-elev))' : 'var(--bg-elev)',
            color: status === s ? 'var(--primary)' : 'var(--ink)', fontWeight: status === s ? 600 : 400,
          }}>
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : isError ? (
        <p style={{ color: 'var(--danger)' }}>Failed to load consultations.</p>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          <Inbox size={36} style={{ marginBottom: 8, opacity: 0.4 }} />
          <p>No consultations found.</p>
        </div>
      ) : (
        items.map(c => <ConsultationCard key={c.id} c={c} onRefresh={onRefresh} />)
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

const btnSec: React.CSSProperties = {
  background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--ink)',
};
