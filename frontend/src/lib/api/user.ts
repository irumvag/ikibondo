import { apiClient } from './client';
import { useAuthStore, type AuthUser } from '@/store/authStore';

// AppNotification type lives in notifications.ts — re-exported for consumers
export type { AppNotification } from './notifications';

// ── Current user ──────────────────────────────────────────────────────────────

export async function getMe(): Promise<AuthUser> {
  const { data } = await apiClient.get('/auth/me/');
  return data.data;
}

export async function patchMe(
  payload: Partial<Pick<AuthUser, 'preferred_language' | 'theme_preference'> & { phone_number?: string; full_name?: string; national_id?: string; notification_prefs?: Record<string, unknown> }>,
): Promise<AuthUser> {
  const { data } = await apiClient.patch('/auth/me/', payload);
  return data.data;
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const { data } = await apiClient.post('/auth/change-password/', {
    old_password: oldPassword,
    new_password: newPassword,
  });
  // The server signs out every existing session and returns a fresh pair for this one
  const tokens = data?.data;
  if (tokens?.access && tokens?.refresh) {
    useAuthStore.getState().setTokens(tokens.access, tokens.refresh);
  }
}

// ── Notifications (re-exported from notifications.ts for backwards compat) ─────

export {
  getUnreadNotifications,
  getAllNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from './notifications';
