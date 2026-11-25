'use client';

import { useState } from 'react';
import { Globe } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { patchMe } from '@/lib/api/user';

const LANGUAGES = [
  { code: 'rw', label: 'Kinyarwanda', short: 'RW' },
  { code: 'fr', label: 'Français',    short: 'FR' },
  { code: 'en', label: 'English',     short: 'EN' },
] as const;

type LangCode = (typeof LANGUAGES)[number]['code'];

export function LanguageSwitcher() {
  const { user, setUser } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const current = LANGUAGES.find((l) => l.code === (user?.preferred_language ?? 'en'));

  const handleSelect = async (code: LangCode) => {
    setOpen(false);
    if (!user || user.preferred_language === code || saving) return;
    setSaving(true);
    try {
      const updated = await patchMe({ preferred_language: code });
      setUser(updated);
    } catch {
      // Silently ignore — language will revert on next page load
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Change language"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2.5 h-9 rounded-xl text-sm font-medium transition-colors hover:bg-[var(--bg-sand)]"
        style={{ color: 'var(--ink)' }}
        disabled={saving}
      >
        <Globe size={15} aria-hidden="true" />
        <span aria-hidden="true">{current?.short ?? 'EN'}</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute right-0 top-full mt-2 w-40 rounded-xl overflow-hidden z-50"
            style={{
              backgroundColor: 'var(--bg-elev)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-md)',
            }}
            role="listbox"
            aria-label="Language selection"
          >
            {LANGUAGES.map((lang) => {
              const active = lang.code === user?.preferred_language;
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => handleSelect(lang.code)}
                  className={[
                    'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors',
                    active
                      ? 'bg-[var(--bg-sand)] font-semibold'
                      : 'hover:bg-[var(--bg-sand)] font-normal',
                  ].join(' ')}
                  style={{ color: 'var(--ink)' }}
                >
                  {active && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: 'var(--success)' }}
                      aria-hidden="true"
                    />
                  )}
                  {!active && <span className="w-1.5" />}
                  {lang.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
