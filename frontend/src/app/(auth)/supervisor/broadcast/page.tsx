'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, CheckCircle2, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/store/authStore';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';

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

// Text: messages/en.json supervisor.broadcast.scope.<code>
const SCOPES = ['CAMP', 'ZONE', 'ROLE'] as const;

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
  const t = useTranslations('supervisor.broadcast');
  const toast = useToast();
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
      toast.success(t('broadcastSent'));
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
        >{t('broadcast')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('sendPushOrSms')}</p>
      </div>

      {/* Compose */}
      <div
        className="rounded-2xl border p-6 flex flex-col gap-5"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{t('newBroadcast')}</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="broadcast-audience" className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('audience')}</label>
            <select id="broadcast-audience" value={scopeType} onChange={(e) => handleScopeType(e.target.value)} style={inputStyle}>
              {SCOPES.map((k) => (
                <option key={k} value={k}>{t(`scope.${k}`)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="broadcast-channel" className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('channel')}</label>
            <select id="broadcast-channel" value={channel} onChange={(e) => setChannel(e.target.value as 'SMS' | 'PUSH')} style={inputStyle}>
              <option value="PUSH">{t('pushNotification')}</option>
              <option value="SMS">SMS</option>
            </select>
          </div>
        </div>

        {scopeType === 'ROLE' && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="broadcast-role" className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('role')}</label>
            <select id="broadcast-role" value={scopeId} onChange={(e) => setScopeId(e.target.value)} style={inputStyle}>
              <option value="">{t('selectRole')}</option>
              {['CHW', 'NURSE', 'PARENT'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}

        {scopeType === 'ZONE' && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="broadcast-zone-id" className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('zoneId')}</label>
            <input id="broadcast-zone-id"
              type="text"
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              placeholder={t('enterZoneUuid')}
              style={inputStyle}
            />
          </div>
        )}

        {scopeType === 'CAMP' && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('allUsersInYour')}</p>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="broadcast-message-500" className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('message')}{' '}<span style={{ fontWeight: 400 }}>({body.length}/500)</span>
          </label>
          <textarea id="broadcast-message-500"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder={t('typeYourBroadcastMessage')}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {sendMut.isError && (
          <div
            className="flex items-center gap-2 p-3 rounded-xl text-sm"
            style={{ backgroundColor: 'color-mix(in srgb, var(--danger) 8%, var(--bg-elev))', color: 'var(--danger)', border: '1px solid var(--danger)' }}
          >
            <AlertTriangle size={14} />
            {(sendMut.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('failedToSendPlease')}
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
            <Megaphone size={14} className="mr-1.5" />{t('sendBroadcast')}</Button>
          {sent && (
            <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--success)' }}>
              <CheckCircle2 size={15} /> {sentMsg}
            </span>
          )}
        </div>
      </div>

      {/* History */}
      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{t('sentBroadcasts')}</h3>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : broadcasts.length === 0 ? (
          <div
            className="rounded-2xl border px-6 py-10 text-center"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('noBroadcastsSentYet')}</p>
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
                    {(SCOPES as readonly string[]).includes(b.scope_type) ? t(`scope.${b.scope_type as (typeof SCOPES)[number]}`) : b.scope_type}
                    {' · '}{b.channel}
                    {' · '}{t('recipients', { count: b.delivery_count })}
                    {' · '}{b.sent_at ? new Date(b.sent_at).toLocaleString() : t('pendingSend')}
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
