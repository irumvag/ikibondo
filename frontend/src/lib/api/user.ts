import { apiClient } from './client';
import type { AuthUser } from '@/store/authStore';

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

// ── Current user ──────────────────────────────────────────────────────────────

export async function getMe(): Promise<AuthUser> {
  const { data } = await apiClient.get('/auth/me/');
  return data.data;
}

export async function patchMe(
  payload: Partial<Pick<AuthUser, 'preferred_language' | 'theme_preference'> & { phone_number?: string }>,
): Promise<AuthUser> {
  const { data } = await apiClient.patch('/auth/me/', payload);
  return data.data;
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await apiClient.post('/auth/change-password/', {
    old_password: oldPassword,
    new_password: newPassword,
  });
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
