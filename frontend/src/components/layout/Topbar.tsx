'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Menu, WifiOff, RefreshCw } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { NotificationBell } from './NotificationBell';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useAuthStore } from '@/store/authStore';
import { useSyncStore } from '@/store/syncStore';

// Map route prefixes → readable page titles
const PAGE_TITLES: Record<string, string> = {
  '/admin/users':          'Users',
  '/admin/camps':          'Camps & Zones',
  '/admin/audit':          'Audit Log',
  '/admin/ml':             'ML Model',
  '/admin/faq':            'FAQ Management',
  '/admin':                'Overview',
  '/supervisor/alerts':    'High-Risk Alerts',
  '/supervisor/chws':      'CHW Activity',
  '/supervisor/children':  'Children',
  '/supervisor/reports':   'Reports',
  '/supervisor/users':     'Camp staff',
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
  '/profile':              'Profile',
  '/notifications':        'Notifications',
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
  const pendingCount = useSyncStore((s) => s.pending.length);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

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
        {/* Sync / offline indicator */}
        {!isOnline ? (
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
            <WifiOff className="h-3 w-3" />
            Offline
          </div>
        ) : pendingCount > 0 ? (
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium" title={`${pendingCount} pending · Last sync ${lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : 'never'}`}>
            <RefreshCw className="h-3 w-3 animate-spin" />
            {pendingCount} pending
          </div>
        ) : null}

        <LanguageSwitcher />
        <NotificationBell />
        <ThemeToggle />

        {/* User avatar — links to profile */}
        <Link href="/profile" className="flex items-center gap-2 ml-1" aria-label="Go to profile">
          <span className="hidden md:block text-sm font-medium" style={{ color: 'var(--ink)' }}>
            {user?.full_name?.split(' ')[0]}
          </span>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold select-none"
            style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
            title={user?.full_name}
          >
            {initials}
          </div>
        </Link>
      </div>
    </header>
  );
}
