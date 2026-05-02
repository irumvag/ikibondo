import { apiClient } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GrowthPoint {
  date: string;
  age_months: number;
  weight_kg: number | null;
  height_cm: number | null;
  waz: number | null;
  haz: number | null;
  whz: number | null;
}

export interface PercentilePoint {
  age_months: number;
  value: number | null;
}

export interface GrowthData {
  child_id: string;
  child_name: string;
  measurements: GrowthPoint[];
  who_percentiles: {
    weight_for_age: { p3: PercentilePoint[]; p15: PercentilePoint[]; p50: PercentilePoint[]; p85: PercentilePoint[]; p97: PercentilePoint[] };
    height_for_age: { p3: PercentilePoint[]; p15: PercentilePoint[]; p50: PercentilePoint[]; p85: PercentilePoint[]; p97: PercentilePoint[] };
  };
}

export interface ClinicalNote {
  id: string;
  author: string | null;
  author_name: string | null;
  author_role: string | null;
  health_record: string | null;
  child: string | null;
  note_type: 'FOLLOW_UP' | 'REFERRAL' | 'OBSERVATION' | 'GENERAL';
  note_type_display: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
}

export interface HealthRecordDetail {
  id: string;
  child: string;
  child_name: string;
  measurement_date: string;
  recorded_by: string | null;
  recorded_by_name: string | null;
  zone: string | null;
  zone_name: string | null;
  weight_kg: string | null;
  height_cm: string | null;
  muac_cm: string | null;
  oedema: boolean;
  temperature_c: string | null;
  symptom_flags: string[];
  weight_for_height_z: string | null;
  height_for_age_z: string | null;
  weight_for_age_z: string | null;
  nutrition_status: string;
  nutrition_status_display: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  risk_factors: Record<string, number> | string[];
  ml_predicted_status: string | null;
  ml_confidence: string | null;
  data_source: string;
  notes: string;
  created_at: string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function getGrowthData(childId: string): Promise<GrowthData> {
  const { data } = await apiClient.get(`/growth-data/${childId}/`);
  return data.data ?? data;
}

export async function getChild(childId: string): Promise<Record<string, unknown>> {
  const { data } = await apiClient.get(`/children/${childId}/`);
  return data.data ?? data;
}

export async function getChildHistory(childId: string): Promise<HealthRecordDetail[]> {
  const { data } = await apiClient.get(`/children/${childId}/history/`);
  return data.data ?? [];
}

export async function getChildNotes(childId: string): Promise<ClinicalNote[]> {
  const { data } = await apiClient.get(`/children/${childId}/notes/`);
  return data.data ?? [];
}

export async function createChildNote(
  childId: string,
  payload: { note_type: string; content: string; is_pinned?: boolean },
): Promise<ClinicalNote> {
  const { data } = await apiClient.post(`/children/${childId}/notes/`, payload);
  return data.data;
}

export async function listHealthRecords(params?: {
  child?: string;
  risk_level?: string;
  nutrition_status?: string;
  zone?: string;
  page?: number;
  page_size?: number;
}): Promise<{ items: HealthRecordDetail[]; count: number }> {
  const { data } = await apiClient.get('/health-records/', { params });
  return {
    items: data.data ?? [],
    count: data.pagination?.count ?? (data.data?.length ?? 0),
  };
}
