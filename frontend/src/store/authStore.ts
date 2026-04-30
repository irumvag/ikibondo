import { create } from 'zustand';

export type UserRole = 'CHW' | 'NURSE' | 'SUPERVISOR' | 'ADMIN' | 'PARENT';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone_number: string | null;
  camp: string | null;
  camp_name: string | null;
  is_approved: boolean;
  preferred_language: 'rw' | 'fr' | 'en';
  theme_preference: 'system' | 'light' | 'dark';
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
    }
    set({ user, accessToken, isLoading: false });
  },

  clearAuth: () => {
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      clearRoleCookie();
    }
    set({ user: null, accessToken: null, isLoading: false });
  },

  setUser: (user) => {
    setRoleCookie(user.role);
    set({ user });
  },

  setLoading: (v) => set({ isLoading: v }),
}));
