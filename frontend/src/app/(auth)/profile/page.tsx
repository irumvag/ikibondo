'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, Baby, BadgeCheck, BarChart3, Building2, Download, Briefcase, CalendarDays, Check, ChevronRight, Clock, HeartHandshake,
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
import { useRoleLabel } from '@/i18n/useRoleLabel';

const ROLE_HOME: Record<string, string> = {
  ADMIN:      '/admin',
  SUPERVISOR: '/supervisor',
  NURSE:      '/nurse',
  CHW:        '/chw',
  PARENT:     '/parent',
};

// Language names stay in their own language so anyone can find theirs
const LANGUAGES: { value: 'rw' | 'fr' | 'en'; label: string }[] = [
  { value: 'rw', label: 'Kinyarwanda' },
  { value: 'fr', label: 'Français'    },
  { value: 'en', label: 'English'     },
];

const THEMES = ['system', 'light', 'dark'] as const;

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
  const t = useTranslations('profile');
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
      toast.success(t('profileUpdatedSuccessfully'));
      onClose();
    } catch {
      setError(t('failedToSavePlease'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('editProfile')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {saving ? t('saving') : t('saveChanges')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <Input label={t('fullName')} type="text" value={editName} onChange={(e) => setEditName(e.target.value)} autoComplete="name" />
        <Input label={t('phoneNumber')} type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} autoComplete="tel" />
        <Input label={t('nationalId')} type="text" value={editNationalId} onChange={(e) => setEditNationalId(e.target.value)} autoComplete="off" />
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
  const t = useTranslations('profile');
  const router = useRouter();
  const toast  = useToast();
  const [pwForm, setPwForm]     = useState({ old: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError,  setPwError]  = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { setPwError(t('passwordsDoNotMatch')); return; }
    if (pwForm.next.length < 8) { setPwError(t('passwordTooShort')); return; }
    setPwSaving(true);
    setPwError('');
    try {
      await changePassword(pwForm.old, pwForm.next);
      setPwForm({ old: '', next: '', confirm: '' });
      try {
        const fresh = await getMe();
        setUser(fresh);
        toast.success(t('passwordChangedSuccessfully'));
        if (forceChange) {
          router.push(ROLE_HOME[fresh.role] ?? '/');
        } else {
          onClose();
        }
      } catch {
        toast.success(t('passwordChanged'));
        onClose();
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setPwError(msg ?? t('passwordChangeFailed'));
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={forceChange ? () => {} : onClose}
      title={t('changePassword')}
      size="sm"
    >
      <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
        {pwError && <Alert variant="danger">{pwError}</Alert>}
        <Input label={t('currentPassword')} type="password" value={pwForm.old} onChange={(e) => setPwForm({ ...pwForm, old: e.target.value })} required autoComplete="current-password" />
        <Input label={t('newPassword')} type="password" value={pwForm.next} onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })} required autoComplete="new-password" />
        <Input label={t('confirmNewPassword')} type="password" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} required autoComplete="new-password" />
        <Button type="submit" variant="primary" loading={pwSaving}>
          {pwSaving ? t('saving') : t('changePassword')}
        </Button>
        {!forceChange && (
          <Button type="button" variant="ghost" onClick={onClose}>{t('cancel')}</Button>
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
const STATUS_CODES = ['SAM', 'MAM', 'NORMAL'] as const;
const isStatusCode = (s: string): s is (typeof STATUS_CODES)[number] => (STATUS_CODES as readonly string[]).includes(s);

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
  const t = useTranslations('profile');
  const w = summary?.work;
  if (!w) return <div className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--bg-sand)' }} />;

  if (role === 'PARENT') {
    const kids = Array.isArray(w.children) ? w.children : [];
    return (
      <div className="flex flex-col gap-3">
        {kids.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('noChildrenAreLinked')}</p>
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
                  {c.sex === 'F' ? t('girl') : t('boy')} · {c.age_display}{c.last_checkup ? t('lastCheckup', { date: fmtDate(c.last_checkup) }) : ''}
                </p>
                <p className="text-xs mt-1" style={{ color: c.overdue_doses ? 'var(--danger)' : 'var(--ink)' }}>
                  {c.overdue_doses
                    ? t('dosesOverdue', { count: c.overdue_doses })
                    : c.next_vaccine ? t('nextVaccineOn', { name: c.next_vaccine.name, date: fmtDate(c.next_vaccine.date) }) : t('noVaccineDue')}
                </p>
              </div>
              {status && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ color: STATUS_COLOR[status], backgroundColor: 'var(--bg-sand)' }}>
                  {isStatusCode(status) ? t(`nutritionStatus.${status}`) : status}
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
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('yourCommunityHealthWorker')}</p>
            </div>
            {m.phone_number && (
              <a href={`tel:${m.phone_number}`} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--success)' }}>
                <Phone size={15} aria-hidden="true" />{' '}{t('call')}</a>
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
          <Stat value={w.families ?? 0} label={t('families')} href="/chw" />
          <Stat value={typeof w.children === 'number' ? w.children : 0} label={t('children')} href="/chw" />
          <Stat value={w.checkups_this_month ?? 0} label={t('checkUpsThisMonth')} href="/chw/records" />
          <Stat value={w.open_visit_requests ?? 0} label={t('openVisitRequests')} href="/chw/requests" />
        </div>
        <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>
          {zones.length ? t('workingIn', { zones: zones.join(', ') }) : t('noZoneAssignedYet')}
          {w.last_checkup ? t('lastCheckupRecorded', { date: fmtDate(w.last_checkup) }) : ''}
        </p>
      </>
    );
  }

  if (role === 'NURSE') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <Stat value={w.children_in_camp ?? 0} label={t('childrenInYourCamp')} href="/nurse/children" />
        <Stat value={w.registered_by_me ?? 0} label={t('registeredByYou')} href="/nurse/children" />
        <Stat value={w.checkups_this_month ?? 0} label={t('yourCheckUpsThis')} href="/nurse/records" />
        <Stat value={w.open_referrals ?? 0} label={t('openReferrals')} href="/nurse/referrals" />
        <Stat value={w.open_sessions ?? 0} label={t('openVaccinationSessions')} href="/nurse/vaccines" />
      </div>
    );
  }

  if (role === 'SUPERVISOR') {
    return (
      <div className="grid grid-cols-3 gap-2.5">
        <Stat value={typeof w.zones === 'number' ? w.zones : 0} label={t('zones')} href="/supervisor/zones" />
        <Stat value={w.chws ?? 0} label="CHWs" href="/supervisor/staff" />
        <Stat value={w.checkups_this_month ?? 0} label={t('checkUpsThisMonth')} />
      </div>
    );
  }

  if (role === 'GOVERNMENT' || role === 'PARTNER') {
    const camps = Array.isArray(w.camps) ? w.camps : [];
    const h = w.highlights ?? {};
    const min = w.min_cell ?? 5;
    const rate = (r?: { value: number | null; band: string | null; level: string | null } | null) =>
      r?.value == null ? `—` : `${r.value}%`;
    if (!w.organization) {
      return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('yourAccountIsNot')}</p>;
    }
    return (
      <div className="flex flex-col gap-4">
        {/* Organisation */}
        <div className="flex items-center gap-3 p-3.5 rounded-xl" style={{ backgroundColor: 'var(--bg-sand)' }}>
          <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}>
            <Building2 size={20} aria-hidden="true" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate" style={{ color: 'var(--ink)' }}>{w.organization}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {w.kind === 'GOVERNMENT' ? t('governmentBody') : t('ngoUnPartner')}
              {typeof w.colleagues === 'number' && t('colleaguesOnIkibondo', { count: w.colleagues })}
            </p>
          </div>
        </div>

        {/* Coverage */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>{t('campsYouReportOn', { value: w.camps_covered ?? camps.length })}</p>
          {w.all_camps ? (
            <p className="text-sm" style={{ color: 'var(--ink)' }}>{t('allCampsNationalOversight')}</p>
          ) : camps.length ? (
            <div className="flex flex-wrap gap-1.5">
              {camps.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}>
                  <MapPin size={12} aria-hidden="true" />{c}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('noCampsAreLinked')}</p>
          )}
        </div>

        {/* Headline figures */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Stat value={h.children?.suppressed ? `<${min}` : (h.children?.value ?? '—')} label={t('childrenCovered')} href="/insights" />
          <Stat value={rate(h.gam_rate)} label={t('wastingGam')} href="/insights" />
          <Stat value={rate(h.measles_coverage)} label={t('measlesCoverage')} href="/insights" />
          <Stat value={rate(h.penta3_coverage)} label={t('penta3Coverage')} href="/insights" />
        </div>

        {/* What the account may see */}
        <div className="rounded-xl border p-3.5 text-sm" style={{ borderColor: 'var(--border)' }}>
          <p className="font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
            <ShieldCheck size={15} aria-hidden="true" />{' '}{t('yourDataAccess')}</p>
          <ul className="flex flex-col gap-1" style={{ color: 'var(--text-muted)' }}>
            <li>{t('countsAndRatesPer')}</li>
            <li>{t('numbersFrom1To', { value: min - 1, min: min })}</li>
            <li>{t('ratesFollowWhoUnicef')}</li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/insights" className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: 'var(--ink)', color: 'var(--bg-elev)' }}>
            <BarChart3 size={15} aria-hidden="true" />{' '}{t('openStatistics')}</Link>
          <Link href="/insights/reports" className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-semibold border"
            style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}>
            <Download size={15} aria-hidden="true" />{' '}{t('downloadReport')}</Link>
        </div>
      </div>
    );
  }

  if (role === 'ADMIN') {
    return (
      <div className="grid grid-cols-2 gap-2.5">
        <Stat value={typeof w.camps === 'number' ? w.camps : 0} label={t('activeCamps')} href="/admin/camps" />
        <Stat value={w.active_users ?? 0} label={t('activeAccounts')} href="/admin/users" />
      </div>
    );
  }
  return null;
}

