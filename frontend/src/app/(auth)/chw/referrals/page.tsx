'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

interface Referral {
  id: string;
  child: string;
  child_name: string;
  referring_user: string;
  referring_user_name: string | null;
  target_facility: string;
  reason: string;
  status: 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';
  outcome: string;
  referred_at: string;
  completed_at: string | null;
}

async function listReferrals(): Promise<Referral[]> {
  const { data } = await apiClient.get('/referrals/');
  return data.data ?? data.results ?? [];
}

async function createReferral(payload: {
  child: string;
  target_facility: string;
  reason: string;
}): Promise<Referral> {
  const { data } = await apiClient.post('/referrals/', payload);
  return data.data;
}

async function completeReferral(id: string, outcome: string): Promise<Referral> {
  const { data } = await apiClient.post(`/referrals/${id}/complete/`, { outcome });
  return data.data;
}

async function searchChildren(q: string) {
  const { data } = await apiClient.get('/children/', { params: { search: q, page_size: 10 } });
  return data.data ?? data.results ?? [];
}

const STATUS_META: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PENDING:   { label: 'Pending',   color: 'warn',    icon: Clock },
  ACCEPTED:  { label: 'Accepted',  color: 'info',    icon: AlertCircle },
  COMPLETED: { label: 'Completed', color: 'success', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', color: 'danger',  icon: XCircle },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CHWReferralsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [childSearch, setChildSearch] = useState('');
  const [selectedChild, setSelectedChild] = useState<{ id: string; full_name: string } | null>(null);
  const [facility, setFacility] = useState('');
  const [reason, setReason] = useState('');
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState('');

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['chw-referrals'],
    queryFn: listReferrals,
  });

  const { data: childResults = [] } = useQuery({
    queryKey: ['child-search', childSearch],
    queryFn: () => searchChildren(childSearch),
    enabled: childSearch.length >= 2,
  });

  const createMut = useMutation({
    mutationFn: createReferral,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chw-referrals'] });
      setShowForm(false);
      setSelectedChild(null);
      setFacility('');
      setReason('');
      setChildSearch('');
    },
  });

  const completeMut = useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: string }) => completeReferral(id, outcome),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chw-referrals'] });
      setCompleteId(null);
      setOutcome('');
    },
  });

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
            Referrals
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Log and track high-risk child referrals to health facilities.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={16} className="mr-1" /> New Referral
        </Button>
      </div>

      {/* New Referral Form */}
      {showForm && (
        <div className="rounded-xl border p-5 flex flex-col gap-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--ink)' }}>Create Referral</h3>

          {/* Child search */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Child</label>
            {selectedChild ? (
              <div className="flex items-center gap-2">
                <span className="text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
                  {selectedChild.full_name}
                </span>
                <button
                  onClick={() => { setSelectedChild(null); setChildSearch(''); }}
                  className="text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  placeholder="Search by name or registration number…"
                  value={childSearch}
                  onChange={(e) => setChildSearch(e.target.value)}
                />
                {childResults.length > 0 && childSearch.length >= 2 && (
                  <div
                    className="absolute z-10 w-full mt-1 rounded-lg border shadow-lg"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                  >
                    {childResults.map((c: { id: string; full_name: string; registration_number: string }) => (
                      <button
                        key={c.id}
                        className="w-full text-left px-3 py-2 hover:bg-opacity-10 text-sm"
                        style={{ color: 'var(--ink)' }}
                        onClick={() => { setSelectedChild(c); setChildSearch(''); }}
                      >
                        {c.full_name} <span style={{ color: 'var(--text-muted)' }}>· {c.registration_number}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Target Facility</label>
            <Input
              placeholder="e.g. Kiziba Health Centre"
              value={facility}
              onChange={(e) => setFacility(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Reason for Referral</label>
            <textarea
              rows={3}
              placeholder="Describe clinical reason…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm border resize-none"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--ink)' }}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button
              disabled={!selectedChild || !facility || !reason || createMut.isPending}
              onClick={() => selectedChild && createMut.mutate({ child: selectedChild.id, target_facility: facility, reason })}
            >
              {createMut.isPending ? 'Saving…' : 'Create Referral'}
            </Button>
          </div>
        </div>
      )}

      {/* Complete Referral Modal */}
      {completeId && (
        <div className="rounded-xl border p-5 flex flex-col gap-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--ink)' }}>Record Outcome</h3>
          <textarea
            rows={3}
            placeholder="Describe what happened at the facility…"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm border resize-none"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--ink)' }}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setCompleteId(null)}>Cancel</Button>
            <Button
              disabled={!outcome || completeMut.isPending}
              onClick={() => completeMut.mutate({ id: completeId, outcome })}
            >
              {completeMut.isPending ? 'Saving…' : 'Mark Complete'}
            </Button>
          </div>
        </div>
      )}

      {/* Referral List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : referrals.length === 0 ? (
        <EmptyState
          icon={<CheckCircle size={32} />}
          title="No referrals yet"
          description="Create a referral to send a child to a health facility for further care."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {referrals.map((ref) => {
            const meta = STATUS_META[ref.status] ?? STATUS_META.PENDING;
            const Icon = meta.icon;
            return (
              <div
                key={ref.id}
                className="rounded-xl border p-4 flex flex-col gap-2"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{ref.child_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      → {ref.target_facility} · {formatDate(ref.referred_at)}
                    </p>
                  </div>
                  <Badge variant={meta.color as 'warn' | 'success' | 'danger' | 'info'}>
                    <Icon size={12} className="mr-1" />
                    {meta.label}
                  </Badge>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{ref.reason}</p>
                {ref.outcome && (
                  <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
                    <span className="font-medium">Outcome: </span>{ref.outcome}
                  </p>
                )}
                {ref.status === 'PENDING' || ref.status === 'ACCEPTED' ? (
                  <div className="flex justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setCompleteId(ref.id)}>
                      Record Outcome
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
