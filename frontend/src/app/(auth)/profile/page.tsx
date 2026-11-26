'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, Baby, BadgeCheck, Briefcase, CalendarDays, Check, ChevronRight, Clock, HeartHandshake,
  IdCard, KeyRound, Lock, Mail, MapPin, Pencil, Phone, Repeat, ShieldCheck, SlidersHorizontal, User,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { patchMe, changePassword, getMe, getProfileSummary, type ProfileSummary } from '@/lib/api/user';
import { useTheme } from '@/components/layout/ThemeProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { useToast } from '@/contexts/ToastContext';
import { useRoleSwitch } from '@/components/layout/RoleSwitcher';
import { ROLE_LABEL } from '@/lib/roles';

const ROLE_HOME: Record<string, string> = {
  ADMIN:      '/admin',
  SUPERVISOR: '/supervisor',
  NURSE:      '/nurse',
  CHW:        '/chw',
  PARENT:     '/parent',
};

const LANGUAGES: { value: 'rw' | 'fr' | 'en'; label: string }[] = [
  { value: 'rw', label: 'Kinyarwanda' },
  { value: 'fr', label: 'Français'    },
  { value: 'en', label: 'English'     },
];

const THEMES: { value: 'system' | 'light' | 'dark'; label: string }[] = [
  { value: 'system', label: 'Same as device' },
  { value: 'light',  label: 'Light'          },
  { value: 'dark',   label: 'Dark'           },
];

// ── Edit Profile Modal ────────────────────────────────────────────────────────

function EditProfileModal({
  user,
  setUser,
  open,
  onClose,
}: {
  user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;
  setUser: (u: typeof user) => void;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [editName,       setEditName]       = useState(user.full_name    ?? '');
  const [editPhone,      setEditPhone]      = useState(user.phone_number ?? '');
  const [editNationalId, setEditNationalId] = useState((user as typeof user & { national_id?: string }).national_id ?? '');
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await patchMe({ full_name: editName, phone_number: editPhone, national_id: editNationalId });
      setUser(updated);
      toast.success('Profile updated successfully');
      onClose();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit profile"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <Input label="Full name" type="text" value={editName} onChange={(e) => setEditName(e.target.value)} autoComplete="name" />
        <Input label="Phone number" type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} autoComplete="tel" />
        <Input label="National ID" type="text" value={editNationalId} onChange={(e) => setEditNationalId(e.target.value)} autoComplete="off" />
      </div>
    </Modal>
  );
}

// ── Change Password Modal ─────────────────────────────────────────────────────

function ChangePasswordModal({
  forceChange,
  open,
  onClose,
  setUser,
}: {
  forceChange: boolean;
  open: boolean;
  onClose: () => void;
  setUser: (u: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>) => void;
}) {
  const router = useRouter();
  const toast  = useToast();
  const [pwForm, setPwForm]     = useState({ old: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError,  setPwError]  = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { setPwError('New passwords do not match.'); return; }
    if (pwForm.next.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
    setPwSaving(true);
    setPwError('');
    try {
      await changePassword(pwForm.old, pwForm.next);
      setPwForm({ old: '', next: '', confirm: '' });
      try {
        const fresh = await getMe();
        setUser(fresh);
        toast.success('Password changed successfully');
        if (forceChange) {
          router.push(ROLE_HOME[fresh.role] ?? '/');
        } else {
          onClose();
        }
      } catch {
        toast.success('Password changed');
        onClose();
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setPwError(msg ?? 'Failed to change password. Check your current password.');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={forceChange ? () => {} : onClose}
      title="Change password"
      size="sm"
    >
      <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
        {pwError && <Alert variant="danger">{pwError}</Alert>}
        <Input label="Current password" type="password" value={pwForm.old} onChange={(e) => setPwForm({ ...pwForm, old: e.target.value })} required autoComplete="current-password" />
        <Input label="New password" type="password" value={pwForm.next} onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })} required autoComplete="new-password" />
        <Input label="Confirm new password" type="password" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} required autoComplete="new-password" />
        <Button type="submit" variant="primary" loading={pwSaving}>
          {pwSaving ? 'Saving…' : 'Change password'}
        </Button>
        {!forceChange && (
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        )}
      </form>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  SAM: 'var(--danger)', MAM: 'var(--warn)', NORMAL: 'var(--success)',
  HIGH: 'var(--danger)', MEDIUM: 'var(--warn)', LOW: 'var(--success)',
};
const STATUS_LABEL: Record<string, string> = { SAM: 'Severe (SAM)', MAM: 'Moderate (MAM)', NORMAL: 'Growing well' };

