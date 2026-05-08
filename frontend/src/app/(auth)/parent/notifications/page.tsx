'use client';

import { useEffect, useState } from 'react';
import { BellOff, CheckCheck, Bell } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications, QK } from '@/lib/api/queries';
import { markAllRead, markNotificationRead } from '@/lib/api/parent';
import {
  getLocalNotifs, markLocalNotifRead, markAllLocalNotifsRead,
  LOCAL_NOTIF_ICON,
  type LocalNotif,
} from '@/lib/localNotifs';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';

// ── server notif icons ─────────────────────────────────────────────────────────
const NOTIF_ICON: Record<string, string> = {
  SAM_ALERT:            '🚨',
  HIGH_RISK_ALERT:      '⚠️',
  VACCINATION_REMINDER: '💉',
  VACCINATION_OVERDUE:  '📅',
  GROWTH_RISK:          '📊',
  MISSED_VISIT:         '🏠',
  ZONE_SUMMARY:         '📋',
  CHW_INACTIVE:         '👤',
  VISIT_REQUEST:        '🏠',
  VISIT_ACCEPTED:       '✅',
  VISIT_DECLINED:       '❌',
  VISIT_COMPLETED:      '🎉',
};

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'SAM_ALERT', label: 'SAM Alert' },
  { value: 'HIGH_RISK_ALERT', label: 'High Risk' },
  { value: 'VACCINATION_REMINDER', label: 'Vaccination' },
  { value: 'VACCINATION_OVERDUE', label: 'Overdue' },
  { value: 'GROWTH_RISK', label: 'Growth Risk' },
  { value: 'MISSED_VISIT', label: 'Missed Visit' },
  { value: '__local__', label: 'My actions' },
];

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

// ── unified row type ──────────────────────────────────────────────────────────
type UnifiedNotif =
  | { source: 'server'; id: string; notification_type: string; notification_type_display: string; message: string; child_name?: string | null; is_read: boolean; created_at?: string; sent_at?: string | null }
  | { source: 'local'; notif: LocalNotif };

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useNotifications();
  const [typeFilter, setTypeFilter]       = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [dismissing, setDismissing]        = useState<string | null>(null);

  // local notifs state — re-read on storage event
  const [localNotifs, setLocalNotifs] = useState<LocalNotif[]>([]);
  useEffect(() => {
    setLocalNotifs(getLocalNotifs());
    const handler = () => setLocalNotifs(getLocalNotifs());
    window.addEventListener('ikibondo:local_notif', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('ikibondo:local_notif', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const serverNotifs = data?.items ?? [];
  const serverUnread = data?.unread ?? 0;
  const localUnread  = localNotifs.filter((n) => !n.is_read).length;
  const totalUnread  = serverUnread + localUnread;

  // Build unified list
  const unified: UnifiedNotif[] = [
    ...localNotifs.map((n): UnifiedNotif => ({ source: 'local', notif: n })),
    ...serverNotifs.map((n): UnifiedNotif => ({ source: 'server', ...n })),
  ].sort((a, b) => {
    const da = a.source === 'local' ? a.notif.created_at : (a.created_at ?? a.sent_at ?? '');
    const db = b.source === 'local' ? b.notif.created_at : (b.created_at ?? b.sent_at ?? '');
    return db.localeCompare(da);
  });

  // Filter
  const filtered = unified.filter((item) => {
    const isRead  = item.source === 'local' ? item.notif.is_read : item.is_read;
    if (showUnreadOnly && isRead) return false;
    if (!typeFilter) return true;
    if (typeFilter === '__local__') return item.source === 'local';
    return item.source === 'server' && item.notification_type === typeFilter;
  });

  const handleMarkAll = async () => {
    markAllLocalNotifsRead();
    setLocalNotifs(getLocalNotifs());
    await markAllRead();
    qc.invalidateQueries({ queryKey: QK.notifications });
  };

  const handleDismissServer = async (id: string) => {
    setDismissing(id);
    try {
      await markNotificationRead(id);
      qc.invalidateQueries({ queryKey: QK.notifications });
    } finally {
      setDismissing(null);
    }
  };

  const handleDismissLocal = (id: string) => {
    markLocalNotifRead(id);
    setLocalNotifs(getLocalNotifs());
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
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
            {isLoading ? '—' : totalUnread > 0
              ? `${totalUnread} unread of ${unified.length}`
              : `${unified.length} total — all read`}
          </p>
        </div>
        {totalUnread > 0 && (
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
          description="Health alerts, vaccination reminders and your activity will appear here."
        />
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {filtered.map((item) => {
            if (item.source === 'local') {
              const n = item.notif;
              return (
                <div
                  key={n.id}
                  className="flex items-start gap-4 px-4 py-4 border-b last:border-b-0 transition-colors"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: n.is_read ? 'transparent' : 'color-mix(in srgb, var(--success) 5%, var(--bg-elev))',
                  }}
                >
                  {/* Unread dot */}
                  <div className="mt-2 shrink-0">
                    {!n.is_read
                      ? <span className="block w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--success)' }} />
                      : <span className="block w-2 h-2" />}
                  </div>

                  {/* Icon */}
                  <span className="text-xl shrink-0 mt-0.5">{LOCAL_NOTIF_ICON[n.type] ?? '📢'}</span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{n.title}</p>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}
                        >
                          You
                        </span>
                      </div>
                      <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                        {fmtDate(n.created_at)}
                      </span>
                    </div>
                    {n.child_name && (
                      <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>{n.child_name}</p>
                    )}
                    <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{n.message}</p>
                  </div>

                  {/* Dismiss */}
                  {!n.is_read && (
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => handleDismissLocal(n.id)}
                      className="shrink-0"
                    >
                      <Bell size={12} aria-hidden="true" />
                    </Button>
                  )}
                </div>
              );
            }

            // Server notification
            return (
              <div
                key={item.id}
                className="flex items-start gap-4 px-4 py-4 border-b last:border-b-0 transition-colors"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: item.is_read ? 'transparent' : 'color-mix(in srgb, var(--warn) 5%, var(--bg-elev))',
                }}
              >
                <div className="mt-2 shrink-0">
                  {!item.is_read
                    ? <span className="block w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--warn)' }} />
                    : <span className="block w-2 h-2" />}
                </div>
                <span className="text-xl shrink-0 mt-0.5">{NOTIF_ICON[item.notification_type] ?? '📢'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                      {item.notification_type_display}
                    </p>
                    <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {fmtDate(item.created_at ?? item.sent_at)}
                    </span>
                  </div>
                  {item.child_name && (
                    <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.child_name}</p>
                  )}
                  <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{item.message}</p>
                </div>
                {!item.is_read && (
                  <Button
                    size="sm" variant="ghost"
                    loading={dismissing === item.id}
                    onClick={() => handleDismissServer(item.id)}
                    className="shrink-0"
                  >
                    <Bell size={12} aria-hidden="true" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
