import { apiClient } from './client';
import type { AuthUser } from '@/store/authStore';
import type { FAQItem } from './public';

// ── Users ─────────────────────────────────────────────────────────────────────

export async function listUsers(role?: string): Promise<AuthUser[]> {
  const { data } = await apiClient.get('/auth/users/', { params: role ? { role } : {} });
  return data.data ?? [];
}

export async function createStaffUser(payload: {
  email: string;
  full_name: string;
  role: string;
  phone_number?: string;
  camp?: string;
  password?: string;
}): Promise<AuthUser> {
  const { data } = await apiClient.post('/auth/users/', payload);
  return data.data;
}

export async function getPendingApprovals(): Promise<AuthUser[]> {
  const { data } = await apiClient.get('/auth/pending-approvals/');
  return data.data ?? [];
}

export async function approveUser(userId: string): Promise<AuthUser> {
  const { data } = await apiClient.patch(`/auth/approve/${userId}/`);
  return data.data;
}

export async function updateUser(
  userId: string,
  payload: Partial<{
    full_name: string;
    email: string;
    phone_number: string;
    role: string;
    camp: string | null;
    is_approved: boolean;
  }>,
): Promise<AuthUser> {
  const { data } = await apiClient.patch(`/auth/users/${userId}/`, payload);
  return data.data;
}

export async function deactivateUser(userId: string): Promise<void> {
  await apiClient.delete(`/auth/users/${userId}/`);
}

// ── Camps & Zones ─────────────────────────────────────────────────────────────

export interface Camp {
  id: string;
  name: string;
  code: string;
  district?: string;
  province?: string;
  estimated_population?: number;
  managing_body?: string;
  status: string;
  capacity?: number;
  active_children_count: number;
  is_active: boolean;
  created_at: string;
}

export interface CampStats {
  camp_id: string;
  camp_name: string;
  total_children: number;
  sam_count: number;
  mam_count: number;
  normal_count: number;
  vaccination_coverage_percent: number;
}

export interface Zone {
  id: string;
  camp: string;
  camp_name: string;
  name: string;
  code: string;
  description?: string;
  estimated_households?: number;
  estimated_population?: number;
  status: string;
  is_active: boolean;
  created_at: string;
}

export async function listCamps(): Promise<Camp[]> {
  const { data } = await apiClient.get('/camps/');
  // DRF router may return paginated or plain list
  const payload = data.data ?? data;
  return payload?.results ?? payload ?? [];
}

export async function getCampStats(campId: string): Promise<CampStats> {
  const { data } = await apiClient.get(`/camps/${campId}/stats/`);
  return data.data;
}

export async function listZones(campId: string): Promise<Zone[]> {
  const { data } = await apiClient.get(`/camps/${campId}/zones/`);
  const payload = data.data ?? data;
  return payload?.results ?? payload ?? [];
}

export async function createCamp(payload: {
  name: string;
  code: string;
  district?: string;
  province?: string;
  estimated_population?: number;
  managing_body?: string;
  status: string;
  capacity?: number;
}): Promise<Camp> {
  const { data } = await apiClient.post('/camps/', payload);
  return data.data ?? data;
}

export async function updateCamp(
  campId: string,
  payload: Partial<{
    name: string;
    code: string;
    district: string;
    province: string;
    estimated_population: number;
    managing_body: string;
    status: string;
    capacity: number;
  }>,
): Promise<Camp> {
  const { data } = await apiClient.patch(`/camps/${campId}/`, payload);
  return data.data ?? data;
}

export async function deleteCamp(campId: string): Promise<void> {
  await apiClient.delete(`/camps/${campId}/`);
}

export async function createZone(
  campId: string,
  payload: {
    name: string;
    code: string;
    description?: string;
    estimated_households?: number;
    estimated_population?: number;
    status: string;
  },
): Promise<Zone> {
  const { data } = await apiClient.post(`/camps/${campId}/zones/`, payload);
  return data.data ?? data;
}

export async function updateZone(
  campId: string,
  zoneId: string,
  payload: Partial<{
    name: string;
    code: string;
    description: string;
    estimated_households: number;
    estimated_population: number;
    status: string;
  }>,
): Promise<Zone> {
  const { data } = await apiClient.patch(`/camps/${campId}/zones/${zoneId}/`, payload);
  return data.data ?? data;
}

export async function deleteZone(campId: string, zoneId: string): Promise<void> {
  await apiClient.delete(`/camps/${campId}/zones/${zoneId}/`);
}

// ── Guardians ─────────────────────────────────────────────────────────────────

export interface Guardian {
  id: string;
  full_name: string;
  phone_number: string;
  relationship: string;
  national_id?: string;
  has_account: boolean;
  user_id?: string | null;
  user_email?: string | null;
  assigned_chw?: string | null;
  assigned_chw_name?: string | null;
}

