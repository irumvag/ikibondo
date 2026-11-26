'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Bell, BellOff, CalendarClock, Check, CheckCheck, ChevronDown, FileBarChart, HeartPulse, Home,
  Mail, Megaphone, MessageSquare, Siren, Syringe, Trash2, UserRound,
} from 'lucide-react';
import { QK, useAllNotifications } from '@/lib/api/queries';
import {
  deleteNotification, getNotificationSummary, markAllNotificationsRead, markNotificationRead, markNotificationUnread,
  type AppNotification,
} from '@/lib/api/notifications';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { useAuthStore } from '@/store/authStore';

// ── Where a notification leads ─────────────────────────────────────────────────

function resolveLink(n: AppNotification, role: string): string | null {
  const t = n.trigger_type;
  // Account
  if (t === 'ROLE_GRANTED') return '/profile';
  if (t === 'CASE_CLOSED') {
    if (role === 'ADMIN') return '/admin/closed-cases';
    if (role === 'SUPERVISOR') return '/supervisor/closed-cases';
    return '/nurse/closed-cases';
  }
  // Visit-related (types as sent by the API, see notifications/models.py)
  if (t === 'VISIT_REQUEST_CREATED' || t === 'MISSED_VISIT')    return '/chw/requests';
  if (t === 'VISIT_REQUEST_ACCEPTED' || t === 'VISIT_REQUEST_DECLINED' ||
      t === 'VISIT_REQUEST_COMPLETED')                          return '/parent/request-visit';
  if (t === 'VACCINATION_DONE') {
    if (role === 'PARENT') return '/parent/vaccines';
    return '/nurse/vaccines';
  }
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
    if (role === 'CHW')    return '/chw/vaccines';
    return '/nurse/children';
  }
  // Admin / supervisor
  if (t === 'ZONE_SUMMARY')  return '/supervisor/analytics';
  if (t === 'CHW_INACTIVE')  return '/supervisor/staff';
  if (t === 'BROADCAST')     return null;
  return null;
}

// ── Look and grouping ─────────────────────────────────────────────────────────

type Category = 'all' | 'health' | 'vaccines' | 'visits' | 'messages' | 'reports';

const CATEGORY: Record<string, Exclude<Category, 'all'>> = {
  SAM_ALERT: 'health', HIGH_RISK_ALERT: 'health', GROWTH_RISK: 'health', CASE_CLOSED: 'health',
  VACCINATION_REMINDER: 'vaccines', VACCINATION_OVERDUE: 'vaccines', VACCINATION_DONE: 'vaccines',
  VISIT_REQUEST_CREATED: 'visits', VISIT_REQUEST_ACCEPTED: 'visits', VISIT_REQUEST_DECLINED: 'visits',
  VISIT_REQUEST_COMPLETED: 'visits', MISSED_VISIT: 'visits',
  BROADCAST: 'messages', ROLE_GRANTED: 'messages',
  ZONE_SUMMARY: 'reports', CHW_INACTIVE: 'reports',
};
// Filter names: messages/en.json notifications.category.<category>
const CATEGORIES: Category[] = ['all', 'health', 'vaccines', 'visits', 'messages', 'reports'];

const LOOK: Record<string, { icon: typeof Bell; color: string }> = {
  SAM_ALERT: { icon: Siren, color: 'var(--danger)' },
  HIGH_RISK_ALERT: { icon: AlertTriangle, color: 'var(--danger)' },
  GROWTH_RISK: { icon: HeartPulse, color: 'var(--warn)' },
  VACCINATION_REMINDER: { icon: CalendarClock, color: 'var(--ink)' },
  VACCINATION_OVERDUE: { icon: Syringe, color: 'var(--danger)' },
  VACCINATION_DONE: { icon: Syringe, color: 'var(--success)' },
  VISIT_REQUEST_CREATED: { icon: Home, color: 'var(--ink)' },
  VISIT_REQUEST_ACCEPTED: { icon: Home, color: 'var(--success)' },
  VISIT_REQUEST_DECLINED: { icon: Home, color: 'var(--danger)' },
  VISIT_REQUEST_COMPLETED: { icon: Home, color: 'var(--success)' },
  MISSED_VISIT: { icon: Home, color: 'var(--warn)' },
  BROADCAST: { icon: Megaphone, color: 'var(--accent)' },
  ROLE_GRANTED: { icon: UserRound, color: 'var(--ink)' },
  ZONE_SUMMARY: { icon: FileBarChart, color: 'var(--ink)' },
  CHW_INACTIVE: { icon: UserRound, color: 'var(--warn)' },
};

