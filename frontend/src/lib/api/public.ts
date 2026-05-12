import { apiClient } from './client';

// ── Types ───────────────────────────────────────────────────────────────────

export interface LandingStats {
  total_children: number;
  total_camps: number;
  total_chws_active: number;
  high_risk_30d: number;
  vaccination_coverage_pct: number;
  risk_distribution: { LOW: number; MEDIUM: number; HIGH: number };
}

export interface Camp {
  id: string;
  name: string;
  code: string;
  district: string | null;
  country: string;
  status: string;
  estimated_population: number | null;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  order: number;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
}

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
