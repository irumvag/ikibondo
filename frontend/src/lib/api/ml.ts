import { apiClient } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PredictRiskPayload {
  // Core anthropometric features the model expects
  weight_kg?: number;
  height_cm?: number;
  muac_cm?: number;
  age_months?: number;
  oedema?: boolean;
  sex?: string; // 'M' | 'F'
  // Vitals
  temperature_c?: number;
  respiratory_rate?: number;
  heart_rate?: number;
  spo2?: number;
  // Z-scores (pre-computed if available)
  weight_for_height_z?: number;
  height_for_age_z?: number;
  weight_for_age_z?: number;
  // Symptom flags (1/0)
  has_fever?: number;
  has_cough?: number;
  has_diarrhea?: number;
  has_vomiting?: number;
  has_oedema?: number;
  // History features
  visit_count?: number;
  days_since_last_visit?: number;
  // Vaccination
  vaccination_coverage?: number;
  // Contextual
  [key: string]: unknown;
}

export interface PredictRiskResult {
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
  top_factors: Record<string, number>;
  model_version: string;
}

export interface ModelInfo {
  model_loaded: boolean;
  version: string;
  trained_at: string | null;
  macro_f1: number | null;
  high_recall: number | null;
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

// ── API calls ─────────────────────────────────────────────────────────────────

export async function predictRisk(features: PredictRiskPayload): Promise<PredictRiskResult> {
  const { data } = await apiClient.post('/ml/predict/', features);
  return data.data ?? data;
}

export async function getModelInfo(): Promise<ModelInfo> {
  const { data } = await apiClient.get('/ml/model-info/');
  return data.data ?? data;
}

export async function listPredictions(params?: {
  model?: string;
  limit?: number;
}): Promise<PredictionLog[]> {
  const { data } = await apiClient.get('/ml/predictions/', { params });
  return data.data ?? [];
}

// ── Helper: build feature dict from a health record / form ───────────────────

export function buildFeaturesFromRecord(record: {
  weight_kg?: string | number | null;
  height_cm?: string | number | null;
  muac_cm?: string | number | null;
  oedema?: boolean;
  temperature_c?: string | number | null;
  respiratory_rate?: number | null;
  heart_rate?: number | null;
  spo2?: number | null;
  age_months?: number;
  sex?: string;
}): PredictRiskPayload {
  const num = (v: string | number | null | undefined) =>
    v != null && v !== '' ? parseFloat(String(v)) : undefined;

  return {
    weight_kg:        num(record.weight_kg),
    height_cm:        num(record.height_cm),
    muac_cm:          num(record.muac_cm),
    oedema:           record.oedema ?? false,
    temperature_c:    num(record.temperature_c),
    respiratory_rate: record.respiratory_rate ?? undefined,
    heart_rate:       record.heart_rate ?? undefined,
    spo2:             record.spo2 ?? undefined,
    age_months:       record.age_months,
    sex:              record.sex,
  };
}
