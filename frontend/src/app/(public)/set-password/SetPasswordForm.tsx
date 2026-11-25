'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { setInitialPassword } from '@/lib/api/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

function apiMessage(err: unknown, fallback: string) {
  const d = (err as { response?: { data?: { error?: unknown } } })?.response?.data;
  return typeof d?.error === 'string' ? d.error : fallback;
}

/** Opened from the link a nurse's registration sends to a new parent. */
export function SetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const uid = params.get('uid') ?? '';
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('The two passwords don’t match.'); return; }
    setBusy(true); setError('');
    try {
      await setInitialPassword(uid, token, password);
      setDone(true);
    } catch (err) {
      setError(apiMessage(err, "We couldn't set your password. Try again, or ask the nurse for a new link."));
    } finally {
      setBusy(false);
    }
  };

  const broken = !uid || !token;

  return (
    <div className="p-8 rounded-2xl" style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
      <h1 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--ink)' }}>
        {done ? 'You’re all set' : 'Choose your password'}
      </h1>

      {error && <div className="my-4"><Alert variant="danger">{error}</Alert></div>}

      {broken && !done && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          This link is incomplete. Open the full link from your SMS or email, or ask the nurse to send a new one.
        </p>
      )}

      {!broken && !done && (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
            A nurse created your Ikibondo account. Pick a password only you know. This link works once.
          </p>
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="At least 8 characters. Avoid common words and your name."
            required
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <Button type="submit" size="lg" loading={busy} className="w-full mt-2">Set password</Button>
        </form>
      )}

      {done && (
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Sign in with your phone number (or email) and the password you just chose.
          </p>
          <Button size="lg" className="w-full" onClick={() => router.push('/login')}>Sign in</Button>
        </div>
      )}

      {!done && (
        <p className="mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          Already set it? <Link href="/login" className="font-bold underline-offset-2 hover:underline" style={{ color: 'var(--ink)' }}>Sign in</Link>
        </p>
      )}
    </div>
  );
}
