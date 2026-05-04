'use client';

import { useState } from 'react';
import { BellOff, CheckCheck, Bell } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAllNotifications, QK } from '@/lib/api/queries';
import { markNotificationRead, markAllNotificationsRead } from '@/lib/api/queries';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

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
  { value: 'ZONE_SUMMARY', label: 'Zone Summary' },
  { value: 'CHW_INACTIVE', label: 'CHW Inactive' },
];

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return iso; }
}

export default function AllNotificationsPage() {
  const qc = useQueryClient();
  const { data: notifications, isLoading } = useAllNotifications();
  const [typeFilter, setTypeFilter] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const all = notifications ?? [];
  const unreadCount = all.filter((n) => !n.is_read).length;

  const filtered = all.filter((n) => {
    if (typeFilter && n.trigger_type !== typeFilter) return false;
    if (showUnreadOnly && n.is_read) return false;
    return true;
  });

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      qc.invalidateQueries({ queryKey: QK.allNotifications });
      qc.invalidateQueries({ queryKey: QK.notifications });
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDismiss = async (id: string) => {
    setDismissing(id);
    try {
      await markNotificationRead(id);
      qc.invalidateQueries({ queryKey: QK.allNotifications });
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
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
            Notifications
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {isLoading ? '—' : unreadCount > 0 ? `${unreadCount} unread of ${all.length}` : `${all.length} total — all read`}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" size="sm" loading={markingAll} onClick={handleMarkAll}>
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
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>{filtered.length} shown</span>
      </div>

      {/* Table-style list */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BellOff size={28} />}
          title="No notifications"
          description="System alerts, health warnings, and vaccination reminders appear here."
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
              {/* Unread dot */}
              <div className="mt-2 shrink-0 w-2">
                {!n.is_read && (
                  <span className="block w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--warn)' }} aria-label="Unread" />
                )}
              </div>

              {/* Icon */}
              <span className="text-xl shrink-0 mt-0.5" aria-hidden="true">
                {NOTIF_ICON[n.trigger_type] ?? '📢'}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                      {n.title}
                    </p>
                    <Badge variant={n.is_read ? 'default' : 'warn'} className="text-xs">
                      {n.is_read ? 'Read' : 'Unread'}
                    </Badge>
                  </div>
                  <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {fmtDate(n.created_at)}
                  </span>
                </div>
                {n.child_name && (
                  <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Child: {n.child_name}
                  </p>
                )}
                <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {n.body}
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
                  aria-label="Mark as read"
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
