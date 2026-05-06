'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Check, Lock, Pencil } from 'lucide-react';
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

// ── Modal backdrop wrapper ────────────────────────────────────────────────────

function ModalBackdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6 flex flex-col gap-4 shadow-xl"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Edit Profile Modal ────────────────────────────────────────────────────────

function EditProfileModal({
  user,
  setUser,
  onClose,
}: {
  user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;
  setUser: (u: typeof user) => void;
  onClose: () => void;
}) {
  const [editName,       setEditName]       = useState(user.full_name       ?? '');
  const [editPhone,      setEditPhone]      = useState(user.phone_number    ?? '');
  const [editNationalId, setEditNationalId] = useState((user as typeof user & { national_id?: string }).national_id ?? '');
  const [saving,         setSaving]         = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [error,          setError]          = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const updated = await patchMe({ full_name: editName, phone_number: editPhone, national_id: editNationalId });
      setUser(updated);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1000);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold" style={{ color: 'var(--ink)' }}>Edit profile</p>
        <button
          type="button"
          onClick={onClose}
          className="text-sm px-3 py-1 rounded-lg transition-colors hover:bg-[var(--bg-sand)]"
          style={{ color: 'var(--text-muted)' }}
        >
          Cancel
        </button>
      </div>
      <Input
        label="Full name"
        type="text"
        value={editName}
        onChange={(e) => setEditName(e.target.value)}
        autoComplete="name"
      />
      <Input
        label="Phone number"
        type="tel"
        value={editPhone}
        onChange={(e) => setEditPhone(e.target.value)}
        autoComplete="tel"
      />
      <Input
        label="National ID"
        type="text"
        value={editNationalId}
        onChange={(e) => setEditNationalId(e.target.value)}
        autoComplete="off"
      />
      {error && (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
      )}
      <Button variant="primary" onClick={handleSave} loading={saving}>
        {saved
          ? <><Check size={15} className="mr-1.5" aria-hidden="true" />Saved</>
          : 'Save changes'}
      </Button>
    </ModalBackdrop>
  );
}

// ── Change Password Modal ─────────────────────────────────────────────────────

function ChangePasswordModal({
  forceChange,
  onClose,
  setUser,
}: {
  forceChange: boolean;
  onClose: () => void;
  setUser: (u: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>) => void;
}) {
  const router = useRouter();
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

      try {
        const fresh = await getMe();
        setUser(fresh);
        if (forceChange) {
          setTimeout(() => {
            router.push(ROLE_HOME[fresh.role] ?? '/');
          }, 800);
        } else {
          setTimeout(() => {
            setPwSaved(false);
            onClose();
          }, 1200);
        }
      } catch {
        setTimeout(() => {
          setPwSaved(false);
          onClose();
        }, 1200);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setPwError(msg ?? 'Failed to change password. Check your current password.');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <ModalBackdrop onClose={forceChange ? () => {} : onClose}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <p className="text-base font-semibold" style={{ color: 'var(--ink)' }}>Change password</p>
        </div>
        {!forceChange && (
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-3 py-1 rounded-lg transition-colors hover:bg-[var(--bg-sand)]"
            style={{ color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
        )}
      </div>
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
        <Button type="submit" variant="primary" loading={pwSaving}>
          {pwSaved
            ? <><Check size={15} className="mr-1.5" aria-hidden="true" />{forceChange ? 'Password changed — redirecting…' : 'Password changed!'}</>
            : 'Change password'}
        </Button>
      </form>
    </ModalBackdrop>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const searchParams = useSearchParams();
  const user    = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { theme, setTheme } = useTheme();

  const forceChange = searchParams.get('force') === '1' || (user?.must_change_password ?? false);

  const [lang,   setLang]   = useState<'rw' | 'fr' | 'en'>(user?.preferred_language ?? 'en');
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');

  const [showEditModal,   setShowEditModal]   = useState(false);
  const [showPwModal,     setShowPwModal]     = useState(forceChange);

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
    <>
      <div className="flex flex-col gap-8 max-w-lg mx-auto w-full">
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

        {/* Action buttons — Edit profile + Change password */}
        {!forceChange && (
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowEditModal(true)}
            >
              <Pencil size={15} className="mr-2" aria-hidden="true" />
              Edit profile
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowPwModal(true)}
            >
              <Lock size={15} className="mr-2" aria-hidden="true" />
              Change password
            </Button>
          </div>
        )}

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

      {/* Modals */}
      {showEditModal && user && (
        <EditProfileModal
          user={user}
          setUser={setUser}
          onClose={() => setShowEditModal(false)}
        />
      )}
      {showPwModal && (
        <ChangePasswordModal
          forceChange={forceChange}
          onClose={() => setShowPwModal(false)}
          setUser={setUser}
        />
      )}
    </>
  );
}
