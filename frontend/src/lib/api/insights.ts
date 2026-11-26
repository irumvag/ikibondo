import { apiClient } from './client';

/** A count; `value` is null when it is hidden because it is small enough to identify a child. */
export interface Cell { value: number | null; suppressed: boolean }

/** A rate (%) with the level partners judge it by; value null = too few children to show. */
export interface Indicator {
  value: number | null;
  band: string | null;
  level: 'good' | 'watch' | 'alert' | null;
  /** Name and explanation, editable by an admin (Admin → Indicators) */
  label: string;
  benchmark: string;
  target: number | null;
}

export const INDICATOR_KEYS = [
  'gam_rate', 'sam_rate', 'stunting_rate', 'underweight_rate', 'screening_coverage',
  'measles_coverage', 'penta3_coverage', 'penta_dropout', 'referral_completion',
] as const;
export type IndicatorKey = (typeof INDICATOR_KEYS)[number];

export interface CampStats {
  children: Cell; sam: Cell; mam: Cell; normal: Cell; not_measured: Cell; high_risk: Cell;
  acute_malnutrition_rate: number | null;
  vaccination_coverage: number | null;
  visits_30d: Cell; referrals_open: Cell;
  indicators?: Record<IndicatorKey, Indicator> & { children_6_59m: Cell; measured_6_59m: Cell };
}

export interface InsightsOverview {
  generated_on: string;
  min_cell: number;
  camps: (CampStats & { id: string; name: string; district: string })[];
  total: CampStats | null;
  trend: { month: string; children_seen: Cell; sam: Cell; mam: Cell }[];
}

export async function getInsights(camp?: string): Promise<InsightsOverview> {
  const { data } = await apiClient.get('/insights/overview/', { params: camp ? { camp } : {} });
  return data.data;
}

/** Downloads the CSV through the authenticated client and saves it. */
export async function downloadInsightsCsv(camp?: string): Promise<void> {
  const res = await apiClient.get('/insights/export/', { params: camp ? { camp } : {}, responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ikibondo-statistics-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function cellText(c: Cell | undefined, min = 5): string {
  if (!c) return '—';
  return c.suppressed ? `<${min}` : (c.value ?? 0).toLocaleString();
}

/** Admin: indicator settings (name, target, benchmark text). */
export interface IndicatorSetting {
  key: IndicatorKey;
  kind: 'wasting' | 'stunting' | 'target' | 'info';
  higher_is_better: boolean;
  default: { label: string; target: number | null; benchmark: string };
  current: { label: string; target: number | null; benchmark: string };
  edited: boolean;
}

export async function listIndicatorSettings(): Promise<IndicatorSetting[]> {
  const { data } = await apiClient.get('/insights/indicators/');
  return data.data;
}

export async function saveIndicatorSetting(key: string, body: { label: string; target: number | null; benchmark: string }) {
  await apiClient.put(`/insights/indicators/${key}/`, body);
}

export async function resetIndicatorSetting(key: string) {
  await apiClient.delete(`/insights/indicators/${key}/`);
}