const panel = { borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', boxShadow: 'var(--shadow-md)' };

function fmtDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return '—';
  const d = new Date(iso);
  return withTime
    ? d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Hide most of an ID number, like banks do. */
function mask(v: string | null | undefined) {
  if (!v) return null;
  return v.length <= 4 ? v : `${'•'.repeat(Math.min(v.length - 4, 8))}${v.slice(-4)}`;
}

function Section({ title, icon: Icon, action, children }: {
  title: string; icon: typeof User; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border" style={panel}>
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
        <Icon size={17} style={{ color: 'var(--ink)' }} aria-hidden="true" />
        <h3 className="flex-1 text-base font-semibold" style={{ color: 'var(--ink)' }}>{title}</h3>
        {action}
      </div>
      <div className="px-5 pb-4">{children}</div>
    </section>
  );
}

function Row({ icon: Icon, label, value, muted }: { icon: typeof User; label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
      <Icon size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
      <span className="w-32 shrink-0 text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="flex-1 min-w-0 text-sm font-medium truncate" style={{ color: muted ? 'var(--text-muted)' : 'var(--ink)' }}>{value}</span>
    </div>
  );
}

function Stat({ value, label, href }: { value: React.ReactNode; label: string; href?: string }) {
  const body = (
    <div className="rounded-xl p-3.5 h-full transition-colors hover:bg-[var(--bg)]" style={{ backgroundColor: 'var(--bg-sand)' }}>
      <p className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--ink)' }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/** What this person does, for the role they are acting as. */
function YourWork({ summary, role }: { summary: ProfileSummary | undefined; role: string }) {
  const w = summary?.work;
  if (!w) return <div className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--bg-sand)' }} />;

  if (role === 'PARENT') {
    const kids = Array.isArray(w.children) ? w.children : [];
    return (
      <div className="flex flex-col gap-3">
        {kids.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No children are linked to your account yet. The nurse at your health centre links them.</p>
        )}
        {kids.map((c) => {
          const status = c.nutrition_status ?? undefined;
          return (
            <Link key={c.id} href={`/parent/children/${c.id}`}
              className="flex items-center gap-4 p-3.5 rounded-xl border transition-colors hover:bg-[var(--bg-sand)]"
              style={{ borderColor: 'var(--border)' }}>
              <span className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-extrabold shrink-0"
                style={{ backgroundColor: c.sex === 'F' ? '#FCE7F3' : '#DBEAFE', color: 'var(--ink)' }} aria-hidden="true">
                {c.full_name[0]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold" style={{ color: 'var(--ink)' }}>{c.full_name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {c.sex === 'F' ? 'Girl' : 'Boy'} · {c.age_display}{c.last_checkup ? ` · last check-up ${fmtDate(c.last_checkup)}` : ''}
                </p>
                <p className="text-xs mt-1" style={{ color: c.overdue_doses ? 'var(--danger)' : 'var(--ink)' }}>
                  {c.overdue_doses
                    ? `${c.overdue_doses} vaccine dose${c.overdue_doses === 1 ? '' : 's'} missed or overdue`
                    : c.next_vaccine ? `Next vaccine: ${c.next_vaccine.name} on ${fmtDate(c.next_vaccine.date)}` : 'No vaccine due'}
                </p>
              </div>
              {status && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ color: STATUS_COLOR[status], backgroundColor: 'var(--bg-sand)' }}>
                  {STATUS_LABEL[status] ?? status}
                </span>
              )}
              <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
            </Link>
          );
        })}
        {(w.care_team ?? []).map((m) => (
          <div key={m.full_name} className="flex items-center gap-3 p-3.5 rounded-xl" style={{ backgroundColor: 'var(--bg-sand)' }}>
            <HeartHandshake size={18} style={{ color: 'var(--ink)' }} aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{m.full_name}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Your community health worker</p>
            </div>
            {m.phone_number && (
              <a href={`tel:${m.phone_number}`} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--success)' }}>
                <Phone size={15} aria-hidden="true" /> Call
              </a>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (role === 'CHW') {
    const zones = Array.isArray(w.zones) ? w.zones : [];
    return (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Stat value={w.families ?? 0} label="Families" href="/chw" />
          <Stat value={typeof w.children === 'number' ? w.children : 0} label="Children" href="/chw" />
          <Stat value={w.checkups_this_month ?? 0} label="Check-ups this month" href="/chw/records" />
          <Stat value={w.open_visit_requests ?? 0} label="Open visit requests" href="/chw/requests" />
        </div>
        <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>
          {zones.length ? `Working in ${zones.join(', ')}` : 'No zone assigned yet'}
          {w.last_checkup ? ` · last check-up recorded ${fmtDate(w.last_checkup)}` : ''}
        </p>
      </>
    );
  }

  if (role === 'NURSE') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <Stat value={w.children_in_camp ?? 0} label="Children in your camp" href="/nurse/children" />
        <Stat value={w.registered_by_me ?? 0} label="Registered by you" href="/nurse/children" />
        <Stat value={w.checkups_this_month ?? 0} label="Your check-ups this month" href="/nurse/records" />
        <Stat value={w.open_referrals ?? 0} label="Open referrals" href="/nurse/referrals" />
        <Stat value={w.open_sessions ?? 0} label="Open vaccination sessions" href="/nurse/vaccines" />
      </div>
    );
  }

  if (role === 'SUPERVISOR') {
    return (
      <div className="grid grid-cols-3 gap-2.5">
        <Stat value={typeof w.zones === 'number' ? w.zones : 0} label="Zones" href="/supervisor/zones" />
        <Stat value={w.chws ?? 0} label="CHWs" href="/supervisor/staff" />
        <Stat value={w.checkups_this_month ?? 0} label="Check-ups this month" />
      </div>
    );
  }

  if (role === 'GOVERNMENT' || role === 'PARTNER') {
    const camps = Array.isArray(w.camps) ? w.camps : [];
    return w.organization ? (
      <div className="flex flex-col gap-2">
        <p className="text-sm" style={{ color: 'var(--ink)' }}>
          <span className="font-semibold">{w.organization}</span>
          <span style={{ color: 'var(--text-muted)' }}> · {w.kind === 'GOVERNMENT' ? 'Government body' : 'NGO / UN partner'}</span>
        </p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {w.all_camps ? 'You see statistics for every camp.' : camps.length ? `You see statistics for: ${camps.join(', ')}.` : 'No camps are linked to your organisation yet.'}
        </p>
        <Link href="/insights" className="self-start text-sm font-semibold underline" style={{ color: 'var(--ink)' }}>Open statistics →</Link>
      </div>
    ) : (
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Your account is not linked to an organisation yet. Ask an Ikibondo administrator.</p>
    );
  }

  if (role === 'ADMIN') {
    return (
      <div className="grid grid-cols-2 gap-2.5">
        <Stat value={typeof w.camps === 'number' ? w.camps : 0} label="Active camps" href="/admin/camps" />
        <Stat value={w.active_users ?? 0} label="Active accounts" href="/admin/users" />
      </div>
    );
  }
  return null;
}

export default function ProfilePage() {
  const searchParams = useSearchParams();
  const toast   = useToast();
  const user    = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { theme, setTheme } = useTheme();
  const { switchTo, switching } = useRoleSwitch();
  const { data: summary } = useQuery({ queryKey: ['me-summary', user?.role], queryFn: getProfileSummary, enabled: !!user });

  const forceChange = searchParams.get('force') === '1' || (user?.must_change_password ?? false);
  const [savingLang, setSavingLang] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPwModal,   setShowPwModal]   = useState(forceChange);

  // Preferences apply straight away, like most apps
  const chooseLanguage = async (value: 'rw' | 'fr' | 'en') => {
    if (!user || value === user.preferred_language) return;
    setSavingLang(true);
    try {
      setUser(await patchMe({ preferred_language: value }));
      toast.success('Language updated');
    } catch {
      toast.error('Could not change the language. Try again.');
    } finally {
      setSavingLang(false);
    }
  };

  const initials = user?.full_name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase() ?? '?';
  const nationalId = (user as (typeof user & { national_id?: string | null }) | null)?.national_id;
  const roleLabel = user ? ROLE_LABEL[user.role] : '';
  const place = user?.organization_name ?? user?.camp_name;

  return (
    <>
      <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
        {forceChange && (
          <Alert variant="warn" title="You're using a temporary password">
            Please set a new password below before continuing. You won&apos;t be able to access other pages until this is done.
          </Alert>
        )}

        {/* Identity: cover band, large avatar, who and where */}
        <section className="rounded-2xl border overflow-hidden" style={panel}>
          <div className="h-28 sm:h-32" style={{ background: 'linear-gradient(120deg, var(--ink), var(--sky))' }} aria-hidden="true" />
          <div className="px-5 sm:px-7 pb-6">
            <div className="flex flex-wrap items-end gap-4 -mt-12">
              <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-extrabold select-none shrink-0"
                style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--ink)', border: '4px solid var(--bg-elev)', boxShadow: 'var(--shadow-md)',
                  backgroundImage: 'linear-gradient(135deg, var(--bg-sand), var(--bg-elev))' }}
                aria-hidden="true">
                {initials}
              </div>
              <div className="flex-1 min-w-[12rem] pt-12 sm:pt-14">
                <h2 className="text-2xl font-bold flex items-center gap-2 flex-wrap" style={{ color: 'var(--ink)' }}>
                  {user?.full_name ?? '—'}
                  {user?.is_approved && (
                    <span title="Verified account" className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--low-bg)', color: 'var(--success)' }}>
                      <BadgeCheck size={14} aria-hidden="true" /> Verified
                    </span>
                  )}
                </h2>
                <p className="text-sm mt-1 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: 'var(--text-muted)' }}>
                  <span className="inline-flex items-center gap-1"><Briefcase size={14} aria-hidden="true" />{roleLabel}</span>
                  {place && <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden="true" />{place}</span>}
                  {summary?.member_since && <span className="inline-flex items-center gap-1"><CalendarDays size={14} aria-hidden="true" />Member since {fmtDate(summary.member_since)}</span>}
                </p>
              </div>
              {!forceChange && (
                <Button variant="secondary" onClick={() => setShowEditModal(true)}>
                  <Pencil size={15} className="mr-2" aria-hidden="true" /> Edit profile
                </Button>
              )}
            </div>
          </div>
        </section>

        {!forceChange && (
          <div className="grid lg:grid-cols-5 gap-6 items-start">
            {/* Left: their work */}
            <div className="lg:col-span-3 flex flex-col gap-6">
              <Section title={user?.role === 'PARENT' ? 'Your children' : 'Your work'} icon={user?.role === 'PARENT' ? Baby : Activity}>
                {user && <YourWork summary={summary} role={user.role} />}
              </Section>

              {(user?.roles?.length ?? 0) > 1 && (
                <Section title="Your roles" icon={Repeat}>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>You hold more than one role. Switch to see that role&apos;s pages.</p>
                  {user!.roles!.map((r) => {
                    const active = r === user!.role;
                    return (
                      <div key={r} className="flex items-center justify-between py-2.5 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                        <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{ROLE_LABEL[r]}</span>
                        {active ? (
                          <span className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--success)' }}>
                            <Check size={13} aria-hidden="true" /> Working as
                          </span>
                        ) : (
                          <Button variant="secondary" size="sm" loading={switching === r} disabled={switching !== null} onClick={() => void switchTo(r)}>
                            Switch
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </Section>
              )}
            </div>

            {/* Right: account settings */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <Section title="Personal information" icon={User}
                action={<button type="button" onClick={() => setShowEditModal(true)} className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Edit</button>}>
                <Row icon={User} label="Full name" value={user?.full_name ?? '—'} />
                <Row icon={Phone} label="Phone" value={user?.phone_number ?? 'Not added'} muted={!user?.phone_number} />
                <Row icon={Mail} label="Email" value={user?.email || 'Not added'} muted={!user?.email} />
                <Row icon={IdCard} label="National ID" value={mask(nationalId) ?? 'Not added'} muted={!nationalId} />
              </Section>

              <Section title="Sign-in & security" icon={ShieldCheck}>
                <div className="flex items-center gap-3 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
                  <KeyRound size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                  <span className="flex-1 text-sm" style={{ color: 'var(--ink)' }}>Password <span style={{ color: 'var(--text-muted)' }}>••••••••</span></span>
                  <Button variant="secondary" size="sm" onClick={() => setShowPwModal(true)}>
                    <Lock size={14} className="mr-1.5" aria-hidden="true" /> Change
                  </Button>
                </div>
                <Row icon={Clock} label="Last sign-in" value={fmtDate(summary?.last_sign_in, true)} />
                <Row icon={BadgeCheck} label="Account" value={user?.is_approved ? 'Active and verified' : 'Waiting for approval'} />
              </Section>

              <Section title="Preferences" icon={SlidersHorizontal}>
                <p id="profile-language-label" className="text-sm font-medium mb-2" style={{ color: 'var(--ink)' }}>Language</p>
                <div role="group" aria-labelledby="profile-language-label" className="grid grid-cols-3 gap-2 mb-4">
                  {LANGUAGES.map(({ value, label }) => {
                    const on = user?.preferred_language === value;
                    return (
                      <button key={value} type="button" aria-pressed={on} disabled={savingLang} onClick={() => void chooseLanguage(value)}
                        className="py-2 rounded-xl border text-sm font-medium transition-colors"
                        style={{ borderColor: on ? 'var(--ink)' : 'var(--border)', backgroundColor: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--bg-elev)' : 'var(--ink)' }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p id="profile-theme-label" className="text-sm font-medium mb-2" style={{ color: 'var(--ink)' }}>Appearance</p>
                <div role="group" aria-labelledby="profile-theme-label" className="grid grid-cols-3 gap-2">
                  {THEMES.map(({ value, label }) => {
                    const on = theme === value;
                    return (
                      <button key={value} type="button" aria-pressed={on} onClick={() => setTheme(value)}
                        className="py-2 rounded-xl border text-sm font-medium transition-colors"
                        style={{ borderColor: on ? 'var(--ink)' : 'var(--border)', backgroundColor: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--bg-elev)' : 'var(--ink)' }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </Section>

              {user?.role === 'PARENT' && (
                <Section title="Privacy" icon={Lock}>
                  <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
                    Choose what Ikibondo keeps about your children, and download or delete their records.
                  </p>
                  <Link href="/parent/consent" className="text-sm font-semibold underline" style={{ color: 'var(--ink)' }}>Consent &amp; privacy settings →</Link>
                </Section>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {user && (
        <EditProfileModal user={user} setUser={setUser} open={showEditModal} onClose={() => setShowEditModal(false)} />
      )}
      <ChangePasswordModal forceChange={forceChange} open={showPwModal} onClose={() => setShowPwModal(false)} setUser={setUser} />
    </>
  );
}