export async function listGuardians(search?: string): Promise<Guardian[]> {
  const { data } = await apiClient.get('/children/guardians/', {
    params: search ? { search } : {},
  });
  const payload = data.data ?? data;
  return payload?.results ?? payload ?? [];
}

export async function linkGuardianAccount(guardianId: string, userId: string | null): Promise<Guardian> {
  const { data } = await apiClient.post(`/children/guardians/${guardianId}/link-account/`, { user_id: userId });
  return data.data;
}

export async function assignCHWToGuardian(guardianId: string, chwId: string | null): Promise<Guardian> {
  const { data } = await apiClient.post(`/children/guardians/${guardianId}/assign-chw/`, { chw_id: chwId });
  return data.data;
}

export async function listGuardiansBycamp(campId?: string): Promise<Guardian[]> {
  const { data } = await apiClient.get('/children/guardians/', {
    params: campId ? { camp: campId } : {},
  });
  const payload = data.data ?? data;
  return payload?.results ?? (Array.isArray(payload) ? payload : []);
}

// ── Vaccinations ──────────────────────────────────────────────────────────────

export interface VaccinationRecord {
  id: string;
  child: string;
  child_name: string;
  vaccine: string;
  vaccine_name: string;
  vaccine_code: string;
  dose_number: number;
  scheduled_date: string;
  administered_date: string | null;
  administered_by: string | null;
  administered_by_name: string | null;
  status: 'SCHEDULED' | 'DONE' | 'MISSED' | 'SKIPPED';
  batch_number: string;
  dropout_probability: string | null;
  dropout_risk_tier: string | null;
  is_overdue: boolean;
  notes: string;
  created_at: string;
}

export interface VaccineRecord {
  id: string;
  name: string;
  short_code: string;
  dose_number: number;
  recommended_age_weeks: number;
  is_active: boolean;
}

export async function listVaccinations(params?: {
  camp?: string;
  zone?: string;
  status?: string;
  child?: string;
  page?: number;
}): Promise<{ results: VaccinationRecord[]; count: number }> {
  const { data } = await apiClient.get('/vaccinations/', { params });
  const payload = data.data ?? data;
  return {
    results: payload?.results ?? (Array.isArray(payload) ? payload : []),
    count: payload?.count ?? 0,
  };
}

export async function createVaccination(payload: {
  child: string;
  vaccine: string;
  scheduled_date: string;
  status?: string;
  notes?: string;
}): Promise<VaccinationRecord> {
  const { data } = await apiClient.post('/vaccinations/', payload);
  return data.data ?? data;
}

export async function updateVaccination(
  id: string,
  payload: Partial<{
    status: string;
    scheduled_date: string;
    administered_date: string;
    batch_number: string;
    notes: string;
  }>,
): Promise<VaccinationRecord> {
  const { data } = await apiClient.patch(`/vaccinations/${id}/`, payload);
  return data.data ?? data;
}

export async function deleteVaccination(id: string): Promise<void> {
  await apiClient.delete(`/vaccinations/${id}/`);
}

export async function listVaccines(params?: { search?: string; is_active?: boolean }): Promise<VaccineRecord[]> {
  const { data } = await apiClient.get('/vaccinations/vaccines/', { params });
  const payload = data.data ?? data;
  return payload?.results ?? (Array.isArray(payload) ? payload : []);
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  user: string;
  user_name: string;
  action: string;
  model: string;
  object_id: string;
  object_repr: string;
  timestamp: string;
  changes?: Record<string, unknown>;
}

export async function listAuditLog(params?: {
  page?: number;
  page_size?: number;
  user?: string;
  action?: string;
}): Promise<{ count: number; results: AuditLogEntry[] }> {
  const { data } = await apiClient.get('/audit/log/', { params });
  const payload = data.data ?? data;
  return {
    count: payload.count ?? 0,
    results: payload.results ?? [],
  };
}

// ── FAQ (admin CRUD) ───────────────────────────────────────────────────────────

export async function listAllFaqItems(): Promise<FAQItem[]> {
  const { data } = await apiClient.get('/faq/');
  const payload = data?.results ?? data?.data ?? data;
  return Array.isArray(payload) ? payload : payload?.results ?? [];
}

export async function createFaqItem(
  payload: Pick<FAQItem, 'question' | 'answer' | 'order' | 'is_published'>,
): Promise<FAQItem> {
  const { data } = await apiClient.post('/faq/', payload);
  return data?.data ?? data;
}

export async function updateFaqItem(
  id: string,
  payload: Partial<Pick<FAQItem, 'question' | 'answer' | 'order' | 'is_published'>>,
): Promise<FAQItem> {
  const { data } = await apiClient.patch(`/faq/${id}/`, payload);
  return data?.data ?? data;
}

export async function deleteFaqItem(id: string): Promise<void> {
  await apiClient.delete(`/faq/${id}/`);
}
