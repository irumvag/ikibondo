'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';

interface Broadcast {
  id: string;
  scope_type: string;
  scope_id: string;
  channel: 'SMS' | 'PUSH';
  body: string;
  sent_at: string | null;
  delivery_count: number;
  created_at: string;
}

async function listBroadcasts(): Promise<Broadcast[]> {
  const { data } = await apiClient.get('/notifications/broadcasts/');
  return data.data ?? data.results ?? [];
}

async function sendBroadcast(payload: {
  scope_type: string; scope_id: string; channel: string; body: string;
}): Promise<Broadcast> {
  const { data } = await apiClient.post('/notifications/broadcasts/', payload);
  return data.data;
}

const SCOPE_LABELS: Record<string, string> = {
  CAMP: 'Specific camp', ZONE: 'Zone', ROLE: 'By role', GLOBAL: 'All users (global)',
};

const inputStyle = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  borderRadius: '0.75rem',
  border: '1px solid var(--border)',
  backgroundColor: 'var(--bg)',
  color: 'var(--ink)',
  fontSize: '0.875rem',
  outline: 'none',
};

export default function AdminBroadcastsPage() {
  const qc = useQueryClient();

  const [scopeType, setScopeType] = useState('GLOBAL');
  const [scopeId, setScopeId] = useState('');
  const [channel, setChannel] = useState<'SMS' | 'PUSH'>('PUSH');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState(false);

  const { data: broadcasts = [], isLoading } = useQuery({
    queryKey: ['admin', 'broadcasts'],
    queryFn: listBroadcasts,
    staleTime: 30_000,
  });

  const sendMut = useMutation({
    mutationFn: sendBroadcast,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'broadcasts'] });
      setBody('');
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    },
  });

  const canSend = body.trim().length >= 5 && (scopeType === 'GLOBAL' || scopeId.trim().length > 0);

  const handleScopeType = (v: string) => {
    setScopeType(v);
    setScopeId('');
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Broadcasts
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Send push or SMS notifications to any group of users across all camps.
        </p>
      </div>

      {/* Compose card */}
      <div
        className="rounded-2xl border p-6 flex flex-col gap-5"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>New broadcast</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Audience</label>
            <select
              value={scopeType}
              onChange={(e) => handleScopeType(e.target.value)}
              style={inputStyle}
            >
              {Object.entries(SCOPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Channel</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as 'SMS' | 'PUSH')}
              style={inputStyle}
            >
              <option value="PUSH">Push notification</option>
              <option value="SMS">SMS</option>
            </select>
          </div>
        </div>

        {scopeType === 'ROLE' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Role</label>
            <select value={scopeId} onChange={(e) => setScopeId(e.target.value)} style={inputStyle}>
              <option value="">Select role…</option>
              {['CHW', 'NURSE', 'SUPERVISOR', 'PARENT'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}

        {(scopeType === 'CAMP' || scopeType === 'ZONE') && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              {scopeType === 'CAMP' ? 'Camp ID' : 'Zone ID'}
            </label>
            <input
              type="text"
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              placeholder={scopeType === 'CAMP' ? 'Enter camp UUID…' : 'Enter zone UUID…'}
              style={inputStyle}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            Message <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({body.length}/500)</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Type your broadcast message (min 5 characters)…"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            loading={sendMut.isPending}
            disabled={!canSend}
            onClick={() => sendMut.mutate({ scope_type: scopeType, scope_id: scopeId, channel, body })}
          >
            <Megaphone size={14} className="mr-1.5" />
            Send broadcast
          </Button>
          {sent && (
            <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--success)' }}>
              <CheckCircle2 size={15} /> Sent successfully
            </span>
          )}
          {sendMut.isError && (
            <span className="text-sm" style={{ color: 'var(--danger)' }}>Failed to send. Please try again.</span>
          )}
        </div>
      </div>

      {/* History */}
      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>Sent broadcasts</h3>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : broadcasts.length === 0 ? (
          <div
            className="rounded-2xl border px-6 py-10 text-center"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No broadcasts sent yet.</p>
          </div>
        ) : (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
          >
            {broadcasts.map((b) => (
              <div
                key={b.id}
                className="px-5 py-4 border-b last:border-b-0 flex items-start gap-3"
                style={{ borderColor: 'var(--border)' }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: 'var(--bg-sand)' }}
                >
                  <Megaphone size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: 'var(--ink)' }}>{b.body}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {SCOPE_LABELS[b.scope_type] ?? b.scope_type}
                    {b.scope_id ? ` · ${b.scope_id}` : ''}
                    {' · '}{b.channel}
                    {' · '}{b.delivery_count} recipient{b.delivery_count !== 1 ? 's' : ''}
                    {' · '}{b.sent_at ? new Date(b.sent_at).toLocaleString() : 'pending'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
