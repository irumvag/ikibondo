'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Loader2,
  MapPin, Phone, User, CalendarDays, MessageSquare,
} from 'lucide-react';
import {
  listCHWVisitRequests, acceptVisitRequest, declineVisitRequest, completeVisitRequest,
  type CHWVisitRequest, type VisitRequestStatus,
} from '@/lib/api/chw';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';

// Tab and urgency names: messages/en.json chw.requests.status.<KEY> / urgency.<URGENCY>
const STATUS_TABS: { key: VisitRequestStatus | 'ALL' }[] = [
  { key: 'ALL' },
  { key: 'PENDING' },
  { key: 'ACCEPTED' },
  { key: 'COMPLETED' },
  { key: 'DECLINED' },
];

const URGENCY_META = {
  URGENT:  { variant: 'danger'  as const },
  SOON:    { variant: 'warn'    as const },
  ROUTINE: { variant: 'default' as const },
};

const STATUS_META = {
  PENDING:   { variant: 'warn'    as const },
  ACCEPTED:  { variant: 'info'    as const },
  COMPLETED: { variant: 'success' as const },
  DECLINED:  { variant: 'danger'  as const },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CHWRequestsPage() {
  const t = useTranslations('chw.requests');
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab]                 = useState<VisitRequestStatus | 'ALL'>('PENDING');
  const [declineId, setDeclineId]     = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['chw', 'visit-requests'],
    queryFn: () => listCHWVisitRequests(),
    refetchInterval: 30_000,
  });

  const filtered = tab === 'ALL' ? requests : requests.filter((r) => r.status === tab);

  const acceptMut = useMutation({
    mutationFn: ({ id, eta }: { id: string; eta?: string }) => acceptVisitRequest(id, eta),
    onSuccess: () => { toast.success(t('visitAcceptedTheFamily')); qc.invalidateQueries({ queryKey: ['chw', 'visit-requests'] }); },
  });

  const declineMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => declineVisitRequest(id, reason),
    onSuccess: () => {
      toast.success(t('requestDeclined'));
      qc.invalidateQueries({ queryKey: ['chw', 'visit-requests'] });
      setDeclineId(null);
      setDeclineReason('');
    },
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => completeVisitRequest(id),
    onSuccess: () => { toast.success(t('visitMarkedComplete')); qc.invalidateQueries({ queryKey: ['chw', 'visit-requests'] }); },
  });

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>{t('visitRequests')}</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('homeVisitRequestsFrom')}</p>
        </div>
        {pendingCount > 0 && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium shrink-0"
            style={{ background: '#fef2f2', color: 'var(--danger)' }}
          >
            <AlertTriangle size={14} />{t('pending', { pendingCount: pendingCount })}</div>
        )}
      </div>

      {/* Status tab bar */}
      <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {STATUS_TABS.map(({ key }) => {
          const count = key === 'ALL' ? requests.length : requests.filter((r) => r.status === key).length;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap"
              style={{
                borderColor: tab === key ? 'var(--ink)' : 'transparent',
                color:       tab === key ? 'var(--ink)' : 'var(--text-muted)',
              }}
            >
              {t(`status.${key}`)}
              {count > 0 && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                  style={{
                    background: tab === key ? 'var(--ink)' : 'var(--border)',
                    color:      tab === key ? 'var(--bg)' : 'var(--text-muted)',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Clock size={28} />}
          title={t('noRequests')}
          description={t(`empty.${tab}`)}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((vr) => (
            <RequestCard
              key={vr.id}
              vr={vr}
              onAccept={() => acceptMut.mutate({ id: vr.id })}
              onDecline={() => setDeclineId(vr.id)}
              onComplete={() => completeMut.mutate(vr.id)}
              isAccepting={acceptMut.isPending && acceptMut.variables?.id === vr.id}
              isCompleting={completeMut.isPending && completeMut.variables === vr.id}
            />
          ))}
        </div>
      )}

      {/* Decline modal */}
      {declineId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setDeclineId(null); setDeclineReason(''); } }}
        >
          <div
            className="rounded-2xl border w-full max-w-sm p-6 flex flex-col gap-4"
            style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}
          >
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>{t('declineRequest')}</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('provideAReasonSo')}</p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
              placeholder={t('reasonForDeclining')}
              className="w-full rounded-xl border px-3 py-2 text-sm resize-none outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--ink)' }}
            />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => { setDeclineId(null); setDeclineReason(''); }}>{t('cancel')}</Button>
              <button
                onClick={() => declineMut.mutate({ id: declineId, reason: declineReason })}
                disabled={declineMut.isPending || !declineReason.trim()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-medium px-3 py-2 transition-opacity disabled:opacity-50"
                style={{ background: 'var(--danger)', color: '#fff' }}
              >
                {declineMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t('decline')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestCard({
  vr, onAccept, onDecline, onComplete, isAccepting, isCompleting,
}: {
  vr: CHWVisitRequest;
  onAccept: () => void;
  onDecline: () => void;
  onComplete: () => void;
  isAccepting: boolean;
  isCompleting: boolean;
}) {
  const t = useTranslations('chw.requests');
  const urgency = vr.urgency in URGENCY_META ? vr.urgency : 'ROUTINE';
  const urgencyMeta = URGENCY_META[urgency];
  const statusMeta  = STATUS_META[vr.status]   ?? STATUS_META.PENDING;

  return (
    <div
      className="rounded-xl border flex flex-col gap-3 p-4"
      style={{ background: 'var(--card)', borderColor: vr.urgency === 'URGENT' ? 'var(--danger)' : 'var(--border)' }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{vr.child_name}</p>
          <Badge variant={urgencyMeta.variant}>
            {vr.urgency === 'URGENT' && <AlertTriangle size={10} className="mr-0.5" />}
            {t(`urgency.${urgency}`)}
          </Badge>
          <Badge variant={statusMeta.variant}>{vr.status}</Badge>
        </div>
        <span className="text-xs shrink-0 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
          <CalendarDays size={11} />
          {fmtDate(vr.created_at)}
        </span>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        {vr.requested_by_name && (
          <span className="flex items-center gap-1">
            <User size={11} />
            {vr.requested_by_name}
          </span>
        )}
        {vr.assigned_chw_name && (
          <span className="flex items-center gap-1">
            <MapPin size={11} />{t('chw', { assigned_chw_name: vr.assigned_chw_name })}</span>
        )}
        {vr.eta && (
          <span className="flex items-center gap-1">
            <Clock size={11} />{t('eta', { value: new Date(vr.eta).toLocaleString() })}</span>
        )}
      </div>

      {/* Symptoms */}
      {vr.symptom_flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {vr.symptom_flags.map((s) => (
            <span
              key={s}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Concern text */}
      {vr.concern_text && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
          style={{ background: 'var(--bg)', color: 'var(--ink)' }}
        >
          <MessageSquare size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
          {vr.concern_text}
        </div>
      )}

      {/* Decline reason */}
      {vr.status === 'DECLINED' && vr.decline_reason && (
        <p
          className="text-xs px-3 py-2 rounded-lg"
          style={{ background: '#fef2f2', color: 'var(--danger)' }}
        >{t('declined', { decline_reason: vr.decline_reason })}</p>
      )}

      {/* Actions */}
      {vr.status === 'PENDING' && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={onDecline}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2 text-sm transition-colors hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <XCircle size={14} />{' '}{t('decline')}</button>
          <button
            onClick={onAccept}
            disabled={isAccepting}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: 'var(--ink)', color: 'var(--bg)' }}
          >
            {isAccepting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}{t('accept')}</button>
        </div>
      )}

      {vr.status === 'ACCEPTED' && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-medium" style={{ color: 'var(--primary)' }}>{t('accepted')}</span>
          <button
            onClick={onComplete}
            disabled={isCompleting}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
            style={{ background: 'var(--success)', color: '#fff' }}
          >
            {isCompleting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}{t('markComplete')}</button>
        </div>
      )}

      {vr.status === 'COMPLETED' && (
        <div className="flex items-center gap-1.5 pt-1 text-xs font-medium" style={{ color: 'var(--success)' }}>
          <CheckCircle2 size={13} />{t('completedOn', { date: vr.completed_at ? fmtDate(vr.completed_at) : '' })}
        </div>
      )}
    </div>
  );
}

// phone link helper used in parent contact
export function PhoneLink({ phone }: { phone: string }) {
  return (
    <a href={`tel:${phone}`} className="flex items-center gap-1 hover:underline" style={{ color: 'var(--primary)' }}>
      <Phone size={11} />{phone}
    </a>
  );
}
