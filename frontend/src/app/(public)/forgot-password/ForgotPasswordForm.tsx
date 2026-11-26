'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { requestPasswordReset, confirmPasswordReset } from '@/lib/api/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

function apiMessage(err: unknown, fallback: string) {
  const d = (err as { response?: { data?: { error?: unknown } } })?.response?.data;
  return typeof d?.error === 'string' ? d.error : fallback;
}

export function ForgotPasswordForm() {
  const t = useTranslations('forgotPassword');
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'confirm' | 'done'>('request');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) { setError(t('enterIdentifier')); return; }
    setBusy(true); setError('');
    try {
      await requestPasswordReset(identifier.trim());
      setStep('confirm');
    } catch (err) {
      setError(apiMessage(err, t('sendFailed')));
    } finally {
      setBusy(false);
    }
  };

  const setNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError(t('mismatch')); return; }
    setBusy(true); setError('');
    try {
      await confirmPasswordReset(identifier.trim(), code.trim(), password);
      setStep('done');
    } catch (err) {
      setError(apiMessage(err, t('resetFailed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-8 rounded-2xl" style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
      <h1 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--ink)' }}>
        {step === 'done' ? t('doneTitle') : t('title')}
      </h1>

      {error && <div className="my-4"><Alert variant="danger">{error}</Alert></div>}

      {step === 'request' && (
        <form onSubmit={sendCode} noValidate className="flex flex-col gap-4">
          <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
            {t('requestIntro')}
          </p>
          <Input
            label={t('identifier')}
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
          <Button type="submit" size="lg" loading={busy} className="w-full mt-2">{t('sendCode')}</Button>
        </form>
      )}

      {step === 'confirm' && (
        <form onSubmit={setNewPassword} noValidate className="flex flex-col gap-4">
          <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
            {t.rich('codeSent', {
              identifier,
              strong: (chunks) => <strong style={{ color: 'var(--text)' }}>{chunks}</strong>,
            })}
          </p>
          <Input
            label={t('code')}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
          />
          <Input
            label={t('newPassword')}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={t('passwordHint')}
            required
          />
          <Input
            label={t('confirmNew')}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <Button type="submit" size="lg" loading={busy} className="w-full mt-2">{t('setNew')}</Button>
          <button
            type="button"
            className="text-sm font-bold self-start underline-offset-2 hover:underline"
            style={{ color: 'var(--ink)' }}
            onClick={() => { setStep('request'); setCode(''); setError(''); }}
          >
            {t('resend')}
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('doneBody')}
          </p>
          <Button size="lg" className="w-full" onClick={() => router.push('/login')}>{t('signIn')}</Button>
        </div>
      )}

      {step !== 'done' && (
        <p className="mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          {t.rich('remembered', {
            link: (chunks) => <Link href="/login" className="font-bold underline-offset-2 hover:underline" style={{ color: 'var(--ink)' }}>{chunks}</Link>,
          })}
        </p>
      )}
    </div>
  );
}
