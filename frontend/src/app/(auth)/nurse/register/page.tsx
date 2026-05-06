'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Search, UserPlus, X, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/store/authStore';
import {
  listCampParents,
  createParentAccount,
  registerChild,
  linkParentToGuardian,
  type ParentUser,
} from '@/lib/api/nurse';
import { listZones } from '@/lib/api/admin';
import type { Zone } from '@/lib/api/admin';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
  guardian_full_name: string;
  guardian_phone: string;
  guardian_relationship: string;
}

const EMPTY_PARENT: ParentForm = { full_name: '', email: '', phone_number: '' };
const EMPTY_NEWBORN: NewbornForm = {
  full_name: '', date_of_birth: '', sex: '', zone: '', notes: '',
  guardian_full_name: '', guardian_phone: '', guardian_relationship: '',
};

const RELATIONSHIPS = ['Mother', 'Father', 'Grandmother', 'Grandfather', 'Aunt', 'Uncle', 'Sibling', 'Other'];

export default function NurseRegisterPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const campId = user?.camp ?? '';

  const [step, setStep] = useState<Step>('parent');
  const [regMode, setRegMode] = useState<RegistrationMode>('newborn');
  const [parentForm, setParentForm] = useState<ParentForm>(EMPTY_PARENT);
  const [newbornForm, setNewbornForm] = useState<NewbornForm>(EMPTY_NEWBORN);
  const [zones, setZones] = useState<Zone[]>([]);

  // Parent search/select state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ParentUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedParent, setSelectedParent] = useState<ParentUser | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ child_name: string; reg_number: string; parent_name: string } | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // When an existing parent is selected, auto-fill guardian details from their account
  useEffect(() => {
    if (selectedParent) {
      setNewbornForm((prev) => ({
        ...prev,
        guardian_full_name: selectedParent.full_name,
        guardian_phone: selectedParent.phone_number,
      }));
    }
  }, [selectedParent]);

  const parentReady = selectedParent !== null || (
    showNewForm && parentForm.full_name.trim() && parentForm.email.trim() && parentForm.phone_number.trim()
  );
  const newbornReady =
    newbornForm.full_name.trim() && newbornForm.date_of_birth && newbornForm.sex &&
    newbornForm.guardian_full_name.trim() && newbornForm.guardian_phone.trim() && newbornForm.guardian_relationship;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      // Step 1: get or create parent
      let parentUser = selectedParent;
      if (!parentUser) {
        parentUser = await createParentAccount({
          full_name: parentForm.full_name.trim(),
          email: parentForm.email.trim(),
          phone_number: parentForm.phone_number.trim(),
        });
      }

      // Step 2: register newborn + guardian
      const child = await registerChild({
        full_name: newbornForm.full_name.trim(),
        date_of_birth: newbornForm.date_of_birth,
        sex: newbornForm.sex as 'M' | 'F',
        camp: campId,
        zone: newbornForm.zone || undefined,
        notes: newbornForm.notes || undefined,
        guardian: {
          full_name: newbornForm.guardian_full_name.trim(),
          phone_number: newbornForm.guardian_phone.trim(),
          relationship: newbornForm.guardian_relationship,
        },
      });

      // Step 3: link parent account to guardian
      await linkParentToGuardian(child.guardian_id, parentUser.id);

      setResult({
        child_name: child.full_name,
        reg_number: child.registration_number,
        parent_name: parentUser.full_name,
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Registration failed. Please check the form and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="flex flex-col items-center gap-6 max-w-md mx-auto pt-8 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'color-mix(in srgb, var(--success, #22c55e) 15%, transparent)', color: 'var(--success, #22c55e)' }}
        >
          <CheckCircle size={32} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
            Child registered!
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {result.child_name} has been added and linked to {result.parent_name}.
          </p>
        </div>
        <div
          className="rounded-2xl border px-8 py-5 w-full"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
        >
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Registration number</p>
          <p className="text-2xl font-mono font-bold" style={{ color: 'var(--ink)' }}>{result.reg_number}</p>
        </div>
        <div className="flex gap-3 w-full">
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => {
              setResult(null);
              setStep('parent');
              setParentForm(EMPTY_PARENT);
              setNewbornForm(EMPTY_NEWBORN);
              setSelectedParent(null);
              setShowNewForm(false);
              setSearchQuery('');
              setSearchResults([]);
            }}
          >
            Register another
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => router.push('/nurse/children')}>
            Back to children
          </Button>
        </div>
      </div>
    );
  }

  // ── Step indicators ────────────────────────────────────────────────────────
  const steps: { key: Step; label: string }[] = [
    { key: 'parent',  label: 'Parent account' },
    { key: 'newborn', label: 'Newborn info'    },
    { key: 'confirm', label: 'Confirm'          },
  ];
  const stepIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto w-full">
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
          Register child
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {user?.camp_name ?? ''} &middot; Step {stepIdx + 1} of {steps.length}
        </p>
      </div>

      {/* Mode toggle — only on step 1 (before entering child details) */}
      {step === 'parent' && (
        <div className="flex gap-2">
          {([
            { value: 'newborn',  label: 'Newborn (today)' },
            { value: 'existing', label: 'Existing child'   },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setRegMode(value);
                // Reset DOB when switching modes
                setNewbornForm((prev) => ({
                  ...prev,
                  date_of_birth: value === 'newborn' ? new Date().toISOString().split('T')[0] : '',
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
                <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                  Search existing parent
                </label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); doSearch(e.target.value); }}
                    placeholder="Search by name or phone…"
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
                      <p className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>Searching…</p>
                    )}
                    {!searching && searchResults.length === 0 && searchQuery.trim() && (
                      <p className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>No parents found.</p>
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
                          {p.is_approved ? 'Active' : 'Pending'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>or create new</span>
                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
              </div>

              {!showNewForm ? (
                <Button variant="secondary" onClick={() => setShowNewForm(true)}>
                  <UserPlus size={15} className="mr-2" />
                  New parent account
                </Button>
              ) : (
                <div className="flex flex-col gap-3">
                  <Input
                    label="Full name"
                    value={parentForm.full_name}
                    onChange={(e) => setP('full_name', e.target.value)}
                    required
                  />
                  <Input
                    label="Email address"
                    type="email"
                    value={parentForm.email}
                    onChange={(e) => setP('email', e.target.value)}
                    required
                  />
                  <Input
                    label="Phone number"
                    type="tel"
                    value={parentForm.phone_number}
                    onChange={(e) => setP('phone_number', e.target.value)}
                    required
                  />
                  <Button variant="secondary" onClick={() => setShowNewForm(false)}>Cancel</Button>
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
          <Button variant="primary" onClick={() => setStep('newborn')} disabled={!parentReady}>
            Next: Child info
          </Button>
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
                <p className="text-sm font-semibold text-amber-800">Possible duplicate detected</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {duplicates.length} existing record{duplicates.length > 1 ? 's' : ''} match this date of birth and guardian phone:
                </p>
                <ul className="mt-1 space-y-0.5">
                  {duplicates.map((d) => (
                    <li key={d.id} className="text-xs text-amber-700 font-medium">
                      {d.full_name} — {d.registration_number}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-amber-600 mt-1">Confirm this is a new child before proceeding.</p>
              </div>
            </div>
          )}
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {regMode === 'newborn' ? 'Newborn' : 'Child'}
          </p>
          <Input
            label="Full name"
            value={newbornForm.full_name}
            onChange={(e) => setN('full_name', e.target.value)}
            required
          />
          <Input
            label={regMode === 'newborn' ? 'Date of birth (today)' : 'Date of birth (known)'}
            type="date"
            value={newbornForm.date_of_birth}
            onChange={(e) => setN('date_of_birth', e.target.value)}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              Sex <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <div className="flex gap-3">
              {(['M', 'F'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setN('sex', s)}
                  className="flex-1 py-2 rounded-lg border text-sm font-medium transition-colors"
                  style={{
                    borderColor: newbornForm.sex === s ? 'var(--ink)' : 'var(--border)',
                    backgroundColor: newbornForm.sex === s ? 'var(--ink)' : 'transparent',
                    color: newbornForm.sex === s ? 'var(--bg)' : 'var(--text-muted)',
                  }}
                >
                  {s === 'M' ? 'Male' : 'Female'}
                </button>
              ))}
            </div>
          </div>

          {zones.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Zone (optional)</label>
              <select
                value={newbornForm.zone}
                onChange={(e) => setN('zone', e.target.value)}
                className="text-sm px-3 py-2 rounded-lg border outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
              >
                <option value="">No zone assigned</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>
          )}

          <Input
            label="Notes (optional)"
            value={newbornForm.notes}
            onChange={(e) => setN('notes', e.target.value)}
          />

          <p className="text-xs font-semibold uppercase tracking-wider mt-2" style={{ color: 'var(--text-muted)' }}>Guardian</p>

          {/* When an existing parent is selected, name/phone are pre-filled and read-only */}
          {selectedParent ? (
            <div
              className="rounded-xl border px-4 py-3 flex flex-col gap-1"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-sand)' }}
            >
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Pre-filled from parent account
              </p>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {selectedParent.full_name}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {selectedParent.phone_number}
              </p>
            </div>
          ) : (
            <>
              <Input
                label="Guardian full name"
                value={newbornForm.guardian_full_name}
                onChange={(e) => setN('guardian_full_name', e.target.value)}
                required
              />
              <Input
                label="Guardian phone"
                type="tel"
                value={newbornForm.guardian_phone}
                onChange={(e) => setN('guardian_phone', e.target.value)}
                required
              />
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              Relationship <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <select
              value={newbornForm.guardian_relationship}
              onChange={(e) => setN('guardian_relationship', e.target.value)}
              className="text-sm px-3 py-2 rounded-lg border outline-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
            >
              <option value="">Select relationship</option>
              {RELATIONSHIPS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('parent')} className="flex-1">Back</Button>
            <Button
              variant="primary"
              onClick={() => setStep('confirm')}
              disabled={!newbornReady}
              className="flex-1"
            >
              Review &amp; confirm
            </Button>
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
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Parent account</p>
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

            <p className="text-xs font-semibold uppercase tracking-wider mt-2" style={{ color: 'var(--text-muted)' }}>Newborn</p>
            {[
              ['Name',    newbornForm.full_name],
              ['DOB',     newbornForm.date_of_birth],
              ['Sex',     newbornForm.sex === 'M' ? 'Male' : 'Female'],
              ['Camp',    user?.camp_name ?? campId],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b last:border-b-0 pb-2 last:pb-0" style={{ borderColor: 'var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span className="font-medium" style={{ color: 'var(--ink)' }}>{v}</span>
              </div>
            ))}

            <p className="text-xs font-semibold uppercase tracking-wider mt-2" style={{ color: 'var(--text-muted)' }}>Guardian</p>
            {[
              ['Name',         newbornForm.guardian_full_name],
              ['Phone',        newbornForm.guardian_phone],
              ['Relationship', newbornForm.guardian_relationship],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b last:border-b-0 pb-2 last:pb-0" style={{ borderColor: 'var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span className="font-medium" style={{ color: 'var(--ink)' }}>{v}</span>
              </div>
            ))}
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('newborn')} className="flex-1">Back</Button>
            <Button variant="primary" loading={submitting} onClick={handleSubmit} className="flex-1">
              <UserPlus size={15} className="mr-2" aria-hidden="true" />
              Register &amp; link
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
