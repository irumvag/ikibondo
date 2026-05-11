'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BellOff, CheckCheck, Check, Trash2 } from 'lucide-react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useAllNotifications, QK } from '@/lib/api/queries';
import {
  markNotificationRead, markAllNotificationsRead, deleteNotification,
} from '@/lib/api/queries';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import type { AppNotification } from '@/lib/api/notifications';

// ── Navigation map ─────────────────────────────────────────────────────────────

function resolveLink(n: AppNotification, role: string): string | null {
  const t = n.trigger_type;
  // Visit-related
  if (t === 'VISIT_REQUESTED' || t === 'MISSED_VISIT')           return '/chw/requests';
  if (t === 'VISIT_ACCEPTED' || t === 'VISIT_DECLINED' ||
      t === 'VISIT_COMPLETED' || t === 'VISIT_WITHDRAWN')        return '/parent/request-visit';
  // Health / risk
  if (t === 'SAM_ALERT' || t === 'HIGH_RISK_ALERT' || t === 'GROWTH_RISK') {
    if (role === 'PARENT')        return n.child_id ? `/parent/children/${n.child_id}` : '/parent';
    if (role === 'CHW')           return '/chw/records';
    if (role === 'SUPERVISOR')    return '/supervisor/ai-oversight';
    return '/nurse/children';
  }
  // Vaccination
  if (t === 'VACCINATION_REMINDER' || t === 'VACCINATION_OVERDUE') {
    if (role === 'PARENT') return '/parent/vaccines';
    if (role === 'CHW')    return '/chw/caseload';
    return '/nurse/children';
  }
  // Admin / supervisor
  if (t === 'ZONE_SUMMARY')  return '/supervisor/analytics';
  if (t === 'CHW_INACTIVE')  return '/supervisor/staff';
  if (t === 'BROADCAST')     return null;
  return null;
}

const NOTIF_ICON: Record<string, string> = {
  SAM_ALERT:            '🚨',
  HIGH_RISK_ALERT:      '⚠️',
  VACCINATION_REMINDER: '💉',
  VACCINATION_OVERDUE:  '📅',
  GROWTH_RISK:          '📊',
  MISSED_VISIT:         '🏠',
  ZONE_SUMMARY:         '📋',
  CHW_INACTIVE:         '👤',
  VISIT_REQUESTED:      '🏠',
  VISIT_ACCEPTED:       '✅',
  VISIT_DECLINED:       '❌',
  VISIT_COMPLETED:      '🎉',
  BROADCAST:            '📢',
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
  { value: 'VISIT_REQUESTED', label: 'Visit Request' },
];

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return iso; }
}

// ── Row ────────────────────────────────────────────────────────────────────────

function NotifRow({
  n, role,
  onRead, onDelete,
  isMarkingRead, isDeleting,
}: {
  n: AppNotification;
  role: string;
  onRead: () => void;
  onDelete: () => void;
  isMarkingRead: boolean;
  isDeleting: boolean;
}) {
  const router = useRouter();
  const link = resolveLink(n, role);

  function handleRowClick() {
    if (!n.is_read) onRead();
    if (link) router.push(link);
  }

  return (
    <div
      className="flex items-start gap-3 px-4 py-3.5 border-b last:border-b-0 transition-colors group"
      style={{
        borderColor:     'var(--border)',
        backgroundColor: n.is_read ? 'var(--bg-elev)' : 'color-mix(in srgb, var(--warn) 6%, var(--bg-elev))',
        cursor:          link ? 'pointer' : 'default',
      }}
      onClick={link ? handleRowClick : undefined}
    >
      {/* Unread dot */}
      <div className="mt-2 shrink-0 w-2">
        {!n.is_read && (
          <span className="block w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--warn)' }} />
        )}
      </div>

      {/* Emoji icon */}
      <span className="text-lg shrink-0 mt-0.5" aria-hidden="true">
        {NOTIF_ICON[n.trigger_type] ?? '📢'}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{n.title}</p>
          {link && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→ tap to view</span>
          )}
        </div>
        {n.child_name && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Child: {n.child_name}
          </p>
        )}
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {n.body}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
          {fmtDate(n.created_at)}
        </p>
      </div>

      {/* Actions — stop propagation so clicks on buttons don't nav */}
      <div
        className="flex items-center gap-1 shrink-0 ml-1"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mark read */}
        {!n.is_read && (
          <button
            title="Mark as read"
            disabled={isMarkingRead}
            onClick={onRead}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[color-mix(in_srgb,var(--success)_12%,transparent)] disabled:opacity-40"
            style={{ color: 'var(--success)' }}
          >
            {isMarkingRead
              ? <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
              : <Check size={14} />}
          </button>
        )}

        {/* Delete */}
        <button
          title="Delete notification"
          disabled={isDeleting}
          onClick={onDelete}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] disabled:opacity-40"
          style={{ color: 'var(--danger)' }}
        >
          {isDeleting
            ? <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
            : <Trash2 size={13} />}
        </button>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AllNotificationsPage() {
  const qc   = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? 'PARENT';

  const { data: notifications, isLoading } = useAllNotifications();
  const [typeFilter, setTypeFilter]         = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [markingAll, setMarkingAll]         = useState(false);

  const all         = notifications ?? [];
  const unreadCount = all.filter((n) => !n.is_read).length;

  const filtered = all.filter((n) => {
    if (typeFilter && n.trigger_type !== typeFilter) return false;
    if (showUnreadOnly && n.is_read) return false;
    return true;
  });

  const readMut = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.allNotifications });
      qc.invalidateQueries({ queryKey: QK.notifications });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.allNotifications });
      qc.invalidateQueries({ queryKey: QK.notifications });
    },
  });

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      qc.invalidateQueries({ queryKey: QK.allNotifications });
      qc.invalidateQueries({ queryKey: QK.notifications });
    } finally { setMarkingAll(false); }
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
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
            <CheckCheck size={14} className="mr-1.5" />
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

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
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
            <NotifRow
              key={n.id}
              n={n}
              role={role}
              onRead={() => readMut.mutate(n.id)}
              onDelete={() => deleteMut.mutate(n.id)}
              isMarkingRead={readMut.isPending && readMut.variables === n.id}
              isDeleting={deleteMut.isPending && deleteMut.variables === n.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
