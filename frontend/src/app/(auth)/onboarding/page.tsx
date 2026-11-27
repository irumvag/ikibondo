'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { apiClient } from '@/lib/api/client';
import type en from '../../../../messages/en.json';
import { Button } from '@/components/ui/Button';

type Role = 'CHW' | 'NURSE' | 'SUPERVISOR' | 'ADMIN' | 'PARENT' | 'GOVERNMENT' | 'PARTNER';

interface ChecklistItem {
  id: string;
  msgKey: keyof (typeof en)['onboarding']['steps'] & string;
}

const ROLE_CHECKLISTS: Record<Role, ChecklistItem[]> = {
  CHW: [
    { id: 'profile', msgKey: 'chwProfile' },
    { id: 'caseload', msgKey: 'chwCaseload' },
    { id: 'visit', msgKey: 'chwVisit' },
    { id: 'offline', msgKey: 'chwOffline' },
  ],
  NURSE: [
    { id: 'profile', msgKey: 'nurseProfile' },
    { id: 'register', msgKey: 'nurseRegister' },
    { id: 'vaccine', msgKey: 'nurseVaccine' },
    { id: 'approve', msgKey: 'nurseApprove' },
  ],
  SUPERVISOR: [
    { id: 'profile', msgKey: 'supervisorProfile' },
    { id: 'staff', msgKey: 'supervisorStaff' },
    { id: 'analytics', msgKey: 'supervisorAnalytics' },
    { id: 'assign', msgKey: 'supervisorAssign' },
  ],
  ADMIN: [
    { id: 'profile', msgKey: 'adminProfile' },
    { id: 'camp', msgKey: 'adminCamp' },
    { id: 'user', msgKey: 'adminUser' },
    { id: 'ml', msgKey: 'adminMl' },
  ],
  PARENT: [
    { id: 'profile', msgKey: 'parentProfile' },
    { id: 'children', msgKey: 'parentChildren' },
    { id: 'consent', msgKey: 'parentConsent' },
    { id: 'notifications', msgKey: 'parentNotifications' },
  ],
  GOVERNMENT: [
    { id: 'profile', msgKey: 'governmentProfile' },
    { id: 'overview', msgKey: 'governmentOverview' },
    { id: 'report', msgKey: 'governmentReport' },
  ],
  PARTNER: [
    { id: 'profile', msgKey: 'partnerProfile' },
    { id: 'overview', msgKey: 'partnerOverview' },
    { id: 'report', msgKey: 'partnerReport' },
  ],
};

const ROLE_LANDING: Record<Role, string> = {
  CHW: '/chw',
  NURSE: '/nurse',
  SUPERVISOR: '/supervisor',
  ADMIN: '/admin',
  PARENT: '/parent',
  GOVERNMENT: '/insights',
  PARTNER: '/insights',
};

export default function OnboardingPage() {
  const t = useTranslations('onboarding');
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
      if (next.has(id)) next.delete(id); else next.add(id);
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
            className="text-xs font-semibold mb-2"
            style={{ color: 'var(--brand)' }}
          >{t('welcomeToIkibondo')}</p>
          <h1
            className="text-3xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >{t('getStarted')}{' '}{user?.full_name?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>{t('hereAreAFew')}{' '}<strong style={{ color: 'var(--ink)' }}>{role.toLowerCase()}</strong>{t('tickEachOneWhen')}</p>
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
                    {t(`steps.${item.msgKey}.label`)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {t(`steps.${item.msgKey}.description`)}
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
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('ofCompleted', { size: checked.size, length: checklist.length })}</span>
            {allChecked && (
              <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>{t('ready')}</span>
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
          {allChecked ? t('allDoneLetS') : t('skipForNow')}
        </Button>
      </div>
    </div>
  );
}
