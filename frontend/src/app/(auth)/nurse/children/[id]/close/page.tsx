'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useChild } from '@/lib/api/queries';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

type ClosureStatus = 'DECEASED' | 'TRANSFERRED' | 'DEPARTED';

const STATUS_OPTIONS: { value: ClosureStatus; }[] = [
  { value: 'DECEASED' },
  { value: 'TRANSFERRED' },
  { value: 'DEPARTED' },
];

export default function CloseCasePage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations('nurse.children.detail.close');
  const { id } = use(params);
  const router = useRouter();
  const { data: rawChild, isLoading } = useChild(id);
  const child = rawChild as { full_name?: string; registration_number?: string } | null | undefined;

  const [status, setStatus] = useState<ClosureStatus>('TRANSFERRED');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      setError(t('pleaseCheckTheConfirmation'));
      return;
    }
    if (!reason.trim()) {
      setError(t('pleaseProvideAReason'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post(`/children/${id}/close/`, { status, reason });
      router.push('/nurse/children');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? t('failedToCloseCase'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-6">
      {/* Back link */}
      <Link
        href={`/nurse/children/${id}`}
        className="inline-flex items-center gap-1.5 text-sm hover:underline"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={14} aria-hidden="true" />{t('backToChildRecord')}</Link>

      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >{t('closeCase')}</h2>
        {isLoading ? (
          <Skeleton className="h-5 w-40 mt-1 rounded" />
        ) : (
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {child?.full_name ?? t('child')} · {child?.registration_number}
          </p>
        )}
      </div>

      {/* Warning banner */}
      <div
        className="flex items-start gap-3 rounded-xl p-4"
        style={{ backgroundColor: 'color-mix(in srgb, var(--danger) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}
      >
        <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
        <div>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--danger)' }}>{t('thisActionDeactivatesThe')}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('theRecordWillBe')}</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Status selection */}
        <div>
          <p id="close-reason-label" className="text-sm font-semibold block mb-3" style={{ color: 'var(--ink)' }}>{t('reasonForClosure')}</p>
          <div role="radiogroup" aria-labelledby="close-reason-label" className="flex flex-col gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
                style={{
                  borderColor: status === opt.value ? 'var(--brand)' : 'var(--border)',
                  backgroundColor: status === opt.value
                    ? 'color-mix(in srgb, var(--brand) 6%, var(--bg-elev))'
                    : 'var(--bg-elev)',
                }}
              >
                <input
                  type="radio"
                  name="closure_status"
                  value={opt.value}
                  checked={status === opt.value}
                  onChange={() => setStatus(opt.value)}
                  className="mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t(`status.${opt.value}`)}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t(`statusDesc.${opt.value}`)}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="close-details" className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('details')}{' '}<span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <textarea id="close-details"
            rows={4}
            placeholder={t('describeTheCircumstancesDate')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            className="text-sm px-3 py-2 rounded-lg border outline-none resize-none"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          />
        </div>

        {/* Confirmation checkbox */}
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded shrink-0"
          />
          <span className="text-sm" style={{ color: 'var(--ink)' }}>{t('iConfirmThatThis')}</span>
        </label>

        {error && (
          <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
        )}

        <div className="flex gap-3">
          <Button type="submit" variant="danger" loading={submitting} disabled={!confirmed}>{t('closeCase2')}</Button>
          <Link href={`/nurse/children/${id}`}>
            <Button type="button" variant="secondary">{t('cancel')}</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
