'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import {
  listCHWVisitRequests, acceptVisitRequest, declineVisitRequest, completeVisitRequest,
  type CHWVisitRequest, type VisitRequestStatus,
} from '@/lib/api/chw';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

const STATUS_TABS: { key: VisitRequestStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'DECLINED', label: 'Declined' },
];

const URGENCY_COLOR: Record<string, string> = {
  URGENT: 'text-red-700 bg-red-50 border-red-200',
  SOON: 'text-amber-700 bg-amber-50 border-amber-200',
  ROUTINE: 'text-gray-600 bg-gray-50 border-gray-200',
};

export default function CHWRequestsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<VisitRequestStatus | 'ALL'>('PENDING');
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['chw', 'visit-requests'],
    queryFn: () => listCHWVisitRequests(),
    refetchInterval: 30_000,
  });

  const filtered = tab === 'ALL' ? requests : requests.filter((r) => r.status === tab);

  const acceptMut = useMutation({
    mutationFn: ({ id, eta }: { id: string; eta?: string }) => acceptVisitRequest(id, eta),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chw', 'visit-requests'] }),
  });

  const declineMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => declineVisitRequest(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chw', 'visit-requests'] });
      setDeclineId(null);
      setDeclineReason('');
    },
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => completeVisitRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chw', 'visit-requests'] }),
  });

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Visit Requests</h1>
        <p className="mt-1 text-sm text-gray-500">Home visit requests from parents in your caseload.</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {STATUS_TABS.map(({ key, label }) => {
          const count = key === 'ALL' ? requests.length : requests.filter((r) => r.status === key).length;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
                tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}{count > 0 && ` (${count})`}
            </button>
          );
        })}
      </div>

      {/* Request list */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Clock size={28} />}
          title="No requests"
          description={`No ${tab === 'ALL' ? '' : tab.toLowerCase() + ' '}visit requests at this time.`}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Decline visit request</h2>
            <p className="text-sm text-gray-500">Please provide a reason so the parent understands next steps.</p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
              placeholder="Reason for declining…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setDeclineId(null); setDeclineReason(''); }}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => declineMut.mutate({ id: declineId, reason: declineReason })}
                disabled={declineMut.isPending || !declineReason.trim()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60"
              >
                {declineMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Decline
              </button>
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
  const urgencyClass = URGENCY_COLOR[vr.urgency] ?? URGENCY_COLOR.ROUTINE;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-900">{vr.child_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {vr.requested_by_name && `From: ${vr.requested_by_name} · `}
            {new Date(vr.created_at).toLocaleDateString()}
          </p>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${urgencyClass}`}>
          {vr.urgency === 'URGENT' && <AlertTriangle className="inline h-3 w-3 mr-0.5" />}
          {vr.urgency}
        </span>
      </div>

      {vr.symptom_flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {vr.symptom_flags.map((s) => (
            <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
          ))}
        </div>
      )}

      {vr.concern_text && (
        <p className="text-sm text-gray-600 leading-relaxed">{vr.concern_text}</p>
      )}

      {vr.status === 'DECLINED' && vr.decline_reason && (
        <p className="text-xs bg-red-50 text-red-700 px-3 py-2 rounded-lg">Declined: {vr.decline_reason}</p>
      )}

      {vr.status === 'PENDING' && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={onDecline}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <XCircle className="h-4 w-4" />
            Decline
          </button>
          <button
            onClick={onAccept}
            disabled={isAccepting}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isAccepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Accept
          </button>
        </div>
      )}

      {vr.status === 'ACCEPTED' && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-blue-600 font-medium">
            Accepted{vr.eta ? ` · ETA ${new Date(vr.eta).toLocaleString()}` : ''}
          </p>
          <button
            onClick={onComplete}
            disabled={isCompleting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700 disabled:opacity-60"
          >
            {isCompleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Mark complete
          </button>
        </div>
      )}

      {vr.status === 'COMPLETED' && (
        <p className="text-xs text-green-600 font-medium">
          ✓ Completed {vr.completed_at ? new Date(vr.completed_at).toLocaleDateString() : ''}
        </p>
      )}
    </div>
  );
}
