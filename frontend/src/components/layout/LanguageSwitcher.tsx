'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Globe } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { patchMe } from '@/lib/api/user';
import { LOCALE_COOKIE } from '@/i18n/config';

// Each language is shown in its own name, so people find theirs whatever is on screen
const LANGUAGES = [
  { code: 'rw', label: 'Kinyarwanda', short: 'RW' },
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'en', label: 'English', short: 'EN' },
] as const;

type LangCode = (typeof LANGUAGES)[number]['code'];

/** The server renders in the language this cookie names (src/i18n/request.ts). */
function saveLocale(code: LangCode) {
  document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Language menu for every page, signed in or not. The choice is kept in a
 * cookie (the server renders from it) and, when signed in, saved to the account.
 */
export function LanguageSwitcher({ withLabel = false }: { withLabel?: boolean }) {
  const t = useTranslations('language');
  const locale = useLocale();
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const current = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[2];

  const handleSelect = async (code: LangCode) => {
    setOpen(false);
    if (code === locale) return;
    saveLocale(code);
    if (user && user.preferred_language !== code) {
      try {
        setUser(await patchMe({ preferred_language: code }));
      } catch {
        // The cookie still switches this browser; the account keeps its old choice
      }
    }
    startTransition(() => router.refresh());
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('change', { name: current.label })}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={pending}
        className="flex items-center gap-1.5 px-2.5 h-9 rounded-full border text-sm font-semibold transition-colors hover:bg-[var(--bg-sand)] disabled:opacity-60"
        style={{ color: 'var(--ink)', borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        <Globe size={15} aria-hidden="true" className={pending ? 'animate-spin' : undefined} />
        <span aria-hidden="true">{withLabel ? current.label : current.short}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            className="absolute right-0 top-full mt-2 w-48 rounded-2xl border p-1.5 z-50 animate-pop"
            style={{ backgroundColor: 'var(--bg-elev)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-lg)' }}
            role="listbox"
            aria-label={t('title')}
          >
            <p className="px-2.5 pt-1.5 pb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              {t('title')}
            </p>
            {LANGUAGES.map((lang) => {
              const active = lang.code === locale;
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="option"
                  lang={lang.code}
                  aria-selected={active}
                  onClick={() => handleSelect(lang.code)}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm text-left transition-colors hover:bg-[var(--bg-sand)]"
                  style={{ color: 'var(--ink)', backgroundColor: active ? 'var(--bg-sand)' : undefined, fontWeight: active ? 600 : 400 }}
                >
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{ backgroundColor: active ? 'var(--ink)' : 'var(--bg-sand)', color: active ? 'var(--bg-elev)' : 'var(--ink)' }}>
                    {lang.short}
                  </span>
                  <span className="flex-1">{lang.label}</span>
                  {active && <Check size={15} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
