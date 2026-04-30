'use client';

import { Baby, AlertTriangle, Activity, FileBarChart } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { KPICard } from '@/components/ui/KPICard';
import { EmptyState } from '@/components/ui/EmptyState';

export default function SupervisorDashboard() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Zone Overview
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Welcome back, {user?.full_name ?? 'Supervisor'}.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Children in zone"
          value="—"
          icon={<Baby size={18} />}
          isLoading
        />
        <KPICard
          label="HIGH-risk alerts"
          value="—"
          icon={<AlertTriangle size={18} />}
          variant="danger"
          subtext="Needs follow-up"
          isLoading
        />
        <KPICard
          label="Active CHWs"
          value="—"
          icon={<Activity size={18} />}
          variant="success"
          subtext="Visits this week"
          isLoading
        />
        <KPICard
          label="Vaccination coverage"
          value="—"
          icon={<FileBarChart size={18} />}
          subtext="Zone average"
          isLoading
        />
      </div>

      <EmptyState
        icon={<Activity size={24} />}
        title="Zone detail coming in Phase 4"
        description="CHW activity, high-risk alerts, zone-scoped children list, and exportable reports."
      />
    </div>
  );
}
