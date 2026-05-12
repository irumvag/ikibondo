'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Check, Lock } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { patchMe, changePassword, getMe } from '@/lib/api/user';
import { useTheme } from '@/components/layout/ThemeProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const ROLE_LABEL: Record<string, string> = {
  ADMIN:      'Administrator',
  SUPERVISOR: 'Zone Supervisor',
  NURSE:      'Nurse',
  CHW:        'Community Health Worker',
  PARENT:     'Parent / Guardian',
};

const ROLE_HOME: Record<string, string> = {
  ADMIN:      '/admin',
  SUPERVISOR: '/supervisor',
  NURSE:      '/nurse',
  CHW:        '/chw',
  PARENT:     '/parent',
};

const LANGUAGES: { value: 'rw' | 'fr' | 'en'; label: string }[] = [
  { value: 'rw', label: 'Kinyarwanda' },
  { value: 'fr', label: 'French'      },
  { value: 'en', label: 'English'     },
];

const THEMES: { value: 'system' | 'light' | 'dark'; label: string }[] = [
  { value: 'system', label: 'System default' },
  { value: 'light',  label: 'Light'          },
  { value: 'dark',   label: 'Dark'           },
];

export default function ProfilePage() {
  const router  = useRouter();
  const searchParams = useSearchParams();
  const user    = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { theme, setTheme } = useTheme();

  // force=1 means the user is on a temporary password and must change it
  const forceChange = searchParams.get('force') === '1' || (user?.must_change_password ?? false);

  const [lang,   setLang]   = useState<'rw' | 'fr' | 'en'>(user?.preferred_language ?? 'en');
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');

  // Change password
  const [pwForm, setPwForm]   = useState({ old: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved,  setPwSaved]  = useState(false);
  const [pwError,  setPwError]  = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) {
      setPwError('New passwords do not match.');
      return;
    }
    if (pwForm.next.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    setPwSaving(true);
    setPwError('');
    setPwSaved(false);
    try {
      await changePassword(pwForm.old, pwForm.next);
      setPwForm({ old: '', next: '', confirm: '' });
      setPwSaved(true);

      // Refresh user from API so must_change_password flag is cleared
      try {
        const fresh = await getMe();
        setUser(fresh);
        if (forceChange) {
          // Redirect to the role home after force change
          setTimeout(() => {
            router.push(ROLE_HOME[fresh.role] ?? '/');
          }, 800);
        } else {
          setTimeout(() => setPwSaved(false), 3000);
        }
      } catch {
        setTimeout(() => setPwSaved(false), 3000);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setPwError(msg ?? 'Failed to change password. Check your current password.');
    } finally {
      setPwSaving(false);
    }
  };

  const isDirty = lang !== (user?.preferred_language ?? 'en');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const updated = await patchMe({ preferred_language: lang });
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.full_name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() ?? '?';

  return (
    <div className="flex flex-col gap-8 max-w-lg">
      {/* Force-password-change banner */}
      {forceChange && (
        <div
          className="flex items-start gap-3 rounded-2xl border px-5 py-4"
          role="alert"
          style={{
            borderColor: 'color-mix(in srgb, var(--warn) 40%, transparent)',
            backgroundColor: 'color-mix(in srgb, var(--warn) 10%, var(--bg-elev))',
          }}
        >
          <AlertTriangle size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--warn)' }} aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              You&apos;re using a temporary password
            </p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Please set a new password below before continuing. You won&apos;t be able to access other pages until this is done.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Profile
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Account details and preferences
        </p>
      </div>

      {/* Avatar + identity */}
      <div
        className="rounded-2xl border p-6 flex items-center gap-5"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold select-none shrink-0"
          style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
          aria-hidden="true"
        >
          {initials}
        </div>
        <div>
          <p
            className="text-lg font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            {user?.full_name ?? '—'}
          </p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {user?.email ?? '—'}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
            >
              {ROLE_LABEL[user?.role ?? ''] ?? user?.role}
            </span>
            {user?.camp_name && (
              <span
                className="text-xs px-2.5 py-1 rounded-full"
                style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}
              >
                {user.camp_name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Account info */}
      <div
        className="rounded-2xl border p-5 flex flex-col gap-3"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Account info
        </p>
        {[
          ['Email',  user?.email       ?? '—'],
          ['Phone',  user?.phone_number ?? 'Not set'],
          ['Status', user?.is_approved  ? 'Active' : 'Pending approval'],
        ].map(([k, v]) => (
          <div
            key={k}
            className="flex justify-between items-center text-sm border-b last:border-b-0 pb-2.5 last:pb-0"
            style={{ borderColor: 'var(--border)' }}
          >
            <span style={{ color: 'var(--text-muted)' }}>{k}</span>
            <span
              className="font-medium"
              style={{ color: k === 'Status' && !user?.is_approved ? 'var(--warn)' : 'var(--ink)' }}
            >
              {v}
            </span>
          </div>
        ))}
      </div>

      {/* Security — shown first when force-change is active */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Lock size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <p className="text-base font-semibold" style={{ color: 'var(--ink)' }}>Security</p>
        </div>
        <div
          className="rounded-2xl border p-5"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
        >
          <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
            <Input
              label="Current password"
              type="password"
              value={pwForm.old}
              onChange={(e) => setPwForm({ ...pwForm, old: e.target.value })}
              required
              autoComplete="current-password"
            />
            <Input
              label="New password"
              type="password"
              value={pwForm.next}
              onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
              required
              autoComplete="new-password"
            />
            <Input
              label="Confirm new password"
              type="password"
              value={pwForm.confirm}
              onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
              required
              autoComplete="new-password"
            />
            {pwError && (
              <p className="text-sm" style={{ color: 'var(--danger)' }}>{pwError}</p>
            )}
            <Button
              type="submit"
              variant="primary"
              loading={pwSaving}
              className="self-start"
            >
              {pwSaved
                ? <><Check size={15} className="mr-1.5" aria-hidden="true" />Password changed — redirecting…</>
                : 'Change password'}
            </Button>
          </form>
        </div>
      </div>

      {/* Preferences — hidden while force-change is active */}
      {!forceChange && (
        <div className="flex flex-col gap-5">
          <p className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
            Preferences
          </p>

          {/* Language */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              Language
            </label>
            <div className="flex gap-2">
              {LANGUAGES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLang(value)}
                  className="flex-1 py-2 rounded-xl border text-sm font-medium transition-colors"
                  style={{
                    borderColor:     lang === value ? 'var(--ink)' : 'var(--border)',
                    backgroundColor: lang === value ? 'var(--ink)' : 'transparent',
                    color:           lang === value ? 'var(--bg)' : 'var(--text-muted)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              Appearance
            </label>
            <div className="flex gap-2">
              {THEMES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className="flex-1 py-2 rounded-xl border text-sm font-medium transition-colors"
                  style={{
                    borderColor:     theme === value ? 'var(--ink)' : 'var(--border)',
                    backgroundColor: theme === value ? 'var(--ink)' : 'transparent',
                    color:           theme === value ? 'var(--bg)' : 'var(--text-muted)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
          )}

          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
            disabled={!isDirty && !saving}
            className="self-start"
          >
            {saved
              ? <><Check size={15} className="mr-1.5" aria-hidden="true" />Saved</>
              : 'Save preferences'}
          </Button>
        </div>
      )}
    </div>
  );
}
