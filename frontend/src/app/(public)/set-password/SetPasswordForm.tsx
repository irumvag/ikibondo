'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('setPassword');
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
    if (password !== confirm) { setError(t('mismatch')); return; }
    setBusy(true); setError('');
    try {
      await setInitialPassword(uid, token, password);
      setDone(true);
    } catch (err) {
      setError(apiMessage(err, t('failed')));
    } finally {
      setBusy(false);
    }
  };

  const broken = !uid || !token;

  return (
    <div className="p-8 rounded-2xl" style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
      <h1 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--ink)' }}>
        {done ? t('doneTitle') : t('title')}
      </h1>

      {error && <div className="my-4"><Alert variant="danger">{error}</Alert></div>}

      {broken && !done && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('broken')}
        </p>
      )}

      {!broken && !done && (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
            {t('intro')}
          </p>
          <Input
            label={t('password')}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={t('passwordHint')}
            required
          />
          <Input
            label={t('confirm')}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <Button type="submit" size="lg" loading={busy} className="w-full mt-2">{t('submit')}</Button>
        </form>
      )}

      {done && (
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('doneBody')}
          </p>
          <Button size="lg" className="w-full" onClick={() => router.push('/login')}>{t('signIn')}</Button>
        </div>
      )}

      {!done && (
        <p className="mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          {t.rich('alreadySet', {
            link: (chunks) => <Link href="/login" className="font-bold underline-offset-2 hover:underline" style={{ color: 'var(--ink)' }}>{chunks}</Link>,
          })}
        </p>
      )}
    </div>
  );
}
