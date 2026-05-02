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
