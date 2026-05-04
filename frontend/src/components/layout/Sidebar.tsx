'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, MapPin, ScrollText, Cpu,
  AlertTriangle, Activity, Baby, FileBarChart, ClipboardList,
  UserPlus, Stethoscope, Syringe, RefreshCw,
  Heart, Bell, X, LogOut, Settings, MessageCircleQuestion,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore, type UserRole } from '@/store/authStore';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ROLE_NAV: Record<UserRole, NavItem[]> = {
  ADMIN: [
    { href: '/admin',          label: 'Overview',     icon: LayoutDashboard },
    { href: '/admin/users',    label: 'Users',         icon: Users },
    { href: '/admin/camps',    label: 'Camps & Zones', icon: MapPin },
    { href: '/admin/audit',    label: 'Audit Log',     icon: ScrollText },
    { href: '/admin/ml',       label: 'ML Model',      icon: Cpu },
    { href: '/admin/faq',      label: 'FAQ',            icon: MessageCircleQuestion },
    { href: '/notifications',  label: 'Notifications', icon: Bell },
  ],
  SUPERVISOR: [
    { href: '/supervisor',          label: 'Zone Overview',     icon: LayoutDashboard },
    { href: '/supervisor/alerts',   label: 'High-Risk Alerts',  icon: AlertTriangle },
    { href: '/supervisor/chws',     label: 'CHW Activity',      icon: Activity },
    { href: '/supervisor/children', label: 'Children',          icon: Baby },
    { href: '/supervisor/reports',  label: 'Reports',           icon: FileBarChart },
    { href: '/supervisor/users',    label: 'Camp staff',        icon: Users },
    { href: '/notifications',       label: 'Notifications',     icon: Bell },
  ],
  NURSE: [
    { href: '/nurse',          label: 'Overview',       icon: LayoutDashboard },
    { href: '/nurse/children', label: 'Children',       icon: Baby },
    { href: '/nurse/records',  label: 'Health Records', icon: ClipboardList },
    { href: '/notifications',  label: 'Notifications',  icon: Bell },
  ],
  CHW: [
    { href: '/chw',           label: 'My Caseload',       icon: LayoutDashboard },
    { href: '/chw/register',  label: 'Register Child',    icon: UserPlus },
    { href: '/chw/visit',     label: 'New Visit',         icon: Stethoscope },
    { href: '/chw/vaccines',  label: 'Vaccination Queue', icon: Syringe },
    { href: '/chw/sync',      label: 'Sync Queue',        icon: RefreshCw },
    { href: '/notifications', label: 'Notifications',     icon: Bell },
  ],
  PARENT: [
    { href: '/parent',               label: 'My Children',     icon: Heart },
    { href: '/parent/vaccines',      label: 'Vaccination Card', icon: Syringe },
    { href: '/parent/notifications', label: 'Notifications',   icon: Bell },
  ],
};

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN:      'Administrator',
  SUPERVISOR: 'Zone Supervisor',
  NURSE:      'Nurse',
  CHW:        'Community Health Worker',
  PARENT:     'Parent / Guardian',
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  const nav = user ? (ROLE_NAV[user.role] ?? []) : [];

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  // Initials avatar
  const initials = user?.full_name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() ?? '?';

  const sidebarContent = (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: 'var(--bg-elev)' }}
    >
      {/* Logo row */}
      <div
        className="flex items-center justify-between px-5 h-14 shrink-0 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <span
          className="text-xl font-bold tracking-tight"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Ikibondo
        </span>
        {/* Close button — mobile only */}
        <button
          type="button"
          className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--bg-sand)]"
          onClick={onClose}
          aria-label="Close navigation"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Dashboard navigation">
        <ul className="flex flex-col gap-0.5">
          {nav.map(({ href, label, icon: Icon }) => {
            // Match exact for root pages, prefix for nested
            const isRoot = href === `/${href.split('/')[1]}`;
            const active = isRoot ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onClose}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    active
                      ? 'text-[var(--ink)] bg-[var(--bg-sand)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-sand)]',
                  ].join(' ')}
                >
                  <Icon
                    size={18}
                    aria-hidden="true"
                    style={{ color: active ? 'var(--ink)' : 'var(--text-muted)' }}
                  />
                  {label}
                  {/* Active indicator dot */}
                  {active && (
                    <span
                      className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: 'var(--ink)' }}
                      aria-hidden="true"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div
        className="px-3 py-4 border-t shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3 px-2 mb-2">
          {/* Avatar */}
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold select-none"
            style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--ink)' }}
            >
              {user?.full_name ?? '—'}
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {user ? ROLE_LABEL[user.role] : '—'}
            </p>
          </div>
        </div>

        <Link
          href="/profile"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-[var(--bg-sand)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <Settings size={16} aria-hidden="true" />
          Profile &amp; settings
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-[var(--high-bg)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <LogOut size={16} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop — always visible */}
      <aside
        className="hidden lg:flex flex-col w-60 shrink-0 border-r h-screen sticky top-0"
        style={{ borderColor: 'var(--border)' }}
        aria-label="Sidebar"
      >
        {sidebarContent}
      </aside>

      {/* Mobile — off-canvas overlay */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30 lg:hidden"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Drawer */}
          <aside
            className="fixed inset-y-0 left-0 z-40 w-72 shadow-xl lg:hidden flex flex-col border-r"
            style={{ borderColor: 'var(--border)' }}
            aria-label="Sidebar"
          >
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
