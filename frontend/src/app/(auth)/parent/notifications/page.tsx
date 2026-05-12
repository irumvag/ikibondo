'use client';

import { useState } from 'react';
import { BellOff, CheckCheck, Bell } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications, QK } from '@/lib/api/queries';
import { markAllRead, markNotificationRead } from '@/lib/api/parent';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';

const NOTIF_ICON: Record<string, string> = {
  SAM_ALERT:            '🚨',
  HIGH_RISK_ALERT:      '⚠️',
  VACCINATION_REMINDER: '💉',
  VACCINATION_OVERDUE:  '📅',
  GROWTH_RISK:          '📊',
  MISSED_VISIT:         '🏠',
  ZONE_SUMMARY:         '📋',
  CHW_INACTIVE:         '👤',
};

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'SAM_ALERT', label: 'SAM Alert' },
  { value: 'HIGH_RISK_ALERT', label: 'High Risk' },
  { value: 'VACCINATION_REMINDER', label: 'Vaccination' },
  { value: 'VACCINATION_OVERDUE', label: 'Overdue' },
  { value: 'GROWTH_RISK', label: 'Growth Risk' },
  { value: 'MISSED_VISIT', label: 'Missed Visit' },
];

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useNotifications();
  const [typeFilter, setTypeFilter] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const notifs      = data?.items ?? [];
  const unreadCount = data?.unread ?? 0;

  const filtered = notifs.filter((n) => {
    if (typeFilter && n.notification_type !== typeFilter) return false;
    if (showUnreadOnly && n.is_read) return false;
    return true;
  });

  const handleMarkAll = async () => {
    await markAllRead();
    qc.invalidateQueries({ queryKey: QK.notifications });
  };

  const handleDismiss = async (id: string) => {
    setDismissing(id);
    try {
      await markNotificationRead(id);
      qc.invalidateQueries({ queryKey: QK.notifications });
    } finally {
      setDismissing(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            Notifications
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {isLoading ? '—' : unreadCount > 0 ? `${unreadCount} unread of ${notifs.length}` : `${notifs.length} total — all read`}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" size="sm" onClick={handleMarkAll}>
            <CheckCheck size={14} className="mr-1.5" aria-hidden="true" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          aria-label="Filter by type"
        >
          {TYPE_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showUnreadOnly}
            onChange={(e) => setShowUnreadOnly(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm" style={{ color: 'var(--ink)' }}>Unread only</span>
        </label>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} shown
        </span>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BellOff size={28} />}
          title="No notifications"
          description="Health alerts and vaccination reminders will appear here."
        />
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {filtered.map((n) => (
            <div
              key={n.id}
              className="flex items-start gap-4 px-4 py-4 border-b last:border-b-0 transition-colors"
              style={{
                borderColor:     'var(--border)',
                backgroundColor: n.is_read ? 'transparent' : 'color-mix(in srgb, var(--warn) 5%, var(--bg-elev))',
              }}
            >
              {/* Unread indicator */}
              <div className="mt-2 shrink-0">
                {!n.is_read
                  ? <span className="block w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--warn)' }} aria-label="Unread" />
                  : <span className="block w-2 h-2" />}
              </div>

              {/* Icon */}
              <span className="text-xl shrink-0 mt-0.5" aria-hidden="true">
                {NOTIF_ICON[n.notification_type] ?? '📢'}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    {n.notification_type_display}
                  </p>
                  <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {fmtDate(n.created_at ?? n.sent_at)}
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
                <Button
                  size="sm"
                  variant="ghost"
                  loading={dismissing === n.id}
                  onClick={() => handleDismiss(n.id)}
                  className="shrink-0"
                >
                  <Bell size={12} aria-hidden="true" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
