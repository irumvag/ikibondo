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
  return data.data ?? [];
}

const schema = z.object({
  child: z.string().min(1, 'Select a child'),
  target_facility: z.string().min(2, 'Facility name required'),
  reason: z.string().min(5, 'Reason required'),
});
type FormValues = z.infer<typeof schema>;

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'text-amber-700 bg-amber-50',
  ACCEPTED: 'text-blue-700 bg-blue-50',
  COMPLETED: 'text-green-700 bg-green-50',
  CANCELLED: 'text-gray-500 bg-gray-100',
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
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Referrals</h1>
          <p className="mt-1 text-sm text-gray-500">Outgoing referrals to district facilities.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New referral
        </button>
      </div>

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">New Referral</h2>
            <form onSubmit={handleSubmit((v) => createMut.mutate(v))} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Child *</label>
                <select {...register('child')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="">Select child…</option>
                  {children.map((c) => <option key={c.id} value={c.id}>{c.full_name} ({c.registration_number})</option>)}
                </select>
                {errors.child && <p className="text-xs text-red-600 mt-1">{errors.child.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target facility *</label>
                <input {...register('target_facility')} placeholder="e.g. Kigali University Hospital" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                {errors.target_facility && <p className="text-xs text-red-600 mt-1">{errors.target_facility.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <textarea {...register('reason')} rows={3} placeholder="Clinical reason for referral…" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none" />
                {errors.reason && <p className="text-xs text-red-600 mt-1">{errors.reason.message}</p>}
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={createMut.isPending} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-60">
                  {createMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete outcome modal */}
      {completingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">Record outcome</h2>
            <textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={3} placeholder="Outcome at receiving facility…" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none" />
            <div className="flex gap-2">
              <button onClick={() => setCompletingId(null)} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm">Cancel</button>
              <button onClick={() => completeMut.mutate({ id: completingId, outcome })} disabled={completeMut.isPending} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm text-white disabled:opacity-60">
                {completeMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : referrals.length === 0 ? (
        <EmptyState icon={<ExternalLink size={28} />} title="No referrals" description="Create a referral to send a child to another facility." />
      ) : (
        <div className="flex flex-col gap-3">
          {referrals.map((ref) => (
            <div key={ref.id} className="rounded-xl border border-gray-200 bg-white p-4 flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900">{ref.child_name}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[ref.status]}`}>{ref.status}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">→ {ref.target_facility} · {new Date(ref.referred_at).toLocaleDateString()}</p>
                <p className="text-sm text-gray-600 mt-1">{ref.reason}</p>
                {ref.outcome && <p className="text-xs text-green-700 bg-green-50 rounded px-2 py-1 mt-1">Outcome: {ref.outcome}</p>}
              </div>
              {ref.status === 'PENDING' && (
                <button onClick={() => setCompletingId(ref.id)} className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-green-300 px-2.5 py-1.5 text-xs text-green-700 hover:bg-green-50">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
