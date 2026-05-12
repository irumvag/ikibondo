'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';

type Role = 'CHW' | 'NURSE' | 'SUPERVISOR' | 'ADMIN' | 'PARENT';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
}

const ROLE_CHECKLISTS: Record<Role, ChecklistItem[]> = {
  CHW: [
    { id: 'profile', label: 'Set up your profile', description: 'Confirm your name, phone number, and language preference.' },
    { id: 'caseload', label: 'Review your caseload', description: 'Familiarise yourself with the families assigned to you.' },
    { id: 'visit', label: 'Record your first visit', description: 'Conduct a home visit and submit health measurements.' },
    { id: 'offline', label: 'Test offline mode', description: 'Record a visit without internet and sync when reconnected.' },
  ],
  NURSE: [
    { id: 'profile', label: 'Set up your profile', description: 'Confirm your name and facility.' },
    { id: 'register', label: 'Register a child', description: 'Use the child registration form to enrol a newborn or existing child.' },
    { id: 'vaccine', label: 'Administer a vaccination', description: 'Record a vaccine dose against a scheduled appointment.' },
    { id: 'approve', label: 'Review parent approvals', description: 'Check the pending approvals queue and approve or decline accounts.' },
  ],
  SUPERVISOR: [
    { id: 'profile', label: 'Set up your profile', description: 'Confirm your name and assigned camp.' },
    { id: 'staff', label: 'Review your staff', description: 'View CHWs and nurses assigned to your camp.' },
    { id: 'analytics', label: 'Explore analytics', description: 'Check the nutrition overview and high-risk records.' },
    { id: 'assign', label: 'Assign a CHW to a family', description: 'Use the guardian management page to assign a CHW.' },
  ],
  ADMIN: [
    { id: 'profile', label: 'Set up your profile', description: 'Confirm your admin account details.' },
    { id: 'camp', label: 'Configure a camp', description: 'Create or update camp and zone information.' },
    { id: 'user', label: 'Create a staff account', description: 'Add a nurse or supervisor through user management.' },
    { id: 'ml', label: 'Review ML model status', description: 'Check that all prediction models are loaded and ready.' },
  ],
  PARENT: [
    { id: 'profile', label: 'Set up your profile', description: 'Add your phone number and preferred language.' },
    { id: 'children', label: 'View your children', description: 'See your child\'s health records and growth chart.' },
    { id: 'consent', label: 'Review data consent', description: 'Understand how your data is used under UNHCR policy.' },
    { id: 'notifications', label: 'Set notification preferences', description: 'Choose how you want to receive health reminders.' },
  ],
};

const ROLE_LANDING: Record<Role, string> = {
  CHW: '/chw',
  NURSE: '/nurse',
  SUPERVISOR: '/supervisor',
  ADMIN: '/admin',
  PARENT: '/parent',
};

export default function OnboardingPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const router = useRouter();

  const role = (user?.role ?? 'PARENT') as Role;
  const checklist = ROLE_CHECKLISTS[role] ?? ROLE_CHECKLISTS.PARENT;

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState(false);

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allChecked = checked.size === checklist.length;

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const { data } = await apiClient.post('/auth/onboarding/complete/');
      if (user && data?.data) {
        setUser({ ...user, onboarded_at: data.data.onboarded_at ?? new Date().toISOString() });
      }
      router.push(ROLE_LANDING[role] ?? '/');
    } catch {
      // Even on error, redirect — onboarding is best-effort
      router.push(ROLE_LANDING[role] ?? '/');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-start justify-center pt-12 px-4 pb-12"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className="w-full max-w-lg flex flex-col gap-8">
        {/* Header */}
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--brand)' }}
          >
            Welcome to Ikibondo
          </p>
          <h1
            className="text-3xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            Get started, {user?.full_name?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Here are a few things to do first as a <strong style={{ color: 'var(--ink)' }}>{role.toLowerCase()}</strong>.
            Tick each one when you&apos;re done — then hit &ldquo;All done&rdquo; to continue.
          </p>
        </div>

        {/* Checklist */}
        <div className="flex flex-col gap-3">
          {checklist.map((item, i) => {
            const done = checked.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                className="w-full text-left flex items-start gap-4 p-4 rounded-2xl border transition-all"
                style={{
                  borderColor: done ? 'var(--brand)' : 'var(--border)',
                  backgroundColor: done
                    ? 'color-mix(in srgb, var(--brand) 6%, var(--bg-elev))'
                    : 'var(--bg-elev)',
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                  style={{
                    backgroundColor: done ? 'var(--brand)' : 'var(--bg-sand)',
                    color: done ? '#fff' : 'var(--text-muted)',
                  }}
                >
                  {done ? <CheckCircle size={16} aria-hidden="true" /> : <span className="text-xs font-bold">{i + 1}</span>}
                </div>
                <div className="flex-1">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: done ? 'var(--brand)' : 'var(--ink)', textDecoration: done ? 'line-through' : 'none' }}
                  >
                    {item.label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {item.description}
                  </p>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 3 }} aria-hidden="true" />
              </button>
            );
          })}
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              {checked.size} of {checklist.length} completed
            </span>
            {allChecked && (
              <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>
                Ready!
              </span>
            )}
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-sand)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(checked.size / checklist.length) * 100}%`,
                backgroundColor: allChecked ? 'var(--success)' : 'var(--brand)',
              }}
            />
          </div>
        </div>

        <Button
          variant="primary"
          loading={completing}
          onClick={handleComplete}
          className="w-full py-3"
        >
          {allChecked ? "All done — let's go" : 'Skip for now'}
        </Button>
      </div>
    </div>
  );
}
