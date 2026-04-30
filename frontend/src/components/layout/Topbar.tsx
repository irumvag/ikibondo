'use client';

import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { NotificationBell } from './NotificationBell';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useAuthStore } from '@/store/authStore';

// Map route prefixes → readable page titles
const PAGE_TITLES: Record<string, string> = {
  '/admin/users':          'Users',
  '/admin/camps':          'Camps & Zones',
  '/admin/audit':          'Audit Log',
  '/admin/ml':             'ML Model',
  '/admin':                'Overview',
  '/supervisor/alerts':    'High-Risk Alerts',
  '/supervisor/chws':      'CHW Activity',
  '/supervisor/children':  'Children',
  '/supervisor/reports':   'Reports',
  '/supervisor':           'Zone Overview',
  '/nurse/children':       'Children',
  '/nurse/records':        'Health Records',
  '/nurse':                'Overview',
  '/chw/register':         'Register Child',
  '/chw/visit':            'New Visit',
  '/chw/vaccines':         'Vaccination Queue',
  '/chw/sync':             'Sync Queue',
  '/chw':                  'My Caseload',
  '/parent/vaccines':      'Vaccination Card',
  '/parent/notifications': 'Notifications',
  '/parent':               'My Children',
};

function getPageTitle(pathname: string) {
  // Sort by length descending so more-specific routes match first
  const sorted = Object.entries(PAGE_TITLES).sort(
    ([a], [b]) => b.length - a.length,
  );
  for (const [prefix, title] of sorted) {
    if (pathname.startsWith(prefix)) return title;
  }
  return 'Dashboard';
}

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const title = getPageTitle(pathname);

  const initials = user?.full_name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() ?? '?';

  return (
    <header
      className="shrink-0 z-20 flex items-center h-14 px-4 sm:px-6 gap-3 border-b"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--bg) 96%, transparent)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Hamburger — mobile only */}
      <button
        type="button"
        onClick={onMenuClick}
        className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl transition-colors hover:bg-[var(--bg-sand)]"
        style={{ color: 'var(--ink)' }}
        aria-label="Toggle navigation"
      >
        <Menu size={18} aria-hidden="true" />
      </button>

      {/* Page title */}
      <h1
        className="flex-1 text-base font-semibold truncate"
        style={{ color: 'var(--ink)' }}
      >
        {title}
      </h1>

      {/* Right controls */}
      <div className="flex items-center gap-1">
        <LanguageSwitcher />
        <NotificationBell />
        <ThemeToggle />

        {/* User avatar — decorative, sidebar has full info */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold select-none ml-1"
          style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
          aria-hidden="true"
          title={user?.full_name}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
