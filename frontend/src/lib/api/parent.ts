import { apiClient } from './client';
import type { SupervisedChild } from './supervisor';
import type { VaccinationRecord } from './chw';

export type { SupervisedChild, VaccinationRecord };

export interface ParentNotification {
  id: string;
  child: string | null;
  child_name: string | null;
  notification_type: string;
  notification_type_display: string;
  message: string;
  is_read: boolean;
  sent_at: string | null;
  created_at?: string;
}

export async function listMyChildren(): Promise<{ items: SupervisedChild[]; count: number }> {
  const { data } = await apiClient.get('/children/');
  return {
    items: data.data ?? [],
    count: data.pagination?.count ?? (data.data?.length ?? 0),
  };
}

export async function getChildVaccinations(childId: string): Promise<VaccinationRecord[]> {
  const { data } = await apiClient.get(`/children/${childId}/vaccinations/`);
  return data.data ?? [];
}

export async function listNotifications(): Promise<{ items: ParentNotification[]; unread: number }> {
  const { data } = await apiClient.get('/notifications/');
  const items: ParentNotification[] = data.data ?? [];
  return { items, unread: items.filter((n) => !n.is_read).length };
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.patch(`/notifications/${id}/read/`);
}

export async function markAllRead(): Promise<void> {
  await apiClient.patch('/notifications/read-all/');
}
