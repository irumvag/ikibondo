import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false, // JWT in Authorization header (not cookies in this impl)
});

// ── Attach access token from sessionStorage / localStorage ────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('access_token') ?? localStorage.getItem('access_token')
      : null;
  if (token && config.headers) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ── 401 → refresh + retry once ────────────────────────────────────────────
let isRefreshing = false;
let waitQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  waitQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  waitQueue = [];
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        waitQueue.push({ resolve, reject });
      }).then((token) => {
        if (original.headers) original.headers['Authorization'] = `Bearer ${token}`;
        return apiClient(original);
      });
    }

    isRefreshing = true;
    const refresh =
      typeof window !== 'undefined'
        ? sessionStorage.getItem('refresh_token') ?? localStorage.getItem('refresh_token')
        : null;

    if (!refresh) {
      processQueue(error, null);
      isRefreshing = false;
      return Promise.reject(error);
    }

    try {
      const { data } = await axios.post(`${BASE_URL}/auth/refresh/`, {
        refresh,
      });
      const newAccess: string = data.access;

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('access_token', newAccess);
        localStorage.setItem('access_token', newAccess);
      }

      processQueue(null, newAccess);
      isRefreshing = false;

      if (original.headers) original.headers['Authorization'] = `Bearer ${newAccess}`;
      return apiClient(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      isRefreshing = false;
      // Clear tokens — user must log in again
      if (typeof window !== 'undefined') {
        sessionStorage.clear();
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    }
  },
);
