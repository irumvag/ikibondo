'use client';

import { Heart, Syringe, Bell } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { KPICard } from '@/components/ui/KPICard';
import { EmptyState } from '@/components/ui/EmptyState';

export default function ParentDashboard() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          My Children
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Welcome back, {user?.full_name ?? 'Parent'}.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <KPICard
          label="Children registered"
          value="—"
          icon={<Heart size={18} />}
          variant="success"
          isLoading
        />
        <KPICard
          label="Vaccines due soon"
          value="—"
          icon={<Syringe size={18} />}
          variant="warn"
          subtext="In next 7 days"
          isLoading
        />
        <KPICard
          label="Unread notifications"
          value="—"
          icon={<Bell size={18} />}
          isLoading
        />
      </div>

      <EmptyState
        icon={<Heart size={24} />}
        title="Parent view coming in Phase 7"
        description="Track your child's growth with traffic-light charts, view vaccination cards, and manage reminders — no medical jargon."
      />
    </div>
  );
}
