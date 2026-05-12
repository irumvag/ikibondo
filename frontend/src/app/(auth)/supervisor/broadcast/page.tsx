'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, CheckCircle2, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/store/authStore';
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
}): Promise<{ message: string; data: Broadcast }> {
  const { data } = await apiClient.post('/notifications/broadcasts/', payload);
  return data;
}

const SCOPE_LABELS: Record<string, string> = {
  CAMP: 'Entire camp', ZONE: 'Zone', ROLE: 'By role',
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

export default function SupervisorBroadcastPage() {
  const qc   = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // Supervisor can only broadcast within their camp — default scope is CAMP
  const [scopeType, setScopeType] = useState('CAMP');
  const [scopeId,   setScopeId]   = useState(user?.camp ?? '');
  const [channel,   setChannel]   = useState<'SMS' | 'PUSH'>('PUSH');
  const [body,      setBody]       = useState('');
  const [sent,      setSent]       = useState(false);
  const [sentMsg,   setSentMsg]    = useState('');

  const { data: broadcasts = [], isLoading } = useQuery({
    queryKey: ['supervisor', 'broadcasts'],
    queryFn: listBroadcasts,
    staleTime: 30_000,
  });

  const sendMut = useMutation({
    mutationFn: sendBroadcast,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['supervisor', 'broadcasts'] });
      setBody('');
      setSentMsg(res.message ?? 'Broadcast sent successfully.');
      setSent(true);
      setTimeout(() => setSent(false), 5000);
    },
  });

  const handleScopeType = (v: string) => {
    setScopeType(v);
    // Auto-fill camp when switching back to CAMP
    setScopeId(v === 'CAMP' ? (user?.camp ?? '') : '');
  };

  const canSend = body.trim().length >= 5 && scopeId.trim().length > 0;

  const handleSend = () => {
    sendMut.mutate({ scope_type: scopeType, scope_id: scopeId, channel, body: body.trim() });
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Broadcast
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Send push or SMS notifications to staff and parents in your camp.
        </p>
      </div>

      {/* Compose */}
      <div
        className="rounded-2xl border p-6 flex flex-col gap-5"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>New broadcast</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Audience</label>
            <select value={scopeType} onChange={(e) => handleScopeType(e.target.value)} style={inputStyle}>
              {Object.entries(SCOPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Channel</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value as 'SMS' | 'PUSH')} style={inputStyle}>
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
              {['CHW', 'NURSE', 'PARENT'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}

        {scopeType === 'ZONE' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Zone ID</label>
            <input
              type="text"
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              placeholder="Enter zone UUID…"
              style={inputStyle}
            />
          </div>
        )}

        {scopeType === 'CAMP' && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            All users in your camp will receive this message.
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            Message <span style={{ fontWeight: 400 }}>({body.length}/500)</span>
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

        {sendMut.isError && (
          <div
            className="flex items-center gap-2 p-3 rounded-xl text-sm"
            style={{ backgroundColor: 'color-mix(in srgb, var(--danger) 8%, var(--bg-elev))', color: 'var(--danger)', border: '1px solid var(--danger)' }}
          >
            <AlertTriangle size={14} />
            {(sendMut.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to send. Please try again.'}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            loading={sendMut.isPending}
            disabled={!canSend}
            onClick={handleSend}
          >
            <Megaphone size={14} className="mr-1.5" />
            Send broadcast
          </Button>
          {sent && (
            <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--success)' }}>
              <CheckCircle2 size={15} /> {sentMsg}
            </span>
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
