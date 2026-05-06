'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Loader2, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/store/authStore';
import { Skeleton } from '@/components/ui/Skeleton';

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
  CAMP: 'Entire camp', ZONE: 'Zone', ROLE: 'By role', GLOBAL: 'All users',
};

export default function SupervisorBroadcastPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [scopeType, setScopeType] = useState('CAMP');
  const [scopeId, setScopeId] = useState(user?.camp ?? '');
  const [channel, setChannel] = useState<'SMS' | 'PUSH'>('PUSH');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState(false);

  const { data: broadcasts = [], isLoading } = useQuery({
    queryKey: ['supervisor', 'broadcasts'],
    queryFn: listBroadcasts,
  });

  const sendMut = useMutation({
    mutationFn: sendBroadcast,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supervisor', 'broadcasts'] });
      setBody('');
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    },
  });

  const canSend = body.trim().length >= 5;

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Broadcast</h1>
        <p className="mt-1 text-sm text-gray-500">Send push or SMS notifications to staff and parents in your camp.</p>
      </div>

      {/* Compose */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
        <h2 className="text-base font-semibold text-gray-900">New broadcast</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
            <select
              value={scopeType}
              onChange={(e) => { setScopeType(e.target.value); if (e.target.value === 'CAMP') setScopeId(user?.camp ?? ''); else setScopeId(''); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {Object.entries(SCOPE_LABELS).filter(([k]) => k !== 'GLOBAL').map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value as 'SMS' | 'PUSH')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="PUSH">Push notification</option>
              <option value="SMS">SMS</option>
            </select>
          </div>
        </div>

        {scopeType === 'ROLE' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select value={scopeId} onChange={(e) => setScopeId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select role…</option>
              {['CHW', 'NURSE', 'PARENT'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Type your message (max 500 characters)…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{body.length}/500</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => sendMut.mutate({ scope_type: scopeType, scope_id: scopeId, channel, body })}
            disabled={sendMut.isPending || !canSend}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
            Send broadcast
          </button>
          {sent && (
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Sent successfully
            </span>
          )}
        </div>
      </div>

      {/* History */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Sent broadcasts</h2>
        {isLoading ? (
          <div className="flex flex-col gap-2">{[1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        ) : broadcasts.length === 0 ? (
          <p className="text-sm text-gray-400">No broadcasts sent yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {broadcasts.map((b) => (
              <div key={b.id} className="rounded-xl border border-gray-200 bg-white px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{b.body}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {SCOPE_LABELS[b.scope_type]} · {b.channel} · {b.delivery_count} recipients · {b.sent_at ? new Date(b.sent_at).toLocaleString() : 'pending'}
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
