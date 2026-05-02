import { apiClient } from './client';
import type { AuthUser } from '@/store/authStore';

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
  password: string;
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

// ── ML ────────────────────────────────────────────────────────────────────────

export interface ModelInfo {
  model_loaded: boolean;
  version: string;
  trained_at?: string;
  macro_f1?: number;
  high_recall?: number;
  n_features: number;
}

export interface PredictionLog {
  id: string;
  child_id: string;
  child_name: string;
  model_name: string;
  model_version: string;
  predicted_label: string;
  confidence: number;
  created_at: string;
}

export async function getModelInfo(): Promise<ModelInfo> {
  const { data } = await apiClient.get('/ml/model-info/');
  return data.data;
}

export async function listPredictions(params?: {
  model?: string;
  limit?: number;
}): Promise<PredictionLog[]> {
  const { data } = await apiClient.get('/ml/predictions/', { params });
  return data.data ?? [];
}
