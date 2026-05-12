'use client';

import Link from 'next/link';
import {
  Baby, MapPin, AlertTriangle, Activity,
  BarChart2, TrendingUp, Users,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAdminZones } from '@/lib/api/queries';
import { listHighRiskRecords, listCampChildren, getCHWActivity } from '@/lib/api/supervisor';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/Skeleton';

function StatCard({
  label, value, sub, icon: Icon, href, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  href?: string;
  color?: string;
}) {
  const inner = (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-3 transition-colors hover:bg-[var(--bg-sand)]"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
        <Icon size={16} style={{ color: color ?? 'var(--text-muted)' }} aria-hidden="true" />
      </div>
      <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
        {value}
      </p>
      {sub && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function ManagerDashboard() {
  const user   = useAuthStore((s) => s.user);
  const campId = user?.camp ?? '';

  // Zones for this camp
  const { data: zones = [], isLoading: zonesLoading } = useAdminZones(campId);

  // Children count
  const { data: childrenData, isLoading: childrenLoading } = useQuery({
    queryKey: ['manager', 'children', campId],
    queryFn:  () => listCampChildren({ camp: campId || undefined, page_size: 1 }),
    enabled:  !!campId,
  });

  // High risk count
  const { data: highRiskData, isLoading: hrLoading } = useQuery({
    queryKey: ['manager', 'highRisk', campId],
    queryFn:  () => listHighRiskRecords({ page_size: 1 }),
    enabled:  !!campId,
  });

  // CHW activity — get from first zone if available
  const firstZoneId = zones[0]?.id ?? '';
  const { data: chwActivity = [], isLoading: chwLoading } = useQuery({
    queryKey: ['manager', 'chw', campId, firstZoneId],
    queryFn:  () => getCHWActivity(campId, firstZoneId),
    enabled:  !!campId && !!firstZoneId,
  });

  const activeChws   = chwActivity.filter((c) => c.status === 'active').length;
  const inactiveChws = chwActivity.filter((c) => c.status === 'inactive').length;

  const loading = zonesLoading || childrenLoading || hrLoading || chwLoading;

  const stats = [
    {
      label: 'Total zones',
      value: zonesLoading ? '…' : zones.length,
      icon:  MapPin,
      href:  '/manager/zones',
      sub:   'Active zones in your camp',
    },
    {
      label: 'Registered children',
      value: childrenLoading ? '…' : (childrenData?.count ?? 0).toLocaleString(),
      icon:  Baby,
      href:  '/manager/children',
      sub:   'All children in this camp',
    },
    {
      label: 'High-risk children',
      value: hrLoading ? '…' : (highRiskData?.count ?? 0).toLocaleString(),
      icon:  AlertTriangle,
      href:  '/manager/analytics',
      color: 'var(--danger)',
      sub:   'Flagged by ML model',
    },
    {
      label: 'Active CHWs',
      value: chwLoading ? '…' : activeChws,
      icon:  Activity,
      href:  '/manager/staff',
      color: activeChws > 0 ? 'var(--success)' : 'var(--text-muted)',
      sub:   inactiveChws > 0 ? `${inactiveChws} inactive` : 'All CHWs active',
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Camp overview
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {user?.camp_name ?? 'Your camp'} — real-time summary
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))
          : stats.map((s) => (
              <StatCard key={s.label} {...s} />
            ))}
      </div>

      {/* Zones summary */}
      <section aria-labelledby="zones-heading">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin size={18} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
            <h3 id="zones-heading" className="font-semibold" style={{ color: 'var(--ink)' }}>
              Zones
            </h3>
          </div>
          <Link
            href="/manager/zones"
            className="text-xs font-medium hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            Manage →
          </Link>
        </div>

        {zonesLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : zones.length === 0 ? (
          <div
            className="rounded-2xl border p-6 text-center"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No zones configured for this camp yet.{' '}
              <Link href="/manager/zones" className="font-semibold hover:underline" style={{ color: 'var(--ink)' }}>
                Add a zone
              </Link>
            </p>
          </div>
        ) : (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
          >
            {zones.slice(0, 6).map((z, i) => (
              <div
                key={z.id}
                className="flex items-center justify-between px-4 py-3 border-b last:border-b-0 text-sm"
                style={{ borderColor: 'var(--border)' }}
              >
                <div>
                  <span className="font-medium" style={{ color: 'var(--ink)' }}>{z.name}</span>
                  <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>{z.code}</span>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: z.is_active ? 'color-mix(in srgb, var(--success) 15%, transparent)' : 'var(--bg-sand)',
                    color: z.is_active ? 'var(--success)' : 'var(--text-muted)',
                  }}
                >
                  {z.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
            {zones.length > 6 && (
              <Link
                href="/manager/zones"
                className="flex items-center justify-center py-3 text-xs font-medium hover:bg-[var(--bg-sand)] transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                View all {zones.length} zones →
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Quick links */}
      <section aria-labelledby="quick-heading">
        <h3 id="quick-heading" className="font-semibold mb-4" style={{ color: 'var(--ink)' }}>
          Quick actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: '/manager/analytics', label: 'View analytics report', icon: BarChart2 },
            { href: '/manager/children',  label: 'Browse all children',   icon: Baby      },
            { href: '/manager/staff',     label: 'CHW activity',          icon: Users     },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-medium transition-colors hover:bg-[var(--bg-sand)]"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
            >
              <Icon size={18} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
