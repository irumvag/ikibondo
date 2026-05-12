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

export interface ParentUser {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  role: 'PARENT';
  camp: string | null;
  is_approved: boolean;
  guardian_id: string | null;   // UUID of their linked Guardian, if any
}

export interface RegisteredChild {
  id: string;
  registration_number: string;
  full_name: string;
  guardian: string;  // guardian id
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function listCampParents(search?: string): Promise<ParentUser[]> {
  const { data } = await apiClient.get('/auth/users/', {
    params: { role: 'PARENT', ...(search ? { search } : {}) },
  });
  return data.data ?? [];
}

export async function createParentAccount(payload: {
  full_name: string;
  email: string;
  phone_number: string;
}): Promise<ParentUser> {
  const { data } = await apiClient.post('/auth/users/', { ...payload, role: 'PARENT' });
  return data.data;
}

export async function registerChild(payload: {
  full_name: string;
  date_of_birth: string;
  sex: 'M' | 'F';
  camp: string;
  zone?: string;
  notes?: string;
  birth_weight?: number | null;
  gestational_age?: number | null;
  feeding_type?: 'BREAST' | 'FORMULA' | 'MIXED' | null;
  /** Pass this instead of `guardian` when registering a second child for a parent
   *  who already has a Guardian record — skips creating a duplicate Guardian. */
  existing_guardian_id?: string;
  guardian?: {
    full_name: string;
    phone_number: string;
    relationship: string;
    national_id?: string;
  };
}): Promise<RegisteredChild & { guardian_id: string }> {
  const { data } = await apiClient.post('/children/', payload);
  const child = data.data ?? data;
  return { ...child, guardian_id: child.guardian };
}

export async function linkParentToGuardian(guardianId: string, userId: string): Promise<void> {
  await apiClient.post(`/children/guardians/${guardianId}/link-account/`, { user_id: userId });
}

export interface GuardianLookupResult {
  id: string;
  full_name: string;
  phone_number: string;
  relationship: string;
  national_id: string | null;
  has_account: boolean;
  user_email: string | null;
  children_count: number;
}

/** Look up an existing Guardian by phone number — used to prevent duplicates. */
export async function lookupGuardianByPhone(phone: string): Promise<GuardianLookupResult | null> {
  const { data } = await apiClient.get('/children/guardian-lookup/', { params: { phone } });
  return data.data ?? null;
}

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
