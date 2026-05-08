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

// ── Visit Requests ──────────────────────────────────────────────────────────

export type VisitUrgency = 'ROUTINE' | 'SOON' | 'URGENT';
export type VisitRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED' | 'WITHDRAWN';

export interface VisitRequest {
  id: string;
  child: string;
  child_name: string;
  requested_by: string;
  requested_by_name: string | null;
  urgency: VisitUrgency;
  concern_text: string;
  symptom_flags: string[];
  status: VisitRequestStatus;
  assigned_chw: string | null;
  assigned_chw_name: string | null;
  eta: string | null;
  decline_reason: string;
  accepted_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CreateVisitRequestPayload {
  child: string;
  urgency: VisitUrgency;
  concern_text: string;
  symptom_flags: string[];
}

export async function createVisitRequest(payload: CreateVisitRequestPayload): Promise<VisitRequest> {
  const { data } = await apiClient.post('/children/visit-requests/', payload);
  return data.data;
}

export async function listVisitRequests(status?: VisitRequestStatus): Promise<VisitRequest[]> {
  const params = status ? { status } : {};
  const { data } = await apiClient.get('/children/visit-requests/', { params });
  return data.data ?? [];
}

export async function withdrawVisitRequest(id: string): Promise<VisitRequest> {
  const { data } = await apiClient.post(`/children/visit-requests/${id}/withdraw/`);
  return data.data;
}
