'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, X, CheckCheck } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import {
  getUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from '@/lib/api/user';

const TRIGGER_LABELS: Record<AppNotification['trigger_type'], string> = {
  HIGH_RISK_ALERT:       'High-risk alert',
  VACCINATION_REMINDER:  'Vaccination reminder',
  VACCINATION_OVERDUE:   'Vaccination overdue',
  ZONE_SUMMARY:          'Zone summary',
  CHW_INACTIVE:          'CHW inactive',
  ACCOUNT_APPROVED:      'Account approved',
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationBell() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const { data } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: getUnreadNotifications,
    refetchInterval: 30_000,
    enabled: !!user,
    placeholderData: { count: 0, results: [] },
  });

  const count   = data?.count ?? 0;
  const items   = data?.results ?? [];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    qc.invalidateQueries({ queryKey: ['notifications', 'unread'] });
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    qc.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={count > 0 ? `${count} unread notifications` : 'Notifications'}
        aria-expanded={open}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-colors hover:bg-[var(--bg-sand)]"
        style={{ color: 'var(--ink)' }}
      >
        <Bell size={18} aria-hidden="true" />
        {count > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold px-1"
            style={{ backgroundColor: 'var(--danger)', color: '#fff' }}
            aria-hidden="true"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-80 rounded-2xl overflow-hidden shadow-xl z-50"
          style={{
            backgroundColor: 'var(--bg-elev)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-xl)',
          }}
          role="dialog"
          aria-label="Notifications"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              Notifications {count > 0 && <span style={{ color: 'var(--text-muted)' }}>({count})</span>}
            </p>
            <div className="flex items-center gap-1">
              {count > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors hover:bg-[var(--bg-sand)]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <CheckCheck size={12} aria-hidden="true" />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-[var(--bg-sand)]"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Close notifications"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
                <Bell size={24} style={{ color: 'var(--border)' }} aria-hidden="true" />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No unread notifications
                </p>
              </div>
            ) : (
              <ul>
                {items.map((n) => (
                  <li
                    key={n.id}
                    className="group flex gap-3 px-4 py-3 border-b last:border-0 transition-colors hover:bg-[var(--bg-sand)]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{
                        backgroundColor: n.trigger_type === 'HIGH_RISK_ALERT'
                          ? 'var(--danger)'
                          : 'var(--accent)',
                      }}
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--ink)' }}>
                        {n.title}
                      </p>
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                        {n.body}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-md"
                          style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}
                        >
                          {TRIGGER_LABELS[n.trigger_type] ?? n.trigger_type}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {timeAgo(n.created_at)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleMarkRead(n.id)}
                      className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded-lg transition-all hover:bg-[var(--bg-sand)] shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                      aria-label="Mark as read"
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
