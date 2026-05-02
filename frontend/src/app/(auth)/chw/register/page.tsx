'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { registerChild } from '@/lib/api/chw';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Step = 'child' | 'guardian' | 'confirm';

interface ChildForm {
  full_name: string;
  date_of_birth: string;
  sex: 'M' | 'F' | '';
  notes: string;
}

interface GuardianForm {
  full_name: string;
  phone_number: string;
  relationship: string;
  national_id: string;
}

const EMPTY_CHILD: ChildForm    = { full_name: '', date_of_birth: '', sex: '', notes: '' };
const EMPTY_GUARDIAN: GuardianForm = { full_name: '', phone_number: '', relationship: '', national_id: '' };

export default function RegisterChildPage() {
  const router  = useRouter();
  const user    = useAuthStore((s) => s.user);
  const campId  = user?.camp ?? '';

  const [step,     setStep]     = useState<Step>('child');
  const [child,    setChild]    = useState<ChildForm>(EMPTY_CHILD);
  const [guardian, setGuardian] = useState<GuardianForm>(EMPTY_GUARDIAN);
  const [submitting, setSubmitting] = useState(false);
  const [error,    setError]    = useState('');
  const [result,   setResult]   = useState<{ registration_number: string; full_name: string } | null>(null);

  const setC = (k: keyof ChildForm,    v: string) => setChild((p)    => ({ ...p, [k]: v }));
  const setG = (k: keyof GuardianForm, v: string) => setGuardian((p) => ({ ...p, [k]: v }));

  const validateChild = () =>
    child.full_name.trim() && child.date_of_birth && child.sex;

  const validateGuardian = () =>
    guardian.full_name.trim() && guardian.phone_number.trim() && guardian.relationship.trim();

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await registerChild({
        full_name:    child.full_name.trim(),
        date_of_birth: child.date_of_birth,
        sex:          child.sex as 'M' | 'F',
        camp:         campId,
        notes:        child.notes || undefined,
        guardian: {
          full_name:    guardian.full_name.trim(),
          phone_number: guardian.phone_number.trim(),
          relationship: guardian.relationship.trim(),
          national_id:  guardian.national_id.trim(),
        },
      });
      setResult({ registration_number: res.registration_number, full_name: res.full_name });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Registration failed. Please check the form and try again.');
      setStep('child');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ───────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="flex flex-col items-center gap-6 max-w-md mx-auto pt-8 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--success-bg, #f0fdf4)', color: 'var(--success, #22c55e)' }}
        >
          <CheckCircle size={32} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
            Child registered!
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {result.full_name} has been added to the system.
          </p>
        </div>
        <div
          className="rounded-2xl border px-8 py-5 w-full"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
        >
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Registration number
          </p>
          <p className="text-2xl font-mono font-bold" style={{ color: 'var(--ink)' }}>
            {result.registration_number}
          </p>
        </div>
        <div className="flex gap-3 w-full">
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => { setResult(null); setChild(EMPTY_CHILD); setGuardian(EMPTY_GUARDIAN); setStep('child'); }}
          >
            Register another
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => router.push('/chw')}>
            Back to caseload
          </Button>
        </div>
      </div>
    );
  }

  // ── Step indicators ──────────────────────────────────────────────────────────
  const steps: { key: Step; label: string }[] = [
    { key: 'child',   label: 'Child info'    },
    { key: 'guardian', label: 'Guardian'     },
    { key: 'confirm',  label: 'Confirm'      },
  ];
  const stepIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Register a child
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {user?.camp_name ?? ''} &middot; Step {stepIdx + 1} of {steps.length}
        </p>
      </div>

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

      {/* Step: Child info */}
      {step === 'child' && (
        <div className="flex flex-col gap-4">
          <Input
            label="Full name"
            value={child.full_name}
            onChange={(e) => setC('full_name', e.target.value)}
            placeholder="Enter child's full name"
            required
          />
          <Input
            label="Date of birth"
            type="date"
            value={child.date_of_birth}
            onChange={(e) => setC('date_of_birth', e.target.value)}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Sex <span style={{ color: 'var(--danger)' }}>*</span></label>
            <div className="flex gap-3">
              {(['M', 'F'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setC('sex', s)}
                  className="flex-1 py-2 rounded-lg border text-sm font-medium transition-colors"
                  style={{
                    borderColor: child.sex === s ? 'var(--ink)' : 'var(--border)',
                    backgroundColor: child.sex === s ? 'var(--ink)' : 'transparent',
                    color: child.sex === s ? 'var(--bg)' : 'var(--text-muted)',
                  }}
                >
                  {s === 'M' ? 'Male' : 'Female'}
                </button>
              ))}
            </div>
          </div>
          <Input
            label="Notes (optional)"
            value={child.notes}
            onChange={(e) => setC('notes', e.target.value)}
            placeholder="Any additional notes"
          />
          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <Button
            variant="primary"
            onClick={() => setStep('guardian')}
            disabled={!validateChild()}
          >
            Next: Guardian info
          </Button>
        </div>
      )}

      {/* Step: Guardian */}
      {step === 'guardian' && (
        <div className="flex flex-col gap-4">
          <Input
            label="Guardian full name"
            value={guardian.full_name}
            onChange={(e) => setG('full_name', e.target.value)}
            required
          />
          <Input
            label="Phone number"
            type="tel"
            value={guardian.phone_number}
            onChange={(e) => setG('phone_number', e.target.value)}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Relationship <span style={{ color: 'var(--danger)' }}>*</span></label>
            <select
              value={guardian.relationship}
              onChange={(e) => setG('relationship', e.target.value)}
              className="text-sm px-3 py-2 rounded-lg border outline-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
            >
              <option value="">Select relationship</option>
              {['Mother', 'Father', 'Grandmother', 'Grandfather', 'Aunt', 'Uncle', 'Sibling', 'Other'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <Input
            label="National ID (optional)"
            value={guardian.national_id}
            onChange={(e) => setG('national_id', e.target.value)}
            placeholder="e.g. 1 1990 7 1234567 0 89"
          />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('child')} className="flex-1">Back</Button>
            <Button
              variant="primary"
              onClick={() => setStep('confirm')}
              disabled={!validateGuardian()}
              className="flex-1"
            >
              Review &amp; confirm
            </Button>
          </div>
        </div>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && (
        <div className="flex flex-col gap-4">
          <div
            className="rounded-2xl border p-5 flex flex-col gap-3"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Child</p>
            {[
              ['Name',          child.full_name],
              ['Date of birth', child.date_of_birth],
              ['Sex',           child.sex === 'M' ? 'Male' : 'Female'],
              ['Camp',          user?.camp_name ?? campId],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b last:border-b-0 pb-2 last:pb-0" style={{ borderColor: 'var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span className="font-medium" style={{ color: 'var(--ink)' }}>{v}</span>
              </div>
            ))}
            <p className="text-xs font-semibold uppercase tracking-wider mt-2" style={{ color: 'var(--text-muted)' }}>Guardian</p>
            {[
              ['Name',         guardian.full_name],
              ['Phone',        guardian.phone_number],
              ['Relationship', guardian.relationship],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b last:border-b-0 pb-2 last:pb-0" style={{ borderColor: 'var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span className="font-medium" style={{ color: 'var(--ink)' }}>{v}</span>
              </div>
            ))}
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('guardian')} className="flex-1">Back</Button>
            <Button
              variant="primary"
              loading={submitting}
              onClick={handleSubmit}
              className="flex-1"
            >
              <UserPlus size={15} className="mr-2" aria-hidden="true" />
              Register child
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
