'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Moon, Sun, SunMoon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from './ThemeProvider';
import type { Theme } from '@/lib/theme';

const OPTIONS: { value: Theme; icon: typeof Sun }[] = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: SunMoon },
];

/** Theme switch: one round button showing the current choice, a small labelled menu on click. */
export function ThemeToggle() {
  const t = useTranslations('theme');
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[2];
  const Icon = current.icon;

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('current', { name: t(current.value) })}
        title={t('current', { name: t(current.value) })}
        className="flex items-center justify-center w-9 h-9 rounded-full border transition-colors hover:bg-[var(--bg-sand)]"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
      >
        {/* Keyed so the icon spins in when the theme changes */}
        <Icon key={theme} size={17} className="theme-icon-in" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('title')}
          className="absolute right-0 mt-2 w-60 rounded-2xl border p-1.5 z-50 animate-pop"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', boxShadow: 'var(--shadow-lg)' }}
        >
          <p className="px-2.5 pt-1.5 pb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            {t('title')}
          </p>
          {OPTIONS.map((opt) => {
            const OptIcon = opt.icon;
            const selected = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => { setTheme(opt.value); setOpen(false); }}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors hover:bg-[var(--bg-sand)]"
                style={{ backgroundColor: selected ? 'var(--bg-sand)' : undefined }}
              >
                <span
                  className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                  style={{ backgroundColor: selected ? 'var(--ink)' : 'var(--bg-sand)', color: selected ? 'var(--bg-elev)' : 'var(--ink)' }}
                >
                  <OptIcon size={16} aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t(opt.value)}</span>
                  <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>{t(`${opt.value}Hint`)}</span>
                </span>
                {selected && <Check size={16} style={{ color: 'var(--ink)' }} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
