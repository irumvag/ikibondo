'use client';

import { useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import type { Theme } from '@/lib/theme';

const OPTIONS: { value: Theme; icon: React.ReactNode; label: string }[] = [
  { value: 'system', icon: <Monitor size={15} />, label: 'System' },
  { value: 'light',  icon: <Sun    size={15} />, label: 'Light'  },
  { value: 'dark',   icon: <Moon   size={15} />, label: 'Dark'   },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const active = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[0];

  return (
    <div
      role="group"
      aria-label="Theme selector"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}
      className="flex items-center gap-0.5 rounded-full border p-0.5 overflow-hidden"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--bg-sand)',
        maxWidth: open ? '7rem' : '2.25rem',
        transition: 'max-width 0.2s ease',
      }}
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          aria-label={opt.label}
          aria-pressed={theme === opt.value}
          title={opt.label}
          tabIndex={open || opt.value === theme ? 0 : -1}
          className={[
            'flex items-center justify-center w-7 h-7 rounded-full transition-colors shrink-0',
            theme === opt.value
              ? 'bg-[var(--ink)] text-[var(--bg)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]',
          ].join(' ')}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}
