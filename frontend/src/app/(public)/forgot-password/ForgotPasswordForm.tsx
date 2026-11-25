'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { requestPasswordReset, confirmPasswordReset } from '@/lib/api/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

function apiMessage(err: unknown, fallback: string) {
  const d = (err as { response?: { data?: { error?: unknown } } })?.response?.data;
  return typeof d?.error === 'string' ? d.error : fallback;
}

export function ForgotPasswordForm() {
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
    if (!identifier.trim()) { setError('Enter the email or phone number you sign in with.'); return; }
    setBusy(true); setError('');
    try {
      await requestPasswordReset(identifier.trim());
      setStep('confirm');
    } catch (err) {
      setError(apiMessage(err, "We couldn't send a code right now. Wait a few minutes and try again."));
    } finally {
      setBusy(false);
    }
  };

  const setNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('The two passwords don’t match.'); return; }
    setBusy(true); setError('');
    try {
      await confirmPasswordReset(identifier.trim(), code.trim(), password);
      setStep('done');
    } catch (err) {
      setError(apiMessage(err, "We couldn't reset your password. Check the code and try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-8 rounded-2xl" style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
      <h1 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--ink)' }}>
        {step === 'done' ? 'Password updated' : 'Reset your password'}
      </h1>

      {error && <div className="my-4"><Alert variant="danger">{error}</Alert></div>}

      {step === 'request' && (
        <form onSubmit={sendCode} noValidate className="flex flex-col gap-4">
          <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
            We&apos;ll send a 6-digit code to the phone or email on your account.
          </p>
          <Input
            label="Email or phone number"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
          <Button type="submit" size="lg" loading={busy} className="w-full mt-2">Send code</Button>
        </form>
      )}

      {step === 'confirm' && (
        <form onSubmit={setNewPassword} noValidate className="flex flex-col gap-4">
          <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
            If an account matches <strong style={{ color: 'var(--text)' }}>{identifier}</strong>, a code is on its way.
            It expires in 10 minutes.
          </p>
          <Input
            label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
          />
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="At least 8 characters. Avoid common words and your name."
            required
          />
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <Button type="submit" size="lg" loading={busy} className="w-full mt-2">Set new password</Button>
          <button
            type="button"
            className="text-sm font-bold self-start underline-offset-2 hover:underline"
            style={{ color: 'var(--ink)' }}
            onClick={() => { setStep('request'); setCode(''); setError(''); }}
          >
            Send a new code
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            You&apos;ve been signed out on every device. Sign in with your new password.
          </p>
          <Button size="lg" className="w-full" onClick={() => router.push('/login')}>Sign in</Button>
        </div>
      )}

      {step !== 'done' && (
        <p className="mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          Remembered it? <Link href="/login" className="font-bold underline-offset-2 hover:underline" style={{ color: 'var(--ink)' }}>Sign in</Link>
        </p>
      )}
    </div>
  );
}
