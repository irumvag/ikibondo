'use client';

import { Baby, Stethoscope, Syringe, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { KPICard } from '@/components/ui/KPICard';
import { EmptyState } from '@/components/ui/EmptyState';

export default function CHWDashboard() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          My Caseload
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Welcome back, {user?.full_name ?? 'CHW'}.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Children assigned"
          value="—"
          icon={<Baby size={18} />}
          isLoading
        />
        <KPICard
          label="Visits this week"
          value="—"
          icon={<Stethoscope size={18} />}
          variant="success"
          isLoading
        />
        <KPICard
          label="Vaccines due"
          value="—"
          icon={<Syringe size={18} />}
          variant="warn"
          subtext="In next 7 days"
          isLoading
        />
        <KPICard
          label="Unsynced records"
          value="0"
          icon={<RefreshCw size={18} />}
          subtext="All synced"
        />
      </div>

      <EmptyState
        icon={<Stethoscope size={24} />}
        title="Field app coming in Phase 6"
        description="Register children, log visits offline, administer vaccines, and view risk results in plain language."
        action={{ label: 'Register a child', href: '/chw/register' }}
      />
    </div>
  );
}
