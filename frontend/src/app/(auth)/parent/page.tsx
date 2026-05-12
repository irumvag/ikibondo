'use client';

import Link from 'next/link';
import { Heart, Syringe, Bell, BellOff, ChevronRight, CheckCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useMyChildren, useNotifications } from '@/lib/api/queries';
import { QK } from '@/lib/api/queries';
import { markAllRead, markNotificationRead } from '@/lib/api/parent';
import { KPICard } from '@/components/ui/KPICard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { SupervisedChild } from '@/lib/api/parent';

const RISK_LABEL: Record<string, string> = {
  HIGH:    'Needs urgent attention',
  MEDIUM:  'Monitor closely',
  LOW:     'Healthy',
  UNKNOWN: 'Status unknown',
};
const RISK_DOT: Record<string, string> = {
  HIGH:    'var(--danger)',
  MEDIUM:  'var(--warn)',
  LOW:     'var(--success)',
  UNKNOWN: 'var(--text-muted)',
};

const NOTIF_ICON: Record<string, string> = {
  SAM_ALERT:              '🚨',
  HIGH_RISK_ALERT:        '⚠️',
  VACCINATION_REMINDER:   '💉',
  VACCINATION_OVERDUE:    '📅',
  GROWTH_RISK:            '📊',
  MISSED_VISIT:           '🏠',
  ZONE_SUMMARY:           '📋',
  CHW_INACTIVE:           '👤',
};

function ChildCard({ child }: { child: SupervisedChild }) {
  return (
    <Link
      href={`/parent/children/${child.id}`}
      className="flex items-center justify-between p-5 rounded-2xl border transition-colors hover:bg-[var(--bg-sand)]"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
    >
      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--bg-sand)' }}
        >
          <Heart size={22} style={{ color: 'var(--ink)' }} aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{child.full_name}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {child.age_display} &middot; {child.sex === 'M' ? 'Boy' : 'Girl'} &middot; {child.registration_number}
          </p>
        </div>
      </div>
      <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
    </Link>
  );
}

export default function ParentDashboard() {
  const user    = useAuthStore((s) => s.user);
  const qc      = useQueryClient();
  const { data: childrenData, isLoading: childrenLoading } = useMyChildren();
  const { data: notifData,    isLoading: notifLoading }    = useNotifications();

  const children    = childrenData?.items ?? [];
  const childCount  = childrenData?.count ?? 0;
  const notifs      = notifData?.items ?? [];
  const unreadCount = notifData?.unread ?? 0;

  const vaccinesDueSoon = 0; // Summary only — detail shown per child

  const handleMarkAllRead = async () => {
    await markAllRead();
    await qc.invalidateQueries({ queryKey: QK.notifications });
  };

  const handleMarkOneRead = async (id: string) => {
    await markNotificationRead(id);
    await qc.invalidateQueries({ queryKey: QK.notifications });
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
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

      {/* KPIs */}
      <div className="grid sm:grid-cols-3 gap-4">
        <KPICard
          label="Children registered"
          value={childrenLoading ? '—' : childCount.toString()}
          icon={<Heart size={18} />}
          variant="success"
          isLoading={childrenLoading}
        />
        <KPICard
          label="Vaccines due soon"
          value={childrenLoading ? '—' : vaccinesDueSoon.toString()}
          icon={<Syringe size={18} />}
          variant={vaccinesDueSoon > 0 ? 'warn' : 'default'}
          subtext="View each child for details"
          isLoading={childrenLoading}
        />
        <KPICard
          label="Notifications"
          value={notifLoading ? '—' : unreadCount.toString()}
          icon={<Bell size={18} />}
          variant={unreadCount > 0 ? 'warn' : 'default'}
          subtext={unreadCount === 0 ? 'All caught up' : 'Unread messages'}
          isLoading={notifLoading}
        />
      </div>

      {/* Children list */}
      <div>
        <h3 className="text-base font-semibold mb-3" style={{ color: 'var(--ink)' }}>
          Your children
        </h3>
        {childrenLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-[72px] rounded-2xl" />)}
          </div>
        ) : children.length === 0 ? (
          <EmptyState
            icon={<Heart size={28} />}
            title="No children linked yet"
            description="Ask your health worker to link your child's profile to your account."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {children.map((child) => <ChildCard key={child.id} child={child} />)}
          </div>
        )}
      </div>

      {/* Notifications */}
      <div>
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
              <CheckCheck size={13} aria-hidden="true" />
              Mark all read
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
            description="You'll be notified about upcoming vaccinations and health alerts here."
          />
        ) : (
          <div
            className="rounded-2xl border overflow-hidden divide-y"
            style={{ borderColor: 'var(--border)' }}
          >
            {notifs.slice(0, 15).map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-3 px-4 py-3.5 transition-colors"
                style={{ backgroundColor: n.is_read ? 'var(--bg)' : 'var(--bg-elev)' }}
              >
                <span className="text-lg shrink-0 mt-0.5" aria-hidden="true">
                  {NOTIF_ICON[n.notification_type] ?? '📢'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    {n.notification_type_display}
                    {n.child_name && (
                      <span className="font-normal" style={{ color: 'var(--text-muted)' }}>
                        {' '}&middot; {n.child_name}
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
        )}
      </div>
    </div>
  );
}