export default function ProfilePage() {
  const t = useTranslations('profile');
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
      toast.success(t('languageUpdated'));
    } catch {
      toast.error(t('couldNotChangeThe'));
    } finally {
      setSavingLang(false);
    }
  };

  const initials = user?.full_name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase() ?? '?';
  const nationalId = (user as (typeof user & { national_id?: string | null }) | null)?.national_id;
  const roleName = useRoleLabel();
  const roleLabel = user ? roleName(user.role) : '';
  const place = user?.organization_name ?? user?.camp_name;

  return (
    <>
      <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
        {forceChange && (
          <Alert variant="warn" title={t('youReUsingA')}>{t('pleaseSetANew')}</Alert>
        )}

        {/* Identity: cover band, large avatar, who and where */}
        <section className="rounded-2xl border overflow-hidden" style={panel}>
          <div className="h-28 sm:h-32" style={{ background: 'linear-gradient(120deg, var(--ink), var(--sky))' }} aria-hidden="true" />
          <div className="px-5 sm:px-7 pb-6">
            {/* Phone: avatar above the details; wider screens: side by side */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 sm:gap-4 -mt-12">
              <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-extrabold select-none shrink-0"
                style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--ink)', border: '4px solid var(--bg-elev)', boxShadow: 'var(--shadow-md)',
                  backgroundImage: 'linear-gradient(135deg, var(--bg-sand), var(--bg-elev))' }}
                aria-hidden="true">
                {initials}
              </div>
              <div className="flex-1 min-w-0 sm:min-w-[12rem] sm:pt-14">
                <h2 className="text-2xl font-bold flex items-center gap-2 flex-wrap" style={{ color: 'var(--ink)' }}>
                  {user?.full_name ?? '—'}
                  {user?.is_approved && (
                    <span title={t('verifiedAccount')} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--low-bg)', color: 'var(--success)' }}>
                      <BadgeCheck size={14} aria-hidden="true" />{' '}{t('verified')}</span>
                  )}
                </h2>
                <p className="text-sm mt-1 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: 'var(--text-muted)' }}>
                  <span className="inline-flex items-center gap-1"><Briefcase size={14} aria-hidden="true" />{roleLabel}</span>
                  {place && <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden="true" />{place}</span>}
                  {summary?.member_since && <span className="inline-flex items-center gap-1"><CalendarDays size={14} aria-hidden="true" />{t('memberSince', { fmtDate: fmtDate(summary.member_since) })}</span>}
                </p>
              </div>
              {!forceChange && (
                <Button variant="secondary" onClick={() => setShowEditModal(true)}>
                  <Pencil size={15} className="mr-2" aria-hidden="true" />{' '}{t('editProfile')}</Button>
              )}
            </div>
          </div>
        </section>

        {!forceChange && (
          <div className="grid lg:grid-cols-5 gap-6 items-start">
            {/* Left: their work */}
            <div className="lg:col-span-3 flex flex-col gap-6">
              <Section title={user?.role === 'PARENT' ? t('yourChildren') : t('yourWork')} icon={user?.role === 'PARENT' ? Baby : Activity}>
                {user && <YourWork summary={summary} role={user.role} />}
              </Section>

              {(user?.roles?.length ?? 0) > 1 && (
                <Section title={t('yourRoles')} icon={Repeat}>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{t('youHoldMoreThan')}</p>
                  {user!.roles!.map((r) => {
                    const active = r === user!.role;
                    return (
                      <div key={r} className="flex items-center justify-between py-2.5 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                        <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{roleName(r)}</span>
                        {active ? (
                          <span className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--success)' }}>
                            <Check size={13} aria-hidden="true" />{' '}{t('workingAs')}</span>
                        ) : (
                          <Button variant="secondary" size="sm" loading={switching === r} disabled={switching !== null} onClick={() => void switchTo(r)}>{t('switch')}</Button>
                        )}
                      </div>
                    );
                  })}
                </Section>
              )}
            </div>

            {/* Right: account settings */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <Section title={t('personalInformation')} icon={User}
                action={<button type="button" onClick={() => setShowEditModal(true)} className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('edit')}</button>}>
                <Row icon={User} label={t('fullName')} value={user?.full_name ?? '—'} />
                <Row icon={Phone} label={t('phone')} value={user?.phone_number ?? t('notAdded')} muted={!user?.phone_number} />
                <Row icon={Mail} label={t('email')} value={user?.email || t('notAdded')} muted={!user?.email} />
                <Row icon={IdCard} label={t('nationalId')} value={mask(nationalId) ?? t('notAdded')} muted={!nationalId} />
              </Section>

              <Section title={t('signInSecurity')} icon={ShieldCheck}>
                <div className="flex items-center gap-3 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
                  <KeyRound size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                  <span className="flex-1 text-sm" style={{ color: 'var(--ink)' }}>{t('password')}{' '}<span style={{ color: 'var(--text-muted)' }}>••••••••</span></span>
                  <Button variant="secondary" size="sm" onClick={() => setShowPwModal(true)}>
                    <Lock size={14} className="mr-1.5" aria-hidden="true" />{' '}{t('change')}</Button>
                </div>
                <Row icon={Clock} label={t('lastSignIn')} value={fmtDate(summary?.last_sign_in, true)} />
                <Row icon={BadgeCheck} label={t('account')} value={user?.is_approved ? t('activeAndVerified') : t('waitingForApproval')} />
              </Section>

              <Section title={t('preferences')} icon={SlidersHorizontal}>
                <p id="profile-language-label" className="text-sm font-medium mb-2" style={{ color: 'var(--ink)' }}>{t('language')}</p>
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
                <p id="profile-theme-label" className="text-sm font-medium mb-2" style={{ color: 'var(--ink)' }}>{t('appearance')}</p>
                <div role="group" aria-labelledby="profile-theme-label" className="grid grid-cols-3 gap-2">
                  {THEMES.map((value) => {
                    const on = theme === value;
                    return (
                      <button key={value} type="button" aria-pressed={on} onClick={() => setTheme(value)}
                        className="py-2 rounded-xl border text-sm font-medium transition-colors"
                        style={{ borderColor: on ? 'var(--ink)' : 'var(--border)', backgroundColor: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--bg-elev)' : 'var(--ink)' }}>
                        {t(`themeOption.${value}`)}
                      </button>
                    );
                  })}
                </div>
              </Section>

              {user?.role === 'PARENT' && (
                <Section title={t('privacy')} icon={Lock}>
                  <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>{t('chooseWhatIkibondoKeeps')}</p>
                  <Link href="/parent/consent" className="text-sm font-semibold underline" style={{ color: 'var(--ink)' }}>{t('consentPrivacySettings')}</Link>
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
