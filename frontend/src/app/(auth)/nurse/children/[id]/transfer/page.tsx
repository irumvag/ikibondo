'use client';

import { useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useChild, useAdminCamps } from '@/lib/api/queries';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Zone } from '@/lib/api/admin';

async function listZonesForCamp(campId: string): Promise<Zone[]> {
  if (!campId) return [];
  const { data } = await apiClient.get(`/camps/${campId}/zones/`);
  const payload = data.data ?? data;
  return payload?.results ?? (Array.isArray(payload) ? payload : []);
}

export default function TransferZonePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data: rawChild, isLoading: childLoading } = useChild(id);
  const child = rawChild as {
    full_name?: string; registration_number?: string;
    camp?: string; camp_name?: string; zone_name?: string;
  } | null | undefined;
  const { data: camps = [] } = useAdminCamps();

  const [toCamp, setToCamp] = useState('');
  const [toZone, setToZone] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const effectiveCamp = toCamp || child?.camp || '';
  const { data: zones = [], isLoading: zonesLoading } = useQuery({
    queryKey: ['zones-for-camp', effectiveCamp],
    queryFn: () => listZonesForCamp(effectiveCamp),
    enabled: !!effectiveCamp,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toZone && !toCamp) {
      setError('Select at least a destination zone or camp.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post(`/children/${id}/transfer-zone/`, {
        to_zone: toZone || undefined,
        to_camp: toCamp || undefined,
        reason,
      });
      router.push(`/nurse/children/${id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Transfer failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-6">
      <Link
        href={`/nurse/children/${id}`}
        className="inline-flex items-center gap-1.5 text-sm hover:underline"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to child record
      </Link>

      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Zone Transfer
        </h2>
        {childLoading ? (
          <Skeleton className="h-5 w-40 mt-1 rounded" />
        ) : (
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {child?.full_name ?? 'Child'} · current zone: {child?.zone_name ?? 'Unassigned'}
          </p>
        )}
      </div>

      {/* Current → New visual */}
      {!childLoading && child && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl border"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
        >
          <div className="flex-1 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Current</p>
            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{child.camp_name}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{child.zone_name ?? 'No zone'}</p>
          </div>
          <ArrowRight size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <div className="flex-1 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Destination</p>
            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              {camps.find((c) => c.id === toCamp)?.name ?? child.camp_name}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {zones.find((z) => z.id === toZone)?.name ?? (toZone ? '—' : 'Select zone')}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Camp (optional — for cross-camp) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            Destination camp <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(leave unchanged for intra-camp)</span>
          </label>
          <select
            value={toCamp}
            onChange={(e) => { setToCamp(e.target.value); setToZone(''); }}
            className="text-sm px-3 py-2 rounded-lg border outline-none"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          >
            <option value="">— Same camp —</option>
            {camps.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Zone */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            Destination zone
          </label>
          {zonesLoading ? (
            <Skeleton className="h-10 rounded-lg" />
          ) : (
            <select
              value={toZone}
              onChange={(e) => setToZone(e.target.value)}
              className="text-sm px-3 py-2 rounded-lg border outline-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
            >
              <option value="">— Select zone —</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Reason */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            Reason <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <textarea
            rows={3}
            placeholder="Reason for transfer (e.g. relocation, boundary revision, request from family)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            className="text-sm px-3 py-2 rounded-lg border outline-none resize-none"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          />
        </div>

        {error && (
          <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
        )}

        <div className="flex gap-3">
          <Button type="submit" variant="primary" loading={submitting}>
            Confirm transfer
          </Button>
          <Link href={`/nurse/children/${id}`}>
            <Button type="button" variant="secondary">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
