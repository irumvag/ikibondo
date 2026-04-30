'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import type { Theme } from '@/lib/theme';

const OPTIONS: { value: Theme; icon: React.ReactNode; label: string }[] = [
  { value: 'system', icon: <Monitor size={16} />, label: 'System' },
  { value: 'light',  icon: <Sun size={16} />,     label: 'Light'  },
  { value: 'dark',   icon: <Moon size={16} />,    label: 'Dark'   },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Theme selector"
      className="flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--bg-sand)] p-0.5"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          aria-label={opt.label}
          aria-pressed={theme === opt.value}
          title={opt.label}
          className={[
            'flex items-center justify-center w-8 h-8 rounded-full transition-colors',
            theme === opt.value
              ? 'bg-[var(--ink)] text-[var(--bg)] shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]',
          ].join(' ')}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}
