'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { CheckCircle, Search, UserPlus, X, AlertTriangle, Copy, UserCheck, KeyRound } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/store/authStore';
import {
  listCampParents,
  createParentAccount,
  registerChild,
  linkParentToGuardian,
  lookupGuardianByPhone,
  resendSetupLink,
  type ParentUser,
  type SetupDelivery,
  type GuardianLookupResult,
} from '@/lib/api/nurse';
import { listZones } from '@/lib/api/admin';
import type { Zone } from '@/lib/api/admin';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), { ssr: false });

type Step = 'parent' | 'newborn' | 'confirm';
type RegistrationMode = 'newborn' | 'existing';

interface ParentForm {
  full_name: string;
  email: string;
  phone_number: string;
}

interface NewbornForm {
  full_name: string;
  date_of_birth: string;
  sex: 'M' | 'F' | '';
  zone: string;
  notes: string;
  birth_weight: string;
  gestational_age: string;
  feeding_type: 'BREAST' | 'FORMULA' | 'MIXED' | '';
  guardian_full_name: string;
  guardian_phone: string;
  guardian_relationship: string;
}

const EMPTY_PARENT: ParentForm = { full_name: '', email: '', phone_number: '' };
/** Today's date on the device (YYYY-MM-DD). toISOString() would give the UTC date,
 *  which in Rwanda is still yesterday between midnight and 2 a.m. */
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const EMPTY_NEWBORN: NewbornForm = {
  full_name: '', date_of_birth: '', sex: '', zone: '', notes: '',
  birth_weight: '', gestational_age: '', feeding_type: '',
  guardian_full_name: '', guardian_phone: '', guardian_relationship: '',
};

// Saved in English; shown as messages/en.json nurse.register.relationshipOption.<value>
const RELATIONSHIPS = ['Mother', 'Father', 'Grandmother', 'Grandfather', 'Aunt', 'Uncle', 'Sibling', 'Other'] as const;

// ── Account setup (parent sets their own password) ─────────────────────────────

type RegistrationResult = {
  child_name: string;
  reg_number: string;
  parent_id: string;
  parent_name: string;
  login_id: string;
  /** false until the parent has used their set-password link */
  password_set: boolean;
  setup_delivery?: SetupDelivery;
  /** only present when no SMS/email went out */
  setup_link?: string;
  account_created: boolean;
};

// Which message (messages/en.json nurse.register.delivery.<key>) describes how the set-password link went out
function deliveryKey(d: SetupDelivery | undefined): 'none' | 'smsEmail' | 'sms' | 'email' | 'noneSent' {
  if (!d) return 'none';
  if (d.sms && d.email) return 'smsEmail';
  if (d.sms) return 'sms';
  if (d.email) return 'email';
  return 'noneSent';
}

function SetupLinkPanel({ result }: { result: RegistrationResult }) {
  const t = useTranslations('nurse.register');
  const [delivery, setDelivery] = useState<SetupDelivery | undefined>(result.setup_delivery);
  const [link, setLink]         = useState<string | undefined>(result.setup_link);
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState('');

  const resend = async () => {
    setSending(true);
    setError('');
    try {
      const updated = await resendSetupLink(result.parent_id);
      setDelivery(updated.setup_delivery);
      setLink(updated.setup_link);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? t('couldNotSendA'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-4"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
    >
      <div className="flex items-start gap-2">
        <KeyRound size={16} style={{ color: 'var(--ink)', marginTop: 2 }} aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('choosesTheirOwnPassword', { parent_name: result.parent_name })}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.rich('linkWorksOnce', { delivery: t(`delivery.${deliveryKey(delivery)}`, { name: result.parent_name }), login: result.login_id || t('theirPhoneNumber'), b: (chunks) => <strong>{chunks}</strong> })}
          </p>
        </div>
      </div>

      {link && (
        <div className="flex justify-center rounded-xl p-4" style={{ backgroundColor: '#fff' }}>
          <QRCodeSVG value={link} size={180} level="M" aria-label={t('setPasswordLinkFor')} />
        </div>
      )}

      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}

      <Button variant="secondary" onClick={resend} disabled={sending}>
        {sending ? t('sending') : t('sendANewLink')}
      </Button>
    </div>
  );
}

