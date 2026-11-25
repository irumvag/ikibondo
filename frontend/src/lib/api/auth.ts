import { apiClient } from './client';
import type { AuthUser } from '@/store/authStore';

// ── Types ───────────────────────────────────────────────────────────────────

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}

export interface RegisterPayload {
  full_name: string;
  phone_number: string;
  password: string;
  role: string;
  preferred_language: string;
  email?: string;
  camp?: string;
}

type Envelope<T> = { status: string; data: T };

function unwrap<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    return (raw as Envelope<T>).data;
  }
  return raw as T;
}

// ── API calls ────────────────────────────────────────────────────────────────

export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await apiClient.post('/auth/login/', payload);
  return unwrap<LoginResponse>(data);
}

export async function registerUser(
  payload: RegisterPayload,
): Promise<{ message: string; user?: Partial<AuthUser> }> {
  const { data } = await apiClient.post('/auth/register/', payload);
  return unwrap(data);
}

// ── Forgotten password (one-time code) ─────────────────────────────────────────

export async function requestPasswordReset(identifier: string): Promise<void> {
  await apiClient.post('/auth/password-reset/request/', { identifier });
}

export async function confirmPasswordReset(identifier: string, code: string, newPassword: string): Promise<void> {
  await apiClient.post('/auth/password-reset/confirm/', { identifier, code, new_password: newPassword });
}
