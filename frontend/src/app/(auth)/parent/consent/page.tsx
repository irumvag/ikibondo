'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Shield, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';

interface ConsentRecord {
  id: string;
  scope: string;
  version: string;
  granted: boolean;
  granted_at: string;
  withdrawn_at: string | null;
}

async function fetchConsent(): Promise<ConsentRecord[]> {
  const { data } = await apiClient.get('/auth/consent/');
  return data.data ?? [];
}

async function grantConsent(scope: string, version: string): Promise<ConsentRecord> {
  const { data } = await apiClient.post('/auth/consent/', { scope, version });
  return data.data;
}

async function withdrawConsent(id: string): Promise<void> {
  await apiClient.post(`/auth/consent/${id}/withdraw/`);
}

const CONSENT_SCOPE_LABELS: Record<string, string> = {
  data_collection: 'Data Collection & Use',
};

export default function ConsentPage() {
  const qc = useQueryClient();
  const [withdrawConfirm, setWithdrawConfirm] = useState<string | null>(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['consent'],
    queryFn: fetchConsent,
  });

  const grantMutation = useMutation({
    mutationFn: () => grantConsent('data_collection', '1.0'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consent'] }),
  });

  const withdrawMutation = useMutation({
    mutationFn: (id: string) => withdrawConsent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consent'] });
      setWithdrawConfirm(null);
    },
  });

  const activeConsent = records.find((r) => r.scope === 'data_collection' && r.granted && !r.withdrawn_at);
  const hasConsented = !!activeConsent;

  return (
    <div className="max-w-2xl flex flex-col gap-8">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Data Consent
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          How your child&apos;s health data is collected and used
        </p>
      </div>

      {/* Policy summary */}
      <div
        className="rounded-2xl border p-6 flex flex-col gap-4"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        <div className="flex items-center gap-2">
          <Shield size={16} style={{ color: 'var(--brand)' }} aria-hidden="true" />
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>UNHCR Data Use Policy — Version 1.0</p>
        </div>
        <div className="text-sm flex flex-col gap-3" style={{ color: 'var(--text-muted)' }}>
          <p>
            By using Ikibondo, your child&apos;s health measurements, vaccination records,
            and risk assessments are collected and stored securely.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>How it is used:</strong> Data is used by
            Community Health Workers, nurses, and supervisors to provide better care for your child.
            Aggregated, anonymous data may be shared with camp management (UNHCR, MINEMA) for
            programme planning.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Your rights:</strong> You may withdraw consent
            at any time. Withdrawal will not delete existing records but will restrict future data
            collection. Contact your camp nurse for assistance.
          </p>
        </div>
      </div>

      {/* Current status */}
      {isLoading ? (
        <Skeleton className="h-20 rounded-2xl" />
      ) : (
        <div
          className="rounded-2xl border p-5 flex items-center justify-between gap-4 flex-wrap"
          style={{
            borderColor: hasConsented
              ? 'color-mix(in srgb, var(--success) 35%, transparent)'
              : 'var(--border)',
            backgroundColor: hasConsented
              ? 'color-mix(in srgb, var(--success) 6%, var(--bg-elev))'
              : 'var(--bg-elev)',
          }}
        >
          <div className="flex items-center gap-3">
            {hasConsented
              ? <CheckCircle size={20} style={{ color: 'var(--success)' }} aria-hidden="true" />
              : <XCircle size={20} style={{ color: 'var(--danger)' }} aria-hidden="true" />}
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {hasConsented ? 'Consent granted' : 'Consent not granted'}
              </p>
              {hasConsented && activeConsent && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Granted on {new Date(activeConsent.granted_at).toLocaleDateString()} · v{activeConsent.version}
                </p>
              )}
            </div>
          </div>

          {!hasConsented ? (
            <Button
              variant="primary"
              loading={grantMutation.isPending}
              onClick={() => grantMutation.mutate()}
            >
              Grant consent
            </Button>
          ) : (
            withdrawConfirm === activeConsent?.id ? (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Confirm?</span>
                <Button
                  size="sm"
                  variant="danger"
                  loading={withdrawMutation.isPending}
                  onClick={() => withdrawMutation.mutate(activeConsent!.id)}
                >
                  Withdraw
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setWithdrawConfirm(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setWithdrawConfirm(activeConsent?.id ?? null)}
              >
                Withdraw consent
              </Button>
            )
          )}
        </div>
      )}

      {/* Consent history */}
      {records.length > 0 && (
        <section aria-labelledby="history-heading">
          <h3 id="history-heading" className="text-sm font-semibold mb-3" style={{ color: 'var(--ink)' }}>
            Consent history
          </h3>
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
          >
            {records.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0 text-sm flex-wrap"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium" style={{ color: 'var(--ink)' }}>
                    {CONSENT_SCOPE_LABELS[r.scope] ?? r.scope}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Granted {new Date(r.granted_at).toLocaleString()}
                    {r.withdrawn_at && ` · Withdrawn ${new Date(r.withdrawn_at).toLocaleString()}`}
                  </p>
                </div>
                <Badge variant={r.granted && !r.withdrawn_at ? 'success' : 'default'}>
                  {r.granted && !r.withdrawn_at ? 'Active' : 'Withdrawn'}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
