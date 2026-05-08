import { create } from 'zustand';

export type UserRole = 'CHW' | 'NURSE' | 'SUPERVISOR' | 'ADMIN' | 'PARENT';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone_number: string | null;
  national_id?: string | null;
  camp: string | null;
  camp_name: string | null;
  is_approved: boolean;
  must_change_password: boolean;
  preferred_language: 'rw' | 'fr' | 'en';
  theme_preference: 'system' | 'light' | 'dark';
  onboarded_at: string | null;
  notification_prefs?: Record<string, unknown>;
  has_guardian_record?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  setUser: (user: AuthUser) => void;
  setLoading: (v: boolean) => void;
}

function setRoleCookie(role: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `_ikibondo_role=${role}; path=/; SameSite=Strict`;
}

function clearRoleCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = '_ikibondo_role=; path=/; max-age=0';
}

function setMustChangePwCookie(value: boolean) {
  if (typeof document === 'undefined') return;
  document.cookie = `_ikibondo_must_change_pw=${value ? '1' : '0'}; path=/; SameSite=Strict`;
}

function clearMustChangePwCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = '_ikibondo_must_change_pw=; path=/; max-age=0';
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoading: true,

  setAuth: (user, accessToken, refreshToken) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('access_token', accessToken);
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      setRoleCookie(user.role);
      setMustChangePwCookie(user.must_change_password ?? false);
    }
    set({ user, accessToken, isLoading: false });
  },

  clearAuth: () => {
    if (typeof window !== 'undefined') {
      // Notify the service worker to clear its cache so that a subsequent user
      // on the same shared device cannot access previously cached health data.
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'LOGOUT' });
      }
      sessionStorage.clear();
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      clearRoleCookie();
      clearMustChangePwCookie();
    }
    set({ user: null, accessToken: null, isLoading: false });
  },

  setUser: (user) => {
    setRoleCookie(user.role);
    setMustChangePwCookie(user.must_change_password ?? false);
    set({ user });
  },

  setLoading: (v) => set({ isLoading: v }),
}));