function SuccessScreen({
  result,
  onReset,
  onBack,
}: {
  result: RegistrationResult;
  onReset: () => void;
  onBack: () => void;
}) {
  const t = useTranslations('nurse.register');
  return (
    <div className="flex flex-col gap-5 max-w-md mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--low-bg)', color: 'var(--success)' }}
        >
          <CheckCircle size={24} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>{t('childRegistered')}</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('hasBeenAddedAnd', { child_name: result.child_name, parent_name: result.parent_name })}</p>
        </div>
      </div>

      {/* Registration number */}
      <div
        className="rounded-2xl border px-5 py-4"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{t('registrationNumber')}</p>
        <p className="text-2xl font-mono font-bold" style={{ color: 'var(--ink)' }}>{result.reg_number}</p>
      </div>

      {/* Set-password link — while the parent has not chosen a password yet */}
      {!result.password_set && <SetupLinkPanel result={result} />}

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="primary" className="flex-1" onClick={onReset}>{t('registerAnother')}</Button>
        <Button variant="secondary" className="flex-1" onClick={onBack}>{t('backToChildren')}</Button>
      </div>
    </div>
  );
}

export default function NurseRegisterPage() {
  const t = useTranslations('nurse.register');
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const campId = user?.camp ?? '';

  const [step, setStep] = useState<Step>('parent');
  const [regMode, setRegMode] = useState<RegistrationMode>('newborn');
  const [parentForm, setParentForm] = useState<ParentForm>(EMPTY_PARENT);
  const [newbornForm, setNewbornForm] = useState<NewbornForm>(() => ({ ...EMPTY_NEWBORN, date_of_birth: todayLocal() }));
  const [zones, setZones] = useState<Zone[]>([]);

  // Parent search/select state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ParentUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedParent, setSelectedParent] = useState<ParentUser | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  // Guardian phone lookup — fires when nurse types a phone in the guardian section
  const [existingGuardian, setExistingGuardian] = useState<GuardianLookupResult | null>(null);
  const guardianLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RegistrationResult | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitLock = useRef(false); // prevent double-submit on fast clicks

  // Duplicate detection: query backend when DOB + guardian phone are filled
  const dupEnabled = Boolean(newbornForm.date_of_birth && newbornForm.guardian_phone.length >= 6);
  const { data: duplicates = [] } = useQuery({
    queryKey: ['dup-check', newbornForm.date_of_birth, newbornForm.guardian_phone, newbornForm.full_name],
    queryFn: async () => {
      const { data } = await apiClient.get('/children/duplicate-check/', {
        params: {
          dob: newbornForm.date_of_birth,
          guardian_phone: newbornForm.guardian_phone,
          full_name: newbornForm.full_name,
        },
      });
      return (data.data ?? []) as { id: string; full_name: string; registration_number: string }[];
    },
    enabled: dupEnabled,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (campId) {
      listZones(campId).then(setZones).catch(() => {});
    }
  }, [campId]);

  const doSearch = (q: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await listCampParents(q.trim());
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  const setP = (k: keyof ParentForm, v: string) => setParentForm((p) => ({ ...p, [k]: v }));
  const setN = (k: keyof NewbornForm, v: string) => setNewbornForm((p) => ({ ...p, [k]: v }));

  // Debounced guardian phone lookup — only fires when no existing parent is selected
  const handleGuardianPhone = (phone: string) => {
    setN('guardian_phone', phone);
    setExistingGuardian(null);
    if (guardianLookupTimer.current) clearTimeout(guardianLookupTimer.current);
    if (phone.replace(/\D/g, '').length < 8) return;
    guardianLookupTimer.current = setTimeout(async () => {
      try {
        const found = await lookupGuardianByPhone(phone);
        setExistingGuardian(found);
        if (found) {
          // Auto-fill guardian name from existing record
          setNewbornForm((prev) => ({ ...prev, guardian_full_name: found.full_name }));
        }
      } catch { /* silent */ }
    }, 500);
  };

  // When an existing parent is selected, auto-fill guardian details from their account
  useEffect(() => {
    if (selectedParent) {
      setNewbornForm((prev) => ({
        ...prev,
        guardian_full_name: selectedParent.full_name ?? '',
        guardian_phone: selectedParent.phone_number ?? '',
      }));
    }
  }, [selectedParent]);

  const parentReady = selectedParent !== null || (
    showNewForm && parentForm.full_name.trim() && parentForm.phone_number.trim()
    // email is optional — parent can log in with phone
  );
  const newbornReady =
    (newbornForm.full_name ?? '').trim() && newbornForm.date_of_birth && newbornForm.sex &&
    (newbornForm.guardian_full_name ?? '').trim() && (newbornForm.guardian_phone ?? '').trim() && newbornForm.guardian_relationship;

  const resetForm = () => {
    setResult(null);
    setStep('parent');
    setParentForm(EMPTY_PARENT);
    setNewbornForm({ ...EMPTY_NEWBORN, date_of_birth: regMode === 'newborn' ? todayLocal() : '' });
    setSelectedParent(null);
    setSearchQuery('');
    setSearchResults([]);
    setShowNewForm(false);
    setError('');
    setExistingGuardian(null);
  };

  const handleSubmit = async () => {
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setError('');
    try {
      // Step 1: register the child first. For a new parent the account is created after,
      // so a failed registration never leaves an account with no child behind.
      // If the selected parent already has a guardian record, reuse it so we
      // don't create a duplicate Guardian and avoid the 409 on link-account.
      const existingGuardianId = selectedParent?.guardian_id ?? undefined;

      // Optional neonatal fields are only sent when filled in (the API refuses null)
      const neonatal = {
        ...(newbornForm.birth_weight ? { birth_weight: parseFloat(newbornForm.birth_weight) } : {}),
        ...(newbornForm.gestational_age ? { gestational_age: parseInt(newbornForm.gestational_age, 10) } : {}),
        ...(newbornForm.feeding_type ? { feeding_type: newbornForm.feeding_type as 'BREAST' | 'FORMULA' | 'MIXED' } : {}),
      };

      const child = await registerChild(
        existingGuardianId
          ? {
              // Attach new child to the parent's existing Guardian — no new Guardian created
              full_name: newbornForm.full_name.trim(),
              date_of_birth: newbornForm.date_of_birth,
              sex: newbornForm.sex as 'M' | 'F',
              camp: campId,
              zone: newbornForm.zone || undefined,
              notes: newbornForm.notes || undefined,
              existing_guardian_id: existingGuardianId,
              ...neonatal,
            }
          : {
              // First registration for this parent — create a new Guardian
              full_name: newbornForm.full_name.trim(),
              date_of_birth: newbornForm.date_of_birth,
              sex: newbornForm.sex as 'M' | 'F',
              camp: campId,
              zone: newbornForm.zone || undefined,
              notes: newbornForm.notes || undefined,
              ...neonatal,
              guardian: {
                full_name: newbornForm.guardian_full_name.trim(),
                phone_number: newbornForm.guardian_phone.trim(),
                relationship: newbornForm.guardian_relationship,
              },
            },
      );

      // Step 2: the parent account (new parents only), then link it to the child's guardian
      let parentUser = selectedParent;
      if (!parentUser) {
        parentUser = await createParentAccount({
          full_name: parentForm.full_name.trim(),
          email: parentForm.email.trim(),
          phone_number: parentForm.phone_number.trim(),
        });
      }
      if (!existingGuardianId) {
        await linkParentToGuardian(child.guardian_id, parentUser.id);
      }

      const accountCreated = !selectedParent; // true when we just created a new account
      setResult({
        child_name: child.full_name,
        reg_number: child.registration_number,
        parent_name: parentUser.full_name,
        login_id: parentUser.phone_number || parentUser.email || '',
        parent_id: parentUser.id,
        password_set: parentUser.password_set ?? true,
        setup_delivery: parentUser.setup_delivery,
        setup_link: parentUser.setup_link,
        account_created: accountCreated,
      });
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
      setError(data?.error ?? data?.message ?? t('registrationFailedPleaseCheck'));
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (result) {
    return <SuccessScreen result={result} onReset={resetForm} onBack={() => router.push('/nurse/children')} />;
  }

  // ── Step indicators ────────────────────────────────────────────────────────
  const steps: { key: Step; label: string }[] = [
    { key: 'parent',  label: t('parentAccount') },
    { key: 'newborn', label: t('newbornInfo')    },
    { key: 'confirm', label: t('confirm')          },
  ];
  const stepIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto w-full">
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>{t('registerChild')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {user?.camp_name ?? ''}{' '}{t('stepOf', { value: stepIdx + 1, length: steps.length })}</p>
      </div>

      {/* Mode toggle — only on step 1 (before entering child details) */}
      {step === 'parent' && (
        <div className="flex gap-2">
          {([
            { value: 'newborn',  label: t('newbornToday') },
            { value: 'existing', label: t('existingChild')   },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setRegMode(value);
                // Reset DOB when switching modes
                setNewbornForm((prev) => ({
                  ...prev,
                  date_of_birth: value === 'newborn' ? todayLocal() : '',
                }));
              }}
              className="flex-1 py-2 rounded-lg border text-sm font-medium transition-colors"
              style={{
                borderColor: regMode === value ? 'var(--ink)' : 'var(--border)',
                backgroundColor: regMode === value ? 'var(--ink)' : 'transparent',
                color: regMode === value ? 'var(--bg)' : 'var(--text-muted)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div className="flex gap-2">
        {steps.map((s, i) => (
          <div
            key={s.key}
            className="flex-1 h-1.5 rounded-full"
            style={{
              backgroundColor: i <= stepIdx ? 'var(--ink)' : 'var(--border)',
              transition: 'background-color 0.2s',
            }}
          />
        ))}
      </div>

      {/* ── Step 1: Parent account ─────────────────────────────────────────── */}
      {step === 'parent' && (
        <div className="flex flex-col gap-4">
          {!selectedParent && (
            <>
              {/* Search existing */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="register-search-parent" className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('searchExistingParent')}</label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input
                    id="register-search-parent"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); doSearch(e.target.value); }}
                    placeholder={t('searchByNameOr')}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
                  />
                </div>
                {(searching || searchResults.length > 0) && (
                  <div
                    className="rounded-xl border divide-y overflow-hidden"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
                  >
                    {searching && (
                      <p className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>{t('searching')}</p>
                    )}
                    {!searching && searchResults.length === 0 && searchQuery.trim() && (
                      <p className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>{t('noParentsFound')}</p>
                    )}
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setSelectedParent(p); setShowNewForm(false); }}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--bg-sand)] transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{p.full_name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.phone_number} · {p.email}</p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}>
                          {p.is_approved ? t('active') : t('pending')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('orCreateNew')}</span>
                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
              </div>

              {!showNewForm ? (
                <Button variant="secondary" onClick={() => setShowNewForm(true)}>
                  <UserPlus size={15} className="mr-2" />{t('newParentAccount')}</Button>
              ) : (
                <div className="flex flex-col gap-3">
                  <Input
                    label={t('fullName')}
                    value={parentForm.full_name}
                    onChange={(e) => setP('full_name', e.target.value)}
                    required
                  />
                  <Input
                    label={t('emailAddress')}
                    type="email"
                    value={parentForm.email}
                    onChange={(e) => setP('email', e.target.value)}
                    required
                  />
                  <Input
                    label={t('phoneNumber')}
                    type="tel"
                    value={parentForm.phone_number}
                    onChange={(e) => setP('phone_number', e.target.value)}
                    required
                  />
                  <Button variant="secondary" onClick={() => setShowNewForm(false)}>{t('cancel')}</Button>
                </div>
              )}
            </>
          )}

          {/* Selected parent chip */}
          {selectedParent && (
            <div
              className="flex items-center justify-between rounded-xl border px-4 py-3"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{selectedParent.full_name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{selectedParent.phone_number} · {selectedParent.email}</p>
              </div>
              <button type="button" onClick={() => { setSelectedParent(null); setSearchQuery(''); setSearchResults([]); }}>
                <X size={15} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          )}

          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <Button variant="primary" onClick={() => setStep('newborn')} disabled={!parentReady}>{t('nextChildInfo')}</Button>
        </div>
      )}

      {/* ── Step 2: Newborn details ────────────────────────────────────────── */}
      {step === 'newborn' && (
        <div className="flex flex-col gap-4">
          {/* Duplicate warning */}
          {duplicates.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">{t('possibleDuplicateDetected')}</p>
                <p className="text-xs text-amber-700 mt-0.5">{t('existingRecords', { count: duplicates.length })}</p>
                <ul className="mt-1 space-y-0.5">
                  {duplicates.map((d) => (
                    <li key={d.id} className="text-xs text-amber-700 font-medium">
                      {d.full_name} — {d.registration_number}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-amber-600 mt-1">{t('confirmThisIsA')}</p>
              </div>
            </div>
          )}
          <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            {regMode === 'newborn' ? t('newborn') : t('child')}
          </p>
          <Input
            label={t('fullName')}
            value={newbornForm.full_name}
            onChange={(e) => setN('full_name', e.target.value)}
            required
          />
          <Input
            label={regMode === 'newborn' ? t('dateOfBirthToday') : t('dateOfBirthKnown')}
            type="date"
            value={newbornForm.date_of_birth}
            onChange={(e) => setN('date_of_birth', e.target.value)}
            required
          />
          <div className="flex flex-col gap-1.5">
            <p id="register-sex-label" className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('sex')}{' '}<span style={{ color: 'var(--danger)' }}>*</span>
            </p>
            <div role="group" aria-labelledby="register-sex-label" className="flex gap-3">
              {(['M', 'F'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={newbornForm.sex === s}
                  onClick={() => setN('sex', s)}
                  className="flex-1 py-2 rounded-lg border text-sm font-medium transition-colors"
                  style={{
                    borderColor: newbornForm.sex === s ? 'var(--ink)' : 'var(--border)',
                    backgroundColor: newbornForm.sex === s ? 'var(--ink)' : 'transparent',
                    color: newbornForm.sex === s ? 'var(--bg)' : 'var(--text-muted)',
                  }}
                >
                  {s === 'M' ? t('male') : t('female')}
                </button>
              ))}
            </div>
          </div>

          {/* ── Neonatal clinical details (optional) ─────────────────────── */}
          <p className="text-xs font-semibold mt-1" style={{ color: 'var(--text-muted)' }}>{t('clinicalDetails')}{' '}<span className="font-normal normal-case">{t('optional')}</span>
          </p>
          <div className="flex gap-3">
            <Input
              label={t('birthWeightKg')}
              type="number"
              inputMode="decimal"
              value={newbornForm.birth_weight}
              onChange={(e) => setN('birth_weight', e.target.value)}
              placeholder="e.g. 3.25"
            />
            <Input
              label={t('gestationalAgeWks')}
              type="number"
              inputMode="numeric"
              value={newbornForm.gestational_age}
              onChange={(e) => setN('gestational_age', e.target.value)}
              placeholder="e.g. 38"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <p id="register-feeding-label" className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('feedingType')}</p>
            <div role="group" aria-labelledby="register-feeding-label" className="flex gap-2">
              {([
                { value: 'BREAST',  label: t('breastfed')  },
                { value: 'FORMULA', label: t('formula')     },
                { value: 'MIXED',   label: t('mixed')       },
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={newbornForm.feeding_type === value}
                  onClick={() => setN('feeding_type', newbornForm.feeding_type === value ? '' : value)}
                  className="flex-1 py-2 rounded-lg border text-sm font-medium transition-colors"
                  style={{
                    borderColor: newbornForm.feeding_type === value ? 'var(--ink)' : 'var(--border)',
                    backgroundColor: newbornForm.feeding_type === value ? 'var(--ink)' : 'transparent',
                    color: newbornForm.feeding_type === value ? 'var(--bg)' : 'var(--text-muted)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {zones.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-zone-optional" className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('zoneOptional')}</label>
              <select id="register-zone-optional"
                value={newbornForm.zone}
                onChange={(e) => setN('zone', e.target.value)}
                className="text-sm px-3 py-2 rounded-lg border outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
              >
                <option value="">{t('noZoneAssigned')}</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>
          )}

          <Input
            label={t('notesOptional')}
            value={newbornForm.notes}
            onChange={(e) => setN('notes', e.target.value)}
          />

          <p className="text-xs font-semibold mt-2" style={{ color: 'var(--text-muted)' }}>{t('guardian')}</p>

          {/* When an existing parent is selected, name/phone are pre-filled and read-only */}
          {selectedParent ? (
            <div
              className="rounded-xl border px-4 py-3 flex flex-col gap-1"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-sand)' }}
            >
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('preFilledFromParent')}</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {selectedParent.full_name}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {selectedParent.phone_number}
              </p>
            </div>
          ) : (
            <>
              {/* "Same as parent" shortcut — only when creating a new parent account */}
              {showNewForm && parentForm.full_name.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setN('guardian_full_name', parentForm.full_name);
                    setN('guardian_phone', parentForm.phone_number);
                  }}
                  className="self-start flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-[var(--bg-sand)]"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  <Copy size={13} aria-hidden="true" />{t('sameAsParentCopy')}</button>
              )}
              <Input
                label={t('guardianPhone')}
                type="tel"
                value={newbornForm.guardian_phone}
                onChange={(e) => handleGuardianPhone(e.target.value)}
                required
              />
              {/* Existing guardian found by phone — inform nurse, child will be linked, no duplicate */}
              {existingGuardian && (
                <div
                  className="rounded-xl border px-4 py-3 flex items-start gap-3"
                  style={{
                    borderColor: 'var(--success)',
                    backgroundColor: 'color-mix(in srgb, var(--success) 8%, var(--bg-elev))',
                  }}
                >
                  <UserCheck size={16} style={{ color: 'var(--success)', marginTop: 2 }} className="shrink-0" />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('existingGuardianFoundNo')}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {existingGuardian.full_name} · {existingGuardian.phone_number}
                      {existingGuardian.children_count > 0
                        ? t('alreadyRegistered', { count: existingGuardian.children_count })
                        : ''}
                      {existingGuardian.has_account ? t('hasAppAccount') : ''}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('thisNewChildWill')}</p>
                  </div>
                </div>
              )}
              <Input
                label={t('guardianFullName')}
                value={newbornForm.guardian_full_name}
                onChange={(e) => setN('guardian_full_name', e.target.value)}
                required
              />
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="register-relationship" className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('relationship')}{' '}<span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <select id="register-relationship"
              value={newbornForm.guardian_relationship}
              onChange={(e) => setN('guardian_relationship', e.target.value)}
              className="text-sm px-3 py-2 rounded-lg border outline-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
            >
              <option value="">{t('selectRelationship')}</option>
              {RELATIONSHIPS.map((r) => (
                <option key={r} value={r}>{t(`relationshipOption.${r}`)}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('parent')} className="flex-1">{t('back')}</Button>
            <Button
              variant="primary"
              onClick={() => setStep('confirm')}
              disabled={!newbornReady}
              className="flex-1"
            >{t('reviewConfirm')}</Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Confirm ───────────────────────────────────────────────── */}
      {step === 'confirm' && (
        <div className="flex flex-col gap-4">
          <div
            className="rounded-2xl border p-5 flex flex-col gap-3"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
          >
            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('parentAccount')}</p>
            {[
              ['Name',  selectedParent?.full_name ?? parentForm.full_name],
              ['Email', selectedParent?.email ?? parentForm.email],
              ['Phone', selectedParent?.phone_number ?? parentForm.phone_number],
              ['Status', selectedParent ? 'Existing account' : 'Will be created'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b last:border-b-0 pb-2 last:pb-0" style={{ borderColor: 'var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span className="font-medium" style={{ color: 'var(--ink)' }}>{v}</span>
              </div>
            ))}

            <p className="text-xs font-semibold mt-2" style={{ color: 'var(--text-muted)' }}>{t('newborn')}</p>
            {[
              [t('summaryRow.name'),             newbornForm.full_name],
              [t('summaryRow.dob'),              newbornForm.date_of_birth],
              [t('summaryRow.sex'),              newbornForm.sex === 'M' ? t('summaryRow.male') : t('summaryRow.female')],
              [t('summaryRow.camp'),             user?.camp_name ?? campId],
              ...(newbornForm.birth_weight    ? [[t('summaryRow.birthWeight'),    t('summaryRow.kg', { value: newbornForm.birth_weight })]]   : []),
              ...(newbornForm.gestational_age ? [[t('summaryRow.gestationalAge'), t('summaryRow.weeks', { value: newbornForm.gestational_age })]] : []),
              ...(newbornForm.feeding_type    ? [[t('summaryRow.feedingType'),    t(`summaryRow.feeding.${newbornForm.feeding_type}`)]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b last:border-b-0 pb-2 last:pb-0" style={{ borderColor: 'var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span className="font-medium" style={{ color: 'var(--ink)' }}>{v}</span>
              </div>
            ))}

            <p className="text-xs font-semibold mt-2" style={{ color: 'var(--text-muted)' }}>{t('guardian')}</p>
            {[
              [t('summaryRow.name'),         newbornForm.guardian_full_name],
              [t('summaryRow.phone'),        newbornForm.guardian_phone],
              [t('summaryRow.relationship'), newbornForm.guardian_relationship ? t(`relationshipOption.${newbornForm.guardian_relationship as (typeof RELATIONSHIPS)[number]}`) : ''],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b last:border-b-0 pb-2 last:pb-0" style={{ borderColor: 'var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span className="font-medium" style={{ color: 'var(--ink)' }}>{v}</span>
              </div>
            ))}
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('newborn')} className="flex-1">{t('back')}</Button>
            <Button variant="primary" loading={submitting} onClick={handleSubmit} className="flex-1">
              <UserPlus size={15} className="mr-2" aria-hidden="true" />{t('registerLink')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
