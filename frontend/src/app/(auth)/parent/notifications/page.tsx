'use client';

import { BellOff, CheckCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications, QK } from '@/lib/api/queries';
import { markAllRead, markNotificationRead } from '@/lib/api/parent';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';

const NOTIF_ICON: Record<string, string> = {
  SAM_ALERT:             '🚨',
  HIGH_RISK_ALERT:       '⚠️',
  VACCINATION_REMINDER:  '💉',
  VACCINATION_OVERDUE:   '📅',
  GROWTH_RISK:           '📊',
  MISSED_VISIT:          '🏠',
  ZONE_SUMMARY:          '📋',
  CHW_INACTIVE:          '👤',
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useNotifications();

  const notifs      = data?.items ?? [];
  const unreadCount = data?.unread ?? 0;

  const handleMarkAll = async () => {
    await markAllRead();
    await qc.invalidateQueries({ queryKey: QK.notifications });
  };

  const handleDismiss = async (id: string) => {
    await markNotificationRead(id);
    await qc.invalidateQueries({ queryKey: QK.notifications });
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            Notifications
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {isLoading ? '—' : unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" size="sm" onClick={handleMarkAll}>
            <CheckCheck size={14} className="mr-1.5" aria-hidden="true" />
            Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : notifs.length === 0 ? (
        <EmptyState
          icon={<BellOff size={28} />}
          title="No notifications"
          description="Health alerts and vaccination reminders will appear here."
        />
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {notifs.map((n) => (
            <div
              key={n.id}
              className="flex items-start gap-4 px-4 py-4 border-b last:border-b-0 transition-colors"
              style={{
                borderColor:     'var(--border)',
                backgroundColor: n.is_read ? 'var(--bg)' : 'var(--bg-elev)',
              }}
            >
              {/* Unread dot */}
              <div className="mt-1.5 shrink-0 flex items-center justify-center">
                {!n.is_read ? (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: 'var(--warn)' }}
                    aria-label="Unread"
                  />
                ) : (
                  <span className="w-2 h-2" />
                )}
              </div>

              {/* Icon */}
              <span className="text-xl shrink-0" aria-hidden="true">
                {NOTIF_ICON[n.notification_type] ?? '📢'}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    {n.notification_type_display}
                  </p>
                  <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {fmtDate(n.created_at ?? n.sent_at ?? '')}
                  </span>
                </div>
                {n.child_name && (
                  <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {n.child_name}
                  </p>
                )}
                <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {n.message}
                </p>
              </div>

              {/* Dismiss */}
              {!n.is_read && (
                <button
                  type="button"
                  onClick={() => handleDismiss(n.id)}
                  className="shrink-0 text-xs px-2.5 py-1 rounded-lg transition-colors hover:bg-[var(--bg-sand)]"
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
  );
}
