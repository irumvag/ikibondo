import { apiClient } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RegisterChildPayload {
  full_name: string;
  date_of_birth: string;       // YYYY-MM-DD
  sex: 'M' | 'F';
  camp: string;                // UUID
  notes?: string;
  guardian: {
    full_name: string;
    phone_number: string;
    relationship: string;
    national_id: string;
  };
}

export interface VisitPayload {
  child: string;               // UUID
  measurement_date: string;    // YYYY-MM-DD
  weight_kg?: number;
  height_cm?: number;
  muac_cm?: number;
  oedema?: boolean;
  temperature_c?: number;
  respiratory_rate?: number;
  heart_rate?: number;
  spo2?: number;
  symptom_flags?: string[];
  notes?: string;
  data_source?: string;
}

export interface VisitResult {
  id: string;
  child_name: string;
  measurement_date: string;
  nutrition_status: string;
  nutrition_status_display: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  risk_factors: Record<string, number> | string[];
  ml_confidence: string | null;
  weight_for_height_z: string | null;
  height_for_age_z: string | null;
}

export interface VaccinationRecord {
  id: string;
  child: string;
  child_name: string;
  zone_name: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  vaccine: string;
  vaccine_name: string;
  vaccine_code: string;
  scheduled_date: string;
  administered_date: string | null;
  administered_by_name: string | null;
  status: 'SCHEDULED' | 'DONE' | 'MISSED' | 'SKIPPED';
  batch_number: string | null;
  notes: string;
  dropout_probability: string | null;
  dropout_risk_tier: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  is_overdue: boolean;
}

export interface SyncOperation {
  id: string;
  op: 'register_child' | 'create_visit' | 'administer_vaccine';
  payload: Record<string, unknown>;
}

export interface SyncResult {
  id: string;
  status: 'ok' | 'error' | 'conflict';
  data?: unknown;
  error?: string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function registerChild(payload: RegisterChildPayload) {
  const { data } = await apiClient.post('/children/', payload);
  return data.data;
}

export async function createVisit(payload: VisitPayload): Promise<VisitResult> {
  const { data } = await apiClient.post('/health-records/', payload);
  return data.data;
}

export async function listVaccinationQueue(params?: {
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<{ items: VaccinationRecord[]; count: number }> {
  const { data } = await apiClient.get('/vaccinations/', {
    params: { status: 'SCHEDULED', ...params },
  });
  return {
    items: data.data ?? [],
    count: data.pagination?.count ?? (data.data?.length ?? 0),
  };
}

export async function administerVaccine(
  recordId: string,
  payload: { administered_date?: string; batch_number?: string; notes?: string },
): Promise<VaccinationRecord> {
  const { data } = await apiClient.post(`/vaccinations/${recordId}/administer/`, payload);
  return data.data;
}

export async function syncBatch(operations: SyncOperation[]): Promise<SyncResult[]> {
  const { data } = await apiClient.post('/sync/batch/', { operations });
  return data.results ?? [];
}

// ── CHW Families (caseload) ───────────────────────────────────────────────────

export interface CHWChildSummary {
  id: string;
  full_name: string;
  registration_number: string;
  sex: 'M' | 'F';
  date_of_birth: string;
  age_display: string;
  age_months: number;
  zone_name: string | null;
  camp_name: string | null;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  last_visit_date: string | null;
  last_visit_days_ago: number | null;
  overdue_vaccines: number;
  upcoming_vaccines: number;
  next_vaccine_name: string | null;
  next_vaccine_date: string | null;
  next_vaccine_overdue: boolean;
}

export interface CHWFamily {
  id: string;
  full_name: string;
  phone_number: string;
  relationship: string;
  has_account: boolean;
  user_email: string | null;
  children: CHWChildSummary[];
}

export async function listCHWFamilies(): Promise<CHWFamily[]> {
  const { data } = await apiClient.get('/chw/families/');
  return data.data ?? [];
}

// ── Visit Requests (CHW side) ─────────────────────────────────────────────────

export type VisitRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED';

export interface CHWVisitRequest {
  id: string;
  child: string;
  child_name: string;
  requested_by: string;
  requested_by_name: string | null;
  urgency: 'ROUTINE' | 'SOON' | 'URGENT';
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

export async function listCHWVisitRequests(status?: VisitRequestStatus): Promise<CHWVisitRequest[]> {
  const params = status ? { status } : {};
  const { data } = await apiClient.get('/children/visit-requests/', { params });
  return data.data ?? [];
}

export async function acceptVisitRequest(id: string, eta?: string): Promise<CHWVisitRequest> {
  const { data } = await apiClient.post(`/children/visit-requests/${id}/accept/`, { eta });
  return data.data;
}

export async function declineVisitRequest(id: string, reason: string): Promise<CHWVisitRequest> {
  const { data } = await apiClient.post(`/children/visit-requests/${id}/decline/`, { reason });
  return data.data;
}

export async function completeVisitRequest(id: string): Promise<CHWVisitRequest> {
  const { data } = await apiClient.post(`/children/visit-requests/${id}/complete/`, {});
  return data.data;
}

// ── Consultations ─────────────────────────────────────────────────────────────

export interface ConsultationMessage {
  id: string;
  author: string;
  author_name: string | null;
  body: string;
  created_at: string;
}

export interface Consultation {
  id: string;
  child: string;
  child_name: string;
  opened_by: string;
  opened_by_name: string | null;
  assigned_nurse: string | null;
  assigned_nurse_name: string | null;
  status: 'OPEN' | 'RESOLVED' | 'ESCALATED';
  helpful_rating: number | null;
  disputed_classification: boolean;
  resolved_at: string | null;
  created_at: string;
  messages: ConsultationMessage[];
  message_count: number;
}

export async function listConsultations(): Promise<Consultation[]> {
  const { data } = await apiClient.get('/consultations/');
  return data.data ?? data.results ?? [];
}

export async function openConsultation(childId: string): Promise<Consultation> {
  const { data } = await apiClient.post('/consultations/', { child: childId });
  return data.data;
}

export async function sendConsultationMessage(consultationId: string, body: string): Promise<ConsultationMessage> {
  const { data } = await apiClient.post(`/consultations/${consultationId}/reply/`, { body });
  return data.data;
}

export async function resolveConsultation(consultationId: string, rating?: number): Promise<Consultation> {
  const { data } = await apiClient.post(`/consultations/${consultationId}/resolve/`, { helpful_rating: rating });
  return data.data;
}
