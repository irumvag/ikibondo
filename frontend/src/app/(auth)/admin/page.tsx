'use client';

import Link from 'next/link';
import { Users, MapPin, ScrollText, Cpu, Baby, AlertTriangle, Shield, Activity, Syringe, UserCheck } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { KPICard } from '@/components/ui/KPICard';
import { useLandingStats, usePendingApprovals } from '@/lib/api/queries';

const QUICK_LINKS = [
  { href: '/admin/users',      icon: Users,      label: 'User Management', desc: 'Manage staff accounts and approve pending registrations.' },
  { href: '/admin/camps',      icon: MapPin,     label: 'Camps & Zones',   desc: 'Create and configure camps, zones, and CHW assignments.' },
  { href: '/admin/guardians',  icon: UserCheck,  label: 'CHW Assignments', desc: 'Assign CHWs to guardian families for home visit tracking.' },
  { href: '/admin/vaccinations', icon: Syringe,  label: 'Vaccinations',    desc: 'Full CRUD on vaccination records across all camps.' },
  { href: '/admin/audit',      icon: ScrollText, label: 'Audit Log',       desc: 'Review ML prediction history and system activity.' },
  { href: '/admin/ml',         icon: Cpu,        label: 'ML Models',       desc: 'Inspect model metadata, accuracy, and all 3 model statuses.' },
];

export default function AdminDashboard() {
  const user = useAuthStore((s) => s.user);
  const { data: stats, isLoading: statsLoading } = useLandingStats();
  const { data: pending, isLoading: pendingLoading } = usePendingApprovals();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Welcome back, {user?.full_name ?? 'Administrator'}
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          System-wide snapshot across all camps and zones.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total children"
          value={stats ? stats.total_children.toLocaleString() : '—'}
          icon={<Baby size={18} />}
          subtext="Across all camps"
          isLoading={statsLoading}
        />
        <KPICard
          label="Active CHWs"
          value={stats ? stats.total_chws_active.toLocaleString() : '—'}
          icon={<Activity size={18} />}
          variant="success"
          subtext="This month"
          isLoading={statsLoading}
        />
        <KPICard
          label="HIGH-risk children"
          value={stats ? stats.high_risk_30d.toLocaleString() : '—'}
          icon={<AlertTriangle size={18} />}
          variant="danger"
          subtext="Last 30 days"
          isLoading={statsLoading}
        />
        <KPICard
          label="Pending approvals"
          value={pendingLoading ? '—' : (pending?.length ?? 0).toString()}
          icon={<Shield size={18} />}
          variant={(pending?.length ?? 0) > 0 ? 'warn' : 'default'}
          subtext={(pending?.length ?? 0) > 0 ? 'Needs review' : 'All clear'}
          isLoading={pendingLoading}
        />
      </div>

      {/* Quick links grid */}
      <div>
        <h3
          className="text-base font-semibold mb-3"
          style={{ color: 'var(--ink)' }}
        >
          Admin sections
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          {QUICK_LINKS.map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-start gap-4 p-5 rounded-2xl border transition-colors hover:bg-[var(--bg-sand)]"
              style={{ borderColor: 'var(--border)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
              >
                <Icon size={20} aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
