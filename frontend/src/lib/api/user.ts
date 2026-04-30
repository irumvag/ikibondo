import { apiClient } from './client';
import type { AuthUser } from '@/store/authStore';

type Envelope<T> = { status: string; data: T };

function unwrap<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    return (raw as Envelope<T>).data;
  }
  return raw as T;
}

// ── Current user ─────────────────────────────────────────────────────────────

export async function getMe(): Promise<AuthUser> {
  const { data } = await apiClient.get('/auth/me/');
  return unwrap<AuthUser>(data);
}

export async function patchMe(
  payload: Partial<Pick<AuthUser, 'preferred_language' | 'theme_preference' | 'full_name'>>,
): Promise<AuthUser> {
  const { data } = await apiClient.patch('/auth/me/', payload);
  return unwrap<AuthUser>(data);
}

// ── Notifications ─────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  trigger_type:
    | 'HIGH_RISK_ALERT'
    | 'VACCINATION_REMINDER'
    | 'VACCINATION_OVERDUE'
    | 'ZONE_SUMMARY'
    | 'CHW_INACTIVE'
    | 'ACCOUNT_APPROVED';
}

interface Paginated<T> { count: number; results: T[] }

export async function getUnreadNotifications(): Promise<{
  count: number;
  results: AppNotification[];
}> {
  const { data } = await apiClient.get<Paginated<AppNotification>>(
    '/notifications/',
    { params: { is_read: false, page_size: 10 } },
  );
  // Handle both { count, results } and { data: { count, results } } envelopes
  if (data && typeof data === 'object' && 'data' in data) {
    return (data as unknown as Envelope<Paginated<AppNotification>>).data;
  }
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.patch(`/notifications/${id}/`, { is_read: true });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.post('/notifications/mark-all-read/');
}
