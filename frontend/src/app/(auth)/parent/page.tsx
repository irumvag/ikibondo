'use client';

import Link from 'next/link';
import {
  Heart, Syringe, Bell, BellOff, ChevronRight, CheckCheck,
  Calendar, AlertTriangle, Clock, MapPin, Phone, Activity,
  UserCheck, MessageSquare,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useMyChildren, useNotifications, QK, useChildVaccinations } from '@/lib/api/queries';
import { markAllRead, markNotificationRead } from '@/lib/api/parent';
import { KPICard } from '@/components/ui/KPICard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import type { SupervisedChild } from '@/lib/api/parent';

// ── constants ──────────────────────────────────────────────────────────────────

const RISK_VARIANT: Record<string, 'danger' | 'warn' | 'success' | 'default'> = {
  HIGH: 'danger', MEDIUM: 'warn', LOW: 'success', UNKNOWN: 'default',
};
const RISK_DOT: Record<string, string> = {
  HIGH: 'var(--danger)', MEDIUM: 'var(--warn)', LOW: 'var(--success)', UNKNOWN: 'var(--text-muted)',
};
const RISK_LABEL: Record<string, string> = {
  HIGH: 'Needs urgent attention', MEDIUM: 'Monitor closely', LOW: 'Healthy', UNKNOWN: 'Not assessed yet',
};
const NOTIF_ICON: Record<string, string> = {
  SAM_ALERT: '🚨', HIGH_RISK_ALERT: '⚠️', VACCINATION_REMINDER: '💉',
  VACCINATION_OVERDUE: '📅', GROWTH_RISK: '📊', MISSED_VISIT: '🏠',
  ZONE_SUMMARY: '📋', CHW_INACTIVE: '👤',
};

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Child vaccination mini-summary ────────────────────────────────────────────

function VaccineSummary({ childId }: { childId: string }) {
  const { data: vax = [], isLoading } = useChildVaccinations(childId);
  if (isLoading) return <Skeleton className="h-4 w-24 rounded" />;

  const scheduled = vax.filter((v) => v.status === 'SCHEDULED');
  const overdue   = scheduled.filter((v) => v.is_overdue);
  const upcoming  = scheduled.filter((v) => !v.is_overdue);
  const done      = vax.filter((v) => v.status === 'DONE').length;

  if (scheduled.length === 0 && done === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap mt-1.5">
      {overdue.length > 0 && (
        <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--danger)' }}>
          <Syringe size={11} /> {overdue.length} overdue
        </span>
      )}
      {upcoming.length > 0 && (
        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <Clock size={11} /> {upcoming.length} upcoming
        </span>
      )}
      {done > 0 && (
        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--success)' }}>
          ✓ {done} done
        </span>
      )}
    </div>
  );
}

// ── Child Card ────────────────────────────────────────────────────────────────

