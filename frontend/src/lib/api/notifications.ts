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
}

interface BackendNotification {
  id:                        string;
  notification_type:         string;
  notification_type_display: string;
  message:                   string;
  is_read:                   boolean;
  created_at:                string;
  sent_at:                   string | null;
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
  };
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function getUnreadNotifications(): Promise<{
  count:   number;
  results: AppNotification[];
}> {
  const { data } = await apiClient.get('/notifications/');
  const all: BackendNotification[] = data.data ?? [];
  const unread = all.filter((n) => !n.is_read).map(adapt);
  return { count: unread.length, results: unread };
}

export async function getAllNotifications(): Promise<AppNotification[]> {
  const { data } = await apiClient.get('/notifications/');
  const all: BackendNotification[] = data.data ?? [];
  return all.map(adapt);
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.patch(`/notifications/${id}/read/`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.patch('/notifications/read-all/');
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
