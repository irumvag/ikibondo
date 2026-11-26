'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { LOCALE_COOKIE } from '@/i18n/config';

/**
 * Keeps the rendered language in step with the signed-in account's
 * preferred_language (set from the language switcher or the profile page).
 * The server reads the cookie, so a change only needs a refresh.
 */
export function LocaleSync() {
  const preferred = useAuthStore((s) => s.user?.preferred_language);
  const router = useRouter();

  useEffect(() => {
    if (!preferred) return;
    const saved = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`))?.[1];
    if (saved === preferred) return;
    document.cookie = `${LOCALE_COOKIE}=${preferred}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [preferred, router]);

  return null;
}
