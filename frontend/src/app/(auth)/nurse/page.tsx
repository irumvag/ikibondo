'use client';

import { Baby, ClipboardList, AlertTriangle, Activity } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { KPICard } from '@/components/ui/KPICard';
import { EmptyState } from '@/components/ui/EmptyState';

export default function NurseDashboard() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Camp Overview
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Welcome back, {user?.full_name ?? 'Nurse'}.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Children registered"
          value="—"
          icon={<Baby size={18} />}
          isLoading
        />
        <KPICard
          label="Records this week"
          value="—"
          icon={<ClipboardList size={18} />}
          isLoading
        />
        <KPICard
          label="HIGH-risk cases"
          value="—"
          icon={<AlertTriangle size={18} />}
          variant="danger"
          isLoading
        />
        <KPICard
          label="Avg visits / child"
          value="—"
          icon={<Activity size={18} />}
          isLoading
        />
      </div>

      <EmptyState
        icon={<ClipboardList size={24} />}
        title="Nurse dashboard coming in Phase 5"
        description="Children list, health record review with SHAP explanations, clinical notes, and growth charts."
      />
    </div>
  );
}
