import { apiClient } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ZoneStats {
  zone_id: string;
  zone_name: string;
  total_children: number;
  risk_distribution: { LOW: number; MEDIUM: number; HIGH: number; UNKNOWN: number };
  vaccination_coverage_pct: number;
  active_chws: number;
  inactive_chws: number;
  visits_this_week: number;
  children_never_visited: number;
}

export interface CHWActivity {
  user_id: string;
  full_name: string;
  phone_number: string | null;
  last_visit_at: string | null;
  visits_7d: number;
  visits_30d: number;
  status: 'active' | 'inactive';
}

export interface HealthRecord {
  id: string;
  child: string;
  child_name: string;
  measurement_date: string;
  zone: string | null;
  zone_name: string | null;
  weight_kg: string | null;
  height_cm: string | null;
  muac_cm: string | null;
  nutrition_status: string;
  nutrition_status_display: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  risk_factors: string[];
  ml_confidence: string | null;
}

export interface SupervisedChild {
  id: string;
  registration_number: string;
  full_name: string;
  date_of_birth: string;
  age_months: number;
  age_display: string;
  sex: 'M' | 'F';
  camp: string;
  camp_name: string;
  zone: string | null;
  zone_name: string | null;
  guardian: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  risk_level?: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  closure_status?: string | null;
  deletion_requested_at?: string | null;
}

export interface Paginated<T> {
  items: T[];
  count: number;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function getZoneStats(campId: string, zoneId: string): Promise<ZoneStats> {
  const { data } = await apiClient.get(`/camps/${campId}/zones/${zoneId}/stats/`);
  return data.data;
}

export async function getCHWActivity(campId: string, zoneId: string): Promise<CHWActivity[]> {
  const { data } = await apiClient.get(`/camps/${campId}/zones/${zoneId}/chw-activity/`);
  return data.data ?? [];
}

export async function listHighRiskRecords(params?: {
  zone?: string;
  page?: number;
  page_size?: number;
}): Promise<Paginated<HealthRecord>> {
  const { data } = await apiClient.get('/health-records/', {
    params: { risk_level: 'HIGH', ...params },
  });
  return {
    items: data.data ?? [],
    count: data.pagination?.count ?? (data.data?.length ?? 0),
  };
}

export async function listCampChildren(params?: {
  camp?: string;
  status?: string;
  sex?: string;
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<Paginated<SupervisedChild>> {
  const { data } = await apiClient.get('/children/', { params });
  // Handle both custom success_response format and standard DRF pagination format
  const items = data.data ?? data.results ?? [];
  const count = data.pagination?.count ?? data.count ?? items.length;
  return { items, count };
}