function ChildCard({ child }: { child: SupervisedChild }) {
  const rl = child.risk_level ?? 'UNKNOWN';
  const riskDot = RISK_DOT[rl] ?? 'var(--text-muted)';

  return (
    <Link
      href={`/parent/children/${child.id}`}
      className="flex items-start gap-4 p-5 rounded-2xl border transition-colors hover:bg-[var(--bg-sand)]"
      style={{ borderColor: rl === 'HIGH' ? 'var(--danger)' : 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
    >
      {/* Avatar with risk dot */}
      <div className="relative shrink-0">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg-sand)' }}
        >
          <Heart size={22} style={{ color: 'var(--ink)' }} />
        </div>
        <span
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
          style={{ backgroundColor: riskDot, borderColor: 'var(--bg-elev)' }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--ink)' }}>{child.full_name}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {child.age_display} · {child.sex === 'M' ? 'Boy' : 'Girl'} · {child.registration_number}
            </p>
          </div>
          <Badge variant={RISK_VARIANT[rl] ?? 'default'} className="shrink-0">
            {rl === 'HIGH' ? '⚠ HIGH' : rl}
          </Badge>
        </div>

        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {RISK_LABEL[rl] ?? '—'}
        </p>

        <VaccineSummary childId={child.id} />
      </div>

      <ChevronRight size={16} className="shrink-0 self-center" style={{ color: 'var(--text-muted)' }} />
    </Link>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function ParentDashboard() {
  const user = useAuthStore((s) => s.user);
  const qc   = useQueryClient();

  const { data: childrenData, isLoading: childrenLoading } = useMyChildren();
  const { data: notifData,    isLoading: notifLoading }    = useNotifications();

  const children    = childrenData?.items ?? [];
  const childCount  = childrenData?.count ?? 0;
  const notifs      = notifData?.items ?? [];
  const unreadCount = notifData?.unread ?? 0;

  // Count children with overdue vaccines for KPI
  const highRiskCount = children.filter((c) => c.risk_level === 'HIGH').length;

  const handleMarkAllRead = async () => {
    await markAllRead();
    await qc.invalidateQueries({ queryKey: QK.notifications });
  };

  const handleMarkOneRead = async (id: string) => {
    await markNotificationRead(id);
    await qc.invalidateQueries({ queryKey: QK.notifications });
  };

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto w-full">

      {/* Greeting */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Hello, {user?.full_name?.split(' ')[0] ?? 'Parent'} 👋
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          {user?.camp_name ? ` · ${user.camp_name}` : ''}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <KPICard
          label="Children"
          value={childrenLoading ? '—' : childCount.toString()}
          icon={<Heart size={18} />}
          variant="success"
          isLoading={childrenLoading}
        />
        <KPICard
          label="High risk"
          value={childrenLoading ? '—' : highRiskCount.toString()}
          icon={<AlertTriangle size={18} />}
          variant={highRiskCount > 0 ? 'danger' : 'default'}
          subtext={highRiskCount > 0 ? 'Needs attention' : 'All clear'}
          isLoading={childrenLoading}
        />
        <KPICard
          label="Alerts"
          value={notifLoading ? '—' : unreadCount.toString()}
          icon={<Bell size={18} />}
          variant={unreadCount > 0 ? 'warn' : 'default'}
          subtext={unreadCount === 0 ? 'All read' : 'Unread'}
          isLoading={notifLoading}
        />
      </div>

      {/* High-risk alert banner */}
      {highRiskCount > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border"
          style={{ background: '#fef2f2', borderColor: 'var(--danger)' }}
        >
          <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>
              {highRiskCount} child{highRiskCount !== 1 ? 'ren' : ''} need{highRiskCount === 1 ? 's' : ''} urgent attention
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--danger)', opacity: 0.8 }}>
              Contact your CHW or request a visit below.
            </p>
          </div>
          <Link
            href="/parent/request-visit"
            className="text-xs font-semibold px-3 py-1.5 rounded-xl shrink-0"
            style={{ background: 'var(--danger)', color: 'white' }}
          >
            Request visit
          </Link>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          Quick actions
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: '/parent/vaccines',       icon: Syringe,      label: 'Vaccine card',    desc: 'View all scheduled doses.' },
            { href: '/parent/request-visit',  icon: Calendar,     label: 'Request a visit', desc: 'Ask your CHW to come.' },
            { href: '/parent/notifications',  icon: Bell,         label: 'Notifications',   desc: `${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}.` },
            { href: '/parent/consent',        icon: UserCheck,    label: 'Consent & data',  desc: 'Manage your privacy settings.' },
          ].map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-start gap-3 p-4 rounded-2xl border transition-colors hover:bg-[var(--bg-sand)]"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)' }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--primary)' }}
              >
                <Icon size={18} />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Children section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>Your children</h3>
          {childCount > 0 && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{childCount} registered</span>
          )}
        </div>

        {childrenLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : children.length === 0 ? (
          <EmptyState
            icon={<Heart size={28} />}
            title="No children linked yet"
            description="Ask your community health worker to link your child's profile to this account."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {children.map((child) => <ChildCard key={child.id} child={child} />)}
          </div>
        )}
      </section>

      {/* Help banner */}
      <div
        className="flex items-center gap-4 px-4 py-4 rounded-2xl border"
        style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--primary)' }}
        >
          <MessageSquare size={18} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Need help?</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Your community health worker can answer questions and schedule a home visit.
          </p>
        </div>
        <Link
          href="/parent/request-visit"
          className="text-xs font-medium px-3 py-1.5 rounded-xl border shrink-0 transition-colors hover:bg-[var(--bg-sand)]"
          style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
        >
          Contact CHW
        </Link>
      </div>

      {/* Notifications */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
            Notifications
            {unreadCount > 0 && (
              <span
                className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--warn)', color: 'white' }}
              >
                {unreadCount}
              </span>
            )}
          </h3>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
            >
              <CheckCheck size={13} /> Mark all read
            </button>
          )}
        </div>

        {notifLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : notifs.length === 0 ? (
          <EmptyState
            icon={<BellOff size={24} />}
            title="No notifications"
            description="Upcoming vaccination reminders and health alerts will appear here."
          />
        ) : (
          <>
            <div className="rounded-2xl border overflow-hidden divide-y" style={{ borderColor: 'var(--border)' }}>
              {notifs.slice(0, 10).map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 px-4 py-3.5 transition-colors"
                  style={{ backgroundColor: n.is_read ? 'var(--bg)' : 'var(--bg-elev)' }}
                >
                  <span className="text-lg shrink-0 mt-0.5">{NOTIF_ICON[n.notification_type] ?? '📢'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                      {n.notification_type_display}
                      {n.child_name && (
                        <span className="font-normal" style={{ color: 'var(--text-muted)' }}>
                          {' '}· {n.child_name}
                        </span>
                      )}
                    </p>
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                      {n.message}
                    </p>
                  </div>
                  {!n.is_read && (
                    <button
                      type="button"
                      onClick={() => handleMarkOneRead(n.id)}
                      className="shrink-0 text-xs px-2 py-1 rounded-lg transition-colors hover:bg-[var(--bg-sand)]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              ))}
            </div>
            {notifs.length > 10 && (
              <Link
                href="/parent/notifications"
                className="block text-center text-xs mt-2 py-2 rounded-xl transition-colors hover:bg-[var(--bg-sand)]"
                style={{ color: 'var(--text-muted)' }}
              >
                View all {notifs.length} notifications →
              </Link>
            )}
          </>
        )}
      </section>
    </div>
  );
}
