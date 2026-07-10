import { beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal browser-storage stubs so the store's window guards take the
// browser path in a node test environment.
class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'> {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

const localStorageStub = new MemoryStorage();
const sessionStorageStub = new MemoryStorage();
// Browser semantics: assigning document.cookie appends/updates one cookie.
let cookieJar: string[] = [];

vi.stubGlobal('window', {});
vi.stubGlobal('localStorage', localStorageStub);
vi.stubGlobal('sessionStorage', sessionStorageStub);
vi.stubGlobal('navigator', {});
vi.stubGlobal('document', {
  get cookie() { return cookieJar.join('; '); },
  set cookie(v: string) { cookieJar.push(v); },
});

const { useAuthStore } = await import('./authStore');
type AuthUser = import('./authStore').AuthUser;

const user: AuthUser = {
  id: 'u-1',
  email: 'nurse@example.com',
  full_name: 'Michelle Rojas',
  role: 'NURSE',
  phone_number: null,
  camp: 'camp-1',
  camp_name: 'Mahama',
  is_approved: true,
  must_change_password: false,
  preferred_language: 'en',
  theme_preference: 'system',
  onboarded_at: '2026-01-01T00:00:00Z',
};

describe('authStore', () => {
  beforeEach(() => {
    localStorageStub.clear();
    sessionStorageStub.clear();
    useAuthStore.getState().clearAuth();
    cookieJar = [];
  });

  it('setAuth stores user, token, and persists tokens to localStorage only', () => {
    useAuthStore.getState().setAuth(user, 'access-123', 'refresh-456');

    const s = useAuthStore.getState();
    expect(s.user?.role).toBe('NURSE');
    expect(s.accessToken).toBe('access-123');
    expect(s.isLoading).toBe(false);

    expect(localStorageStub.getItem('access_token')).toBe('access-123');
    expect(localStorageStub.getItem('refresh_token')).toBe('refresh-456');
    // Single source of truth: no duplicate copy in sessionStorage.
    expect(sessionStorageStub.getItem('access_token')).toBeNull();
  });

  it('setAuth sets the role cookie the proxy route guard reads', () => {
    useAuthStore.getState().setAuth(user, 'a', 'r');
    expect(cookieJar.join("; ")).toContain('_ikibondo_role=NURSE');
  });

  it('clearAuth wipes tokens, cookies, and state', () => {
    useAuthStore.getState().setAuth(user, 'a', 'r');
    useAuthStore.getState().clearAuth();

    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.accessToken).toBeNull();
    expect(localStorageStub.getItem('access_token')).toBeNull();
    expect(localStorageStub.getItem('refresh_token')).toBeNull();
    expect(cookieJar.join("; ")).toContain('max-age=0');
  });

  it('setUser refreshes the must-change-password cookie', () => {
    useAuthStore.getState().setUser({ ...user, must_change_password: true });
    expect(cookieJar.join("; ")).toContain('_ikibondo_must_change_pw=1');
  });
});
