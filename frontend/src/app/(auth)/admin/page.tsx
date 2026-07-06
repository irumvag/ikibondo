'use client';

import Link from 'next/link';
import {
  Users, MapPin, ScrollText, Cpu, Baby,
  AlertTriangle, Shield, Activity, Syringe, UserCheck,
  TrendingUp, MessageSquare, GitMerge, ClipboardList,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { KPICard } from '@/components/ui/KPICard';
import { Alert } from '@/components/ui/Alert';
import { useLandingStats, usePendingApprovals, useAdminChildren } from '@/lib/api/queries';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const QUICK_LINKS = [
  { href: '/admin/users',         icon: Users,          label: 'User Management',  desc: 'Manage staff accounts and approve pending registrations.' },
  { href: '/admin/camps',         icon: MapPin,         label: 'Camps & Zones',    desc: 'Create and configure camps, zones, and CHW assignments.' },
  { href: '/admin/children',      icon: Baby,           label: 'All Children',     desc: 'Browse, search, close, or transfer children across all camps.' },
  { href: '/admin/health-records',icon: ClipboardList,  label: 'Health Records',   desc: 'Browse and amend health records across all camps.' },
  { href: '/admin/consultations', icon: MessageSquare,  label: 'Consultations',    desc: 'Oversee CHW↔Nurse consultation threads.' },
  { href: '/admin/referrals',     icon: GitMerge,       label: 'Referrals',        desc: 'Monitor and complete referrals across all camps.' },
  { href: '/admin/guardians',     icon: UserCheck,      label: 'CHW Assignments',  desc: 'Assign CHWs to guardian families for home visit tracking.' },
  { href: '/admin/vaccinations',  icon: Syringe,        label: 'Vaccinations',     desc: 'Full CRUD on vaccination records across all camps.' },
  { href: '/admin/audit',         icon: ScrollText,     label: 'Audit Log',        desc: 'Review ML prediction history and system activity.' },
  { href: '/admin/ml',            icon: Cpu,            label: 'ML Models',        desc: 'Inspect model metadata, accuracy, and all 3 model statuses.' },
];

const RISK_COLORS: Record<string, string> = {
  HIGH:    'var(--danger)',
  MEDIUM:  'var(--warn)',
  LOW:     'var(--success)',
  UNKNOWN: 'var(--text-muted)',
};

export default function AdminDashboard() {
  const user = useAuthStore((s) => s.user);
  const { data: stats, isLoading: statsLoading } = useLandingStats();
  const { data: pending, isLoading: pendingLoading } = usePendingApprovals();
  const { data: childrenData } = useAdminChildren();

  const pendingCount = pending?.length ?? 0;
  const highRisk = stats?.high_risk_30d ?? 0;

  /* Risk distribution for bar chart */
  const riskBreakdown = (() => {
    if (!childrenData?.results) return [];
    const counts: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
    for (const c of childrenData.results) {
      const r = (c.risk_level ?? 'UNKNOWN') as string;
      counts[r] = (counts[r] ?? 0) + 1;
    }
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  })();

  return (
    <div className="flex flex-col gap-8">
      {/* Page header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Welcome back, {user?.full_name?.split(' ')[0] ?? 'Administrator'}
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          System-wide snapshot across all camps and zones.
        </p>
      </div>

      {/* ── Alert zone ────────────────────────────────────────────────── */}
      {(pendingCount > 0 || highRisk > 0) && (
        <div className="flex flex-col gap-3">
          {pendingCount > 0 && (
            <Alert variant="warn" title={`${pendingCount} user${pendingCount !== 1 ? 's' : ''} awaiting approval`}>
              <Link href="/admin/users?status=pending" className="underline font-medium">
                Review pending approvals →
              </Link>
            </Alert>
          )}
          {highRisk > 0 && (
            <Alert variant="danger" title={`${highRisk} HIGH-risk children in the last 30 days`}>
              <Link href="/admin/health-records?risk=HIGH" className="underline font-medium">
                View high-risk records →
              </Link>
            </Alert>
          )}
        </div>
      )}

      {/* ── KPI row ────────────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/children" className="group">
          <KPICard
            label="Total children"
            value={stats ? stats.total_children.toLocaleString() : '—'}
            icon={<Baby size={18} />}
            subtext="Across all camps"
            isLoading={statsLoading}
          />
        </Link>
        <Link href="/admin/users?role=CHW" className="group">
          <KPICard
            label="Active CHWs"
            value={stats ? stats.total_chws_active.toLocaleString() : '—'}
            icon={<Activity size={18} />}
            variant="success"
            subtext="This month"
            isLoading={statsLoading}
          />
        </Link>
        <Link href="/admin/health-records?risk=HIGH" className="group">
          <KPICard
            label="HIGH-risk children"
            value={highRisk.toLocaleString()}
            icon={<AlertTriangle size={18} />}
            variant="danger"
            subtext="Last 30 days"
            isLoading={statsLoading}
          />
        </Link>
        <Link href="/admin/users?status=pending" className="group">
          <KPICard
            label="Pending approvals"
            value={pendingLoading ? '—' : pendingCount.toString()}
            icon={<Shield size={18} />}
            variant={pendingCount > 0 ? 'warn' : 'default'}
            subtext={pendingCount > 0 ? 'Needs review' : 'All clear'}
            isLoading={pendingLoading}
          />
        </Link>
      </div>

      {/* ── Insight zone: risk distribution chart ─────────────────────── */}
      {riskBreakdown.length > 0 && (
        <div
          className="rounded-2xl border p-5"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} style={{ color: 'var(--ink)' }} aria-hidden="true" />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              Children by risk level
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={riskBreakdown} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}
                cursor={{ fill: 'var(--bg-sand)' }}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={28}>
                {riskBreakdown.map((entry) => (
                  <Cell key={entry.name} fill={RISK_COLORS[entry.name] ?? 'var(--text-muted)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Quick links grid ───────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink)' }}>
          Admin sections
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {QUICK_LINKS.map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-start gap-4 p-4 rounded-2xl border transition-all hover:bg-[var(--bg-sand)] hover:shadow-[var(--shadow-sm)]"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
              >
                <Icon size={18} aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{label}</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