type TimeT = (key: 'time.justNow' | 'time.minutesAgo' | 'time.hoursAgo', values?: { count: number }) => string;

function relativeTime(iso: string, t: TimeT) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t('time.justNow');
  if (mins < 60) return t('time.minutesAgo', { count: mins });
  const h = Math.round(mins / 60);
  if (h < 24) return t('time.hoursAgo', { count: h });
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// Group code; its heading is in messages/en.json notifications.group.<code>
function dayGroup(iso: string): 'today' | 'yesterday' | 'week' | 'older' {
  const d = new Date(iso); const now = new Date();
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return 'week';
  return 'older';
}

// ── Row ────────────────────────────────────────────────────────────────────────

function NotifRow({ n, role, onToggleRead, onDelete, busy }: {
  n: AppNotification; role: string; onToggleRead: () => void; onDelete: () => void; busy: boolean;
}) {
  const tt = useTranslations('notifications');
  const router = useRouter();
  const link = resolveLink(n, role);
  const look = LOOK[n.trigger_type] ?? { icon: Bell, color: 'var(--ink)' };
  const Icon = look.icon;
  const message = n.body.replace(/^\[Ikibondo\]\s*/, '');

  const open = () => {
    if (!n.is_read) onToggleRead();
    if (link) router.push(link);
  };

  return (
    <li className="relative flex items-start gap-3 px-4 sm:px-5 py-3.5 border-b last:border-b-0 transition-colors hover:bg-[var(--bg-sand)]"
      style={{ borderColor: 'var(--border)', backgroundColor: n.is_read ? undefined : 'color-mix(in srgb, var(--ink) 4%, var(--bg-elev))' }}>
      {!n.is_read && <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r" style={{ backgroundColor: 'var(--ink)' }} aria-hidden="true" />}
      <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{ color: look.color, backgroundColor: `color-mix(in srgb, ${look.color} 12%, transparent)` }}>
        <Icon size={18} aria-hidden="true" />
      </span>
      <button type="button" onClick={open} className="flex-1 min-w-0 text-left" disabled={!link && n.is_read}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{n.title}</span>
          {!n.is_read && <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--ink)', color: 'var(--bg-elev)' }}>{tt('new')}</span>}
        </div>
        <p className="text-sm mt-0.5 leading-relaxed" style={{ color: 'var(--text)', fontWeight: n.is_read ? 400 : 500 }}>{message}</p>
        <p className="text-xs mt-1 flex flex-wrap items-center gap-x-2" style={{ color: 'var(--text-muted)' }}>
          <span>{relativeTime(n.created_at, tt)}</span>
          {n.child_name && <span>· {n.child_name}</span>}
          {link && <span style={{ color: 'var(--ink)' }}>{tt('open')}</span>}
        </p>
      </button>
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" onClick={onToggleRead} disabled={busy}
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-elev)]"
          title={n.is_read ? tt('markAsUnread') : tt('markAsRead')} aria-label={n.is_read ? tt('markAsUnread') : tt('markAsRead')}
          style={{ color: 'var(--text-muted)' }}>
          {n.is_read ? <Mail size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
        </button>
        <button type="button" onClick={onDelete} disabled={busy}
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-elev)]"
          title={tt('remove')} aria-label={tt('remove')} style={{ color: 'var(--text-muted)' }}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const tt = useTranslations('notifications');
  const qc = useQueryClient();
  const toast = useToast();
  const role = useAuthStore((s) => s.user?.role ?? '');
  const { data: all = [], isLoading } = useAllNotifications();
  const { data: summary } = useQuery({ queryKey: ['notification-summary'], queryFn: getNotificationSummary, staleTime: 15_000 });
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [category, setCategory] = useState<Category>('all');
  const [howOpen, setHowOpen] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: QK.allNotifications });
    qc.invalidateQueries({ queryKey: ['notification-summary'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };
  const toggleRead = useMutation({
    mutationFn: (n: AppNotification) => (n.is_read ? markNotificationUnread(n.id) : markNotificationRead(n.id)),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteNotification(id), onSuccess: () => { refresh(); toast.success(tt('removed')); } });
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: () => { refresh(); toast.success(tt('allMarkedAsRead')); } });

  const unread = all.filter((n) => !n.is_read).length;
  const present = useMemo(() => new Set(all.map((n) => CATEGORY[n.trigger_type] ?? 'messages')), [all]);
  const shown = all
    .filter((n) => !unreadOnly || !n.is_read)
    .filter((n) => category === 'all' || (CATEGORY[n.trigger_type] ?? 'messages') === category);
  const groups = (['today', 'yesterday', 'week', 'older'] as const)
    .map((g) => ({ g, items: shown.filter((n) => dayGroup(n.created_at) === g) }))
    .filter((x) => x.items.length);

  return (
    <div className="flex flex-col gap-5 max-w-3xl mx-auto w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>{tt('notifications')}</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {unread ? tt('unreadOf', { unread, total: all.length }) : all.length ? tt('youAreAllCaught') : tt('alertsAndRemindersAppear')}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="secondary" size="sm" loading={readAll.isPending} onClick={() => readAll.mutate()}>
            <CheckCheck size={15} className="mr-1.5" aria-hidden="true" />{' '}{tt('markAllRead')}</Button>
        )}
      </div>

      {/* What the reminder system has sent */}
      <section className="rounded-2xl p-4 sm:p-5" style={{ background: 'linear-gradient(120deg, var(--ink), var(--sky))', boxShadow: 'var(--shadow-md)' }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            ['Unread', summary?.unread], ['Reminders', summary?.reminders],
            ['Overdue alerts', summary?.overdue_alerts], ['SMS sent', summary?.sms_sent],
          ] as const).map(([label, v]) => (
            <div key={label} className="rounded-xl px-3 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,.12)' }}>
              <p className="text-2xl font-extrabold text-white tabular-nums">{v ?? '—'}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,.85)' }}>{label}</p>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setHowOpen((o) => !o)} aria-expanded={howOpen}
          className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-white">{tt('howRemindersWork')}{' '}<ChevronDown size={16} className={`transition-transform ${howOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {howOpen && (
          <ul className="mt-2 flex flex-col gap-1.5 text-sm" style={{ color: 'rgba(255,255,255,.92)' }}>
            <li>{tt.rich('beforeVaccine', { b: (chunks) => <b>{chunks}</b> })}</li>
            <li>{tt.rich('afterMissedDose', { b: (chunks) => <b>{chunks}</b> })}</li>
            <li>{tt.rich('healthAlertsRule', { b: (chunks) => <b>{chunks}</b> })}</li>
            <li>{tt.rich('howDelivered', { b: (chunks) => <b>{chunks}</b> })}</li>
          </ul>
        )}
      </section>

      {/* Filters: scroll sideways on phones */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full p-0.5 shrink-0" style={{ backgroundColor: 'var(--bg-sand)' }} role="group" aria-label={tt('show')}>
          {([false, true] as const).map((u) => (
            <button key={String(u)} type="button" onClick={() => setUnreadOnly(u)} aria-pressed={unreadOnly === u}
              className="px-3.5 h-8 rounded-full text-sm font-semibold transition-colors"
              style={unreadOnly === u ? { backgroundColor: 'var(--ink)', color: 'var(--bg-elev)' } : { color: 'var(--ink)' }}>
              {u ? tt('unreadTab', { count: unread }) : tt('all')}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto max-w-full pb-1 -mb-1">
          {CATEGORIES.filter((c) => c === 'all' || present.has(c as never)).map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={category === c}
              className="px-3 h-8 rounded-full text-sm whitespace-nowrap border transition-colors"
              style={category === c
                ? { borderColor: 'var(--ink)', color: 'var(--ink)', backgroundColor: 'var(--bg-sand)', fontWeight: 600 }
                : { borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              {tt(`category.${c}`)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border p-10 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
          <span className="mx-auto mb-3 w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}>
            {unreadOnly ? <Check size={26} aria-hidden="true" /> : <BellOff size={26} aria-hidden="true" />}
          </span>
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>{unreadOnly ? tt('nothingUnread') : tt('noNotificationsHere')}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {unreadOnly ? tt('youHaveReadEverything') : tt('remindersAlertsAndVisit')}
          </p>
        </div>
      ) : (
        groups.map(({ g, items }) => (
          <section key={g} aria-labelledby={`grp-${g}`}>
            <h3 id={`grp-${g}`} className="text-xs font-semibold uppercase tracking-wide mb-2 px-1 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <MessageSquare size={12} aria-hidden="true" /> {tt(`group.${g}`)}
            </h3>
            <ul className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', boxShadow: 'var(--shadow-sm)' }}>
              {items.map((n) => (
                <NotifRow key={n.id} n={n} role={role}
                  busy={toggleRead.isPending || remove.isPending}
                  onToggleRead={() => toggleRead.mutate(n)}
                  onDelete={() => remove.mutate(n.id)} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
