/**
 * Notifications & Broadcasts API
 * Single module for all notification-related calls.
 */
import { apiClient } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppNotification {
  id:           string;
  trigger_type: string;
  title:        string;
  body:         string;
  is_read:      boolean;
  created_at:   string;
  child_name:   string | null;
  child_id:     string | null;
}

interface BackendNotification {
  id:                        string;
  notification_type:         string;
  notification_type_display: string;
  message:                   string;
  is_read:                   boolean;
  created_at:                string;
  sent_at:                   string | null;
  child:                     string | null;
  child_name:                string | null;
}

export interface Broadcast {
  id:             string;
  scope_type:     string;
  scope_id:       string;
  channel:        'SMS' | 'PUSH';
  body:           string;
  sent_at:        string | null;
  delivery_count: number;
  created_at:     string;
}

export interface SendBroadcastPayload {
  scope_type: string;
  scope_id:   string;
  channel:    string;
  body:       string;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

function adapt(n: BackendNotification): AppNotification {
  return {
    id:           n.id,
    trigger_type: n.notification_type,
    title:        n.notification_type_display,
    body:         n.message,
    is_read:      n.is_read,
    created_at:   n.created_at ?? n.sent_at ?? new Date().toISOString(),
    child_name:   n.child_name,
    child_id:     n.child ?? null,
  };
}

// ── Notifications ─────────────────────────────────────────────────────────────

/** The list comes as a plain page ({results}) or wrapped ({data: [...] | {results}}). */
function rowsOf(body: unknown): BackendNotification[] {
  const b = body as { data?: unknown; results?: unknown };
  const d = (b?.data ?? b) as { results?: unknown } | unknown[];
  const rows = Array.isArray(d) ? d : (d as { results?: unknown })?.results;
  return Array.isArray(rows) ? (rows as BackendNotification[]) : [];
}

export async function getUnreadNotifications(): Promise<{
  count:   number;
  results: AppNotification[];
}> {
  const { data } = await apiClient.get('/notifications/');
  const all = rowsOf(data);
  const unread = all.filter((n) => !n.is_read).map(adapt);
  return { count: unread.length, results: unread };
}

export async function getAllNotifications(): Promise<AppNotification[]> {
  // In-app copies only: each alert is also stored once per SMS, which would show twice
  const { data } = await apiClient.get('/notifications/', { params: { channel: 'PUSH' } });
  const all = rowsOf(data);
  return all.map(adapt);
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.patch(`/notifications/${id}/read/`);
}

export async function markNotificationUnread(id: string): Promise<void> {
  await apiClient.patch(`/notifications/${id}/unread/`);
}

/** What the reminder system has sent this person. */
export interface NotificationSummary { total: number; unread: number; reminders: number; overdue_alerts: number; sms_sent: number }

export async function getNotificationSummary(): Promise<NotificationSummary> {
  const { data } = await apiClient.get('/notifications/summary/');
  return data.data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.patch('/notifications/read-all/');
}

export async function deleteNotification(id: string): Promise<void> {
  await apiClient.delete(`/notifications/${id}/dismiss/`);
}

// ── Broadcasts ────────────────────────────────────────────────────────────────

export async function listBroadcasts(): Promise<Broadcast[]> {
  const { data } = await apiClient.get('/notifications/broadcasts/');
  return data.data ?? data.results ?? [];
}

export async function sendBroadcast(payload: SendBroadcastPayload): Promise<Broadcast> {
  const { data } = await apiClient.post('/notifications/broadcasts/', payload);
  return data.data;
}
