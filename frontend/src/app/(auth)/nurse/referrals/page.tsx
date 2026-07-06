'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';

interface Referral {
  id: string;
  child: string;
  child_name: string;
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

async function createReferral(payload: { child: string; target_facility: string; reason: string }): Promise<Referral> {
  const { data } = await apiClient.post('/referrals/', payload);
  return data.data;
}

async function completeReferral(id: string, outcome: string): Promise<Referral> {
  const { data } = await apiClient.post(`/referrals/${id}/complete/`, { outcome });
  return data.data;
}

async function listChildren(): Promise<{ id: string; full_name: string; registration_number: string }[]> {
  const { data } = await apiClient.get('/children/', { params: { page_size: 200 } });
  return data.data ?? data.results ?? [];
}

const schema = z.object({
  child: z.string().min(1, 'Select a child'),
  target_facility: z.string().min(2, 'Facility name required'),
  reason: z.string().min(5, 'Reason required'),
});
type FormValues = z.infer<typeof schema>;

type StatusKey = 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';

const STATUS_STYLE: Record<StatusKey, React.CSSProperties> = {
  PENDING:   { backgroundColor: 'var(--med-bg)',  color: 'var(--warn)' },
  ACCEPTED:  { backgroundColor: 'var(--low-bg)',  color: 'var(--success)' },
  COMPLETED: { backgroundColor: 'var(--low-bg)',  color: 'var(--success)' },
  CANCELLED: { backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' },
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.875rem',
  fontWeight: 500,
  marginBottom: '0.25rem',
  color: 'var(--ink)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: '0.5rem',
  border: '1px solid var(--border)',
  backgroundColor: 'var(--bg)',
  color: 'var(--ink)',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  outline: 'none',
};

export default function NurseReferralsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState('');

  const { data: referrals = [], isLoading } = useQuery({ queryKey: ['nurse', 'referrals'], queryFn: listReferrals });
  const { data: children = [] } = useQuery({ queryKey: ['nurse', 'children-list'], queryFn: listChildren });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const createMut = useMutation({
    mutationFn: createReferral,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nurse', 'referrals'] }); reset(); setShowForm(false); },
  });

  const completeMut = useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: string }) => completeReferral(id, outcome),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nurse', 'referrals'] }); setCompletingId(null); setOutcome(''); },
  });

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            Referrals
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Outgoing referrals to district facilities.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          New referral
        </Button>
      </div>

      {/* Create form modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowForm(false)}
        >
          <div
            className="rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
            style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>New Referral</h2>
            <form onSubmit={handleSubmit((v) => createMut.mutate(v))} className="space-y-4">
              <div>
                <label style={labelStyle}>Child *</label>
                <select {...register('child')} style={inputStyle}>
                  <option value="">Select child…</option>
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.registration_number})</option>
                  ))}
                </select>
                {errors.child && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.child.message}</p>}
              </div>
              <div>
                <label style={labelStyle}>Target facility *</label>
                <input {...register('target_facility')} placeholder="e.g. Kigali University Hospital" style={inputStyle} />
                {errors.target_facility && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.target_facility.message}</p>}
              </div>
              <div>
                <label style={labelStyle}>Reason *</label>
                <textarea {...register('reason')} rows={3} placeholder="Clinical reason for referral…" style={{ ...inputStyle, resize: 'none' }} />
                {errors.reason && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.reason.message}</p>}
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="flex-1" loading={createMut.isPending}>
                  Create
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete outcome modal */}
      {completingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setCompletingId(null)}
        >
          <div
            className="rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4"
            style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>Record outcome</h2>
            <textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              rows={3}
              placeholder="Outcome at receiving facility…"
              style={{ ...inputStyle, resize: 'none' }}
            />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setCompletingId(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                loading={completeMut.isPending}
                onClick={() => completeMut.mutate({ id: completingId, outcome })}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : referrals.length === 0 ? (
        <EmptyState icon={<ExternalLink size={28} />} title="No referrals" description="Create a referral to send a child to another facility." />
      ) : (
        <div className="flex flex-col gap-3">
          {referrals.map((ref) => (
            <div
              key={ref.id}
              className="rounded-2xl border p-4 flex items-start justify-between gap-3"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold" style={{ color: 'var(--ink)' }}>{ref.child_name}</p>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={STATUS_STYLE[ref.status]}
                  >
                    {ref.status}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  → {ref.target_facility} · {new Date(ref.referred_at).toLocaleDateString()}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--ink)' }}>{ref.reason}</p>
                {ref.outcome && (
                  <p
                    className="text-xs rounded px-2 py-1 mt-1"
                    style={{ backgroundColor: 'var(--low-bg)', color: 'var(--success)' }}
                  >
                    Outcome: {ref.outcome}
                  </p>
                )}
              </div>
              {ref.status === 'PENDING' && (
                <Button
                  variant="secondary"
                  onClick={() => setCompletingId(ref.id)}
                  className="shrink-0 text-xs"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
