'use client';

import { Users, Baby, AlertTriangle, Shield } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { KPICard } from '@/components/ui/KPICard';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AdminDashboard() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex flex-col gap-8">
      {/* Greeting */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Welcome back, {user?.full_name ?? 'Administrator'}
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Here&apos;s a snapshot across all camps and zones.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total children"
          value="—"
          icon={<Baby size={18} />}
          subtext="Across all camps"
          isLoading
        />
        <KPICard
          label="Active CHWs"
          value="—"
          icon={<Users size={18} />}
          subtext="This month"
          isLoading
        />
        <KPICard
          label="HIGH-risk children"
          value="—"
          icon={<AlertTriangle size={18} />}
          variant="danger"
          subtext="Last 30 days"
          isLoading
        />
        <KPICard
          label="Pending approvals"
          value="—"
          icon={<Shield size={18} />}
          variant="warn"
          isLoading
        />
      </div>

      {/* Placeholder content */}
      <EmptyState
        icon={<Shield size={24} />}
        title="Full admin overview coming in Phase 3"
        description="Users, camps, zones, audit log, and ML model management will be available here."
      />
    </div>
  );
}
