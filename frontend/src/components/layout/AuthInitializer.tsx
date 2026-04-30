'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { getMe } from '@/lib/api/user';

/**
 * Hydrates the auth store from localStorage on first mount.
 * Renders a full-screen loading indicator while verifying the session,
 * then falls back to /login if the token is absent or expired.
 */
export function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { user, isLoading, setUser, setLoading, clearAuth } = useAuthStore();
  const router = useRouter();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const token =
      typeof window !== 'undefined'
        ? sessionStorage.getItem('access_token') ?? localStorage.getItem('access_token')
        : null;

    if (!token) {
      clearAuth();
      router.replace('/login');
      return;
    }

    getMe()
      .then((me) => setUser(me))
      .catch(() => {
        clearAuth();
        router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [clearAuth, router, setLoading, setUser]);

  // Full-screen spinner while hydrating
  if (isLoading && !user) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg)' }}
        aria-live="polite"
        aria-label="Loading your dashboard"
      >
        <div className="flex flex-col items-center gap-4">
          {/* Spinning ring */}
          <svg
            className="animate-spin"
            width="40"
            height="40"
            viewBox="0 0 40 40"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="20" cy="20" r="16" stroke="var(--border)" strokeWidth="4" />
            <path
              d="M20 4 a16 16 0 0 1 16 16"
              stroke="var(--ink)"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Loading…
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
