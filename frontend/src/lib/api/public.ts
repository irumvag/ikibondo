import { apiClient } from './client';

// ── Types ───────────────────────────────────────────────────────────────────

export interface LandingStats {
  total_children: number;
  total_camps: number;
  total_chws_active: number;
  high_risk_30d: number;
  vaccination_coverage_pct: number;
  risk_distribution: { LOW: number; MEDIUM: number; HIGH: number };
  // Admin overview (GET /stats/landing/ is admin-only)
  camp_stats?: { id: string; name: string; total_children: number; high_risk: number }[];
  /** Children by their latest measurement */
  children_by_risk?: { HIGH: number; MEDIUM: number; LOW: number; NOT_MEASURED: number };
  children_by_nutrition?: { SAM: number; MAM: number; NORMAL: number; NOT_MEASURED: number };
  visits_30d?: number;
  referrals_open?: number;
  visit_requests_open?: number;
  organizations?: number;
  announcements_active?: number;
  trend?: { month: string; children_seen: number; sam: number; mam: number }[];
}

/** Public camp listing — the API returns only these fields to anonymous visitors. */
export interface Camp {
  id: string;
  name: string;
  code: string;
  district: string | null;
  /** Short public text set by an admin (Admin → Camps) */
  public_description?: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  question_rw?: string;
  answer_rw?: string;
  question_fr?: string;
  answer_fr?: string;
  order: number;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TrendPoint {
  date: string;
  high_risk: number;
  medium_risk: number;
  low_risk: number;
}

export type TrendPeriod = '7d' | '30d' | '90d';

// ── Helpers ─────────────────────────────────────────────────────────────────

type Envelope<T>    = { status: string; data: T };
type Paginated<T>   = { count: number; results: T[] };

function unwrap<T>(raw: unknown): T {
  if (raw && typeof raw === 'object') {
    if ('data' in raw)    return (raw as Envelope<T>).data;
    if ('results' in raw) return (raw as unknown as Paginated<T>).results as unknown as T;
  }
  return raw as T;
}

// ── API calls ────────────────────────────────────────────────────────────────

export async function getLandingStats(): Promise<LandingStats> {
  const { data } = await apiClient.get('/stats/landing/');
  return unwrap<LandingStats>(data);
}

export async function getStatsTrend(period: TrendPeriod = '30d'): Promise<TrendPoint[]> {
  const { data } = await apiClient.get('/stats/trend/', { params: { period } });
  return unwrap<TrendPoint[]>(data) ?? [];
}

export async function listFaqByLang(lang: 'en' | 'rw' | 'fr' = 'en'): Promise<FAQItem[]> {
  const { data } = await apiClient.get('/faq/', { params: lang !== 'en' ? { lang } : {} });
  const payload = unwrap<FAQItem[] | { results: FAQItem[] }>(data);
  if (Array.isArray(payload)) return payload;
  if (payload && 'results' in payload) return payload.results;
  return [];
}

export async function getPublicCamps(): Promise<Camp[]> {
  const { data } = await apiClient.get('/camps/');
  const payload = unwrap<Camp[] | Camp>(data);
  return Array.isArray(payload) ? payload : [payload];
}

export async function listFaq(): Promise<FAQItem[]> {
  const { data } = await apiClient.get('/faq/');
  const payload = unwrap<FAQItem[] | { results: FAQItem[] }>(data);
  if (Array.isArray(payload)) return payload;
  if (payload && 'results' in payload) return payload.results;
  return [];
}
