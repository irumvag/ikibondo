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

/** The signed-in person's own work for their current role (profile page). */
export interface ProfileSummary {
  role: string;
  member_since: string | null;
  last_sign_in: string | null;
  work: {
    // Parent: the list of their children (CHW: a count, see below)
    children?: number | {
      id: string; full_name: string; age_display: string; sex: 'M' | 'F'; camp_name: string | null;
      nutrition_status: string | null; risk_level: string | null; last_checkup: string | null;
      next_vaccine: { name: string; date: string } | null; overdue_doses: number;
    }[];
    care_team?: { full_name: string; phone_number: string | null; role: string }[];
    // CHW
    zones?: string[] | number; families?: number; open_visit_requests?: number; last_checkup?: string | null;
    // Shared counts
    checkups_this_month?: number; chws?: number; children_in_camp?: number; registered_by_me?: number;
    open_referrals?: number; open_sessions?: number; camps?: number | string[]; active_users?: number;
    // Government / partner
    organization?: string | null; kind?: string; all_camps?: boolean;
  };
}

export async function getProfileSummary(): Promise<ProfileSummary> {
  const { data } = await apiClient.get('/auth/me/summary/');
  return data.data;
}
