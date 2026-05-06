'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, MapPin, ScrollText, Cpu,
  AlertTriangle, Activity, Baby, FileBarChart, ClipboardList,
  UserPlus, Stethoscope, Syringe, RefreshCw, Heart, Bell,
  X, LogOut, Settings, MessageCircleQuestion, ChevronDown,
  ChevronRight, PanelLeftClose, PanelLeftOpen, BarChart2,
  Inbox, GitBranch, Calendar, Bluetooth, ShieldCheck,
  Globe, ClipboardCheck, Megaphone, FlaskConical,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore, type UserRole } from '@/store/authStore';

// ── Types ────────────────────────────────────────────────────────────────────

interface NavLeaf {
  kind?: 'leaf';
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

interface NavGroup {
  kind: 'group';
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavLeaf[];
}

type NavEntry = NavLeaf | NavGroup;

// ── Role navigation definitions ───────────────────────────────────────────────

const ROLE_NAV: Record<UserRole, NavEntry[]> = {
  ADMIN: [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard },
    {
      kind: 'group', id: 'admin-mgmt', label: 'Management', icon: Users,
      items: [
        { href: '/admin/users',        label: 'Users',        icon: Users },
        { href: '/admin/camps',        label: 'Camps & Zones', icon: MapPin },
        { href: '/admin/vaccinations', label: 'Vaccines',     icon: Syringe },
        { href: '/admin/guardians',    label: 'Guardians',    icon: Heart },
      ],
    },
    {
      kind: 'group', id: 'admin-intel', label: 'Intelligence', icon: Cpu,
      items: [
        { href: '/admin/ml',            label: 'ML Models',   icon: Cpu },
        { href: '/admin/audit',         label: 'Audit Log',   icon: ScrollText },
        { href: '/admin/logs',          label: 'System Logs', icon: ClipboardList },
        { href: '/admin/dhis2',         label: 'DHIS2 Sync',  icon: Globe },
      ],
    },
    { href: '/admin/broadcasts',  label: 'Broadcast',    icon: Megaphone },
    { href: '/admin/faq',         label: 'FAQ',           icon: MessageCircleQuestion },
    { href: '/notifications',     label: 'Notifications', icon: Bell },
  ],

  SUPERVISOR: [
    { href: '/supervisor', label: 'Overview', icon: LayoutDashboard },
    {
      kind: 'group', id: 'sup-analytics', label: 'Analytics', icon: BarChart2,
      items: [
        { href: '/supervisor/analytics',    label: 'Dashboard',    icon: BarChart2 },
        { href: '/supervisor/reports',      label: 'Reports',      icon: FileBarChart },
        { href: '/supervisor/ai-oversight', label: 'AI Oversight', icon: FlaskConical },
      ],
    },
    {
      kind: 'group', id: 'sup-field', label: 'Field', icon: MapPin,
      items: [
        { href: '/supervisor/children', label: 'Children',        icon: Baby },
        { href: '/supervisor/zones',    label: 'Zones',            icon: MapPin },
        { href: '/supervisor/chws',     label: 'CHW Activity',     icon: Activity },
        { href: '/supervisor/alerts',   label: 'High-Risk Alerts', icon: AlertTriangle },
      ],
    },
    { href: '/supervisor/staff',     label: 'Staff',          icon: Users },
    { href: '/supervisor/users',     label: 'Approvals',      icon: ShieldCheck },
    { href: '/supervisor/broadcast', label: 'Broadcast',      icon: Megaphone },
    { href: '/notifications',        label: 'Notifications',  icon: Bell },
  ],

  NURSE: [
    { href: '/nurse', label: 'Overview', icon: LayoutDashboard },
    {
      kind: 'group', id: 'nurse-clinical', label: 'Clinical', icon: Stethoscope,
      items: [
        { href: '/nurse/children',         label: 'Children',        icon: Baby },
        { href: '/nurse/records',          label: 'Health Records',   icon: ClipboardList },
        { href: '/nurse/register',         label: 'Register Child',   icon: UserPlus },
        { href: '/nurse/vaccines',         label: 'Vaccinations',     icon: Syringe },
        { href: '/nurse/vaccines/session', label: 'Clinic Session',   icon: Calendar },
      ],
    },
    {
      kind: 'group', id: 'nurse-comms', label: 'Communication', icon: Inbox,
      items: [
        { href: '/nurse/inbox',    label: 'CHW Inbox',  icon: Inbox },
        { href: '/nurse/referrals', label: 'Referrals', icon: GitBranch },
      ],
    },
    { href: '/nurse/approvals', label: 'Approvals',     icon: ShieldCheck },
    { href: '/notifications',   label: 'Notifications', icon: Bell },
  ],

  CHW: [
    { href: '/chw/today',   label: 'Today',       icon: Calendar },
    { href: '/chw',         label: 'My Caseload',  icon: LayoutDashboard },
    {
      kind: 'group', id: 'chw-field', label: 'Field', icon: Stethoscope,
      items: [
        { href: '/chw/visit',     label: 'New Visit',       icon: Stethoscope },
        { href: '/chw/requests',  label: 'Visit Requests',  icon: ClipboardCheck },
        { href: '/chw/vaccines',  label: 'Vaccine Queue',   icon: Syringe },
      ],
    },
    {
      kind: 'group', id: 'chw-consult', label: 'Consult', icon: Inbox,
      items: [
        { href: '/chw/consultations', label: 'Ask Nurse',  icon: Inbox },
        { href: '/chw/referrals',     label: 'Referrals',  icon: GitBranch },
      ],
    },
    {
      kind: 'group', id: 'chw-settings', label: 'Settings', icon: Settings,
      items: [
        { href: '/chw/sync',            label: 'Sync Queue',  icon: RefreshCw },
        { href: '/chw/settings/devices', label: 'BLE Devices', icon: Bluetooth },
      ],
    },
    { href: '/notifications', label: 'Notifications', icon: Bell },
  ],

  PARENT: [
    { href: '/parent',               label: 'My Children',      icon: Heart },
    { href: '/parent/vaccines',      label: 'Vaccination Card',  icon: Syringe },
    { href: '/parent/request-visit', label: 'Request a Visit',   icon: Calendar },
    { href: '/parent/notifications', label: 'Notifications',     icon: Bell },
    { href: '/parent/consent',       label: 'Consent & Privacy', icon: ShieldCheck },
  ],
};

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN:      'Administrator',
  SUPERVISOR: 'Zone Supervisor',
  NURSE:      'Nurse',
  CHW:        'Community Health Worker',
  PARENT:     'Parent / Guardian',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STORAGE_OPEN_GROUPS = 'ikibondo.sidebar.groups';

function isActive(pathname: string, href: string): boolean {
  const segments = href.split('/').filter(Boolean);
  if (segments.length === 1) return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

function groupContainsActive(items: NavLeaf[], pathname: string): boolean {
  return items.some((item) => isActive(pathname, item.href));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NavLeafItem({
  href, label, icon: Icon, collapsed, onClose,
}: NavLeaf & { collapsed: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);

  return (
    <li>
      <Link
        href={href}
        onClick={onClose}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? label : undefined}
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
          className="shrink-0"
          style={{ color: active ? 'var(--ink)' : 'var(--text-muted)' }}
        />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{label}</span>
            {active && (
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: 'var(--ink)' }}
                aria-hidden="true"
              />
            )}
          </>
        )}
      </Link>
    </li>
  );
}

function NavGroupItem({
  id, label, icon: Icon, items, collapsed, onClose,
  openGroups, toggleGroup,
}: NavGroup & {
  collapsed: boolean;
  onClose: () => void;
  openGroups: Set<string>;
  toggleGroup: (id: string) => void;
}) {
  const pathname = usePathname();
  const hasActive = groupContainsActive(items, pathname);
  const isOpen = openGroups.has(id) || hasActive;

  if (collapsed) {
    // In collapsed mode: show a button that expands the drawer; for now just show first active or group icon
    return (
      <li>
        <button
          type="button"
          title={label}
          className={[
            'w-full flex items-center justify-center px-3 py-2.5 rounded-xl transition-colors',
            hasActive
              ? 'bg-[var(--bg-sand)]'
              : 'hover:bg-[var(--bg-sand)]',
          ].join(' ')}
          onClick={() => toggleGroup(id)}
          aria-expanded={isOpen}
        >
          <Icon
            size={18}
            aria-hidden="true"
            style={{ color: hasActive ? 'var(--ink)' : 'var(--text-muted)' }}
          />
        </button>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => toggleGroup(id)}
        aria-expanded={isOpen}
        className={[
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
          hasActive
            ? 'text-[var(--ink)]'
            : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-sand)]',
        ].join(' ')}
      >
        <Icon
          size={18}
          aria-hidden="true"
          className="shrink-0"
          style={{ color: hasActive ? 'var(--ink)' : 'var(--text-muted)' }}
        />
        <span className="flex-1 text-left truncate">{label}</span>
        {isOpen
          ? <ChevronDown size={14} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
          : <ChevronRight size={14} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
        }
      </button>

      {isOpen && (
        <ul className="mt-0.5 ml-4 pl-3 border-l flex flex-col gap-0.5" style={{ borderColor: 'var(--border)' }}>
          {items.map((item) => (
            <NavLeafItem
              key={item.href}
              {...item}
              collapsed={false}
              onClose={onClose}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function SidebarContent({
  collapsed, onClose, onToggleCollapse,
}: { collapsed: boolean; onClose: () => void; onToggleCollapse: () => void }) {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  // Load persisted open groups on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_OPEN_GROUPS);
      if (stored) setOpenGroups(new Set(JSON.parse(stored)));
    } catch { /* ignore */ }
  }, []);

  const toggleGroup = useCallback((id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      try { localStorage.setItem(STORAGE_OPEN_GROUPS, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  const initials = user?.full_name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() ?? '?';

  const nav: NavEntry[] = user ? (ROLE_NAV[user.role] ?? []) : [];

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-elev)' }}>
      {/* Logo row */}
      <div
        className="flex items-center justify-between px-4 h-14 shrink-0 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        {!collapsed && (
          <span
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            Ikibondo
          </span>
        )}
        {collapsed && <span className="flex-1" />}

        {/* Desktop collapse toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--bg-sand)]"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar [' : 'Collapse sidebar ['}
          style={{ color: 'var(--text-muted)' }}
        >
          {collapsed
            ? <PanelLeftOpen size={18} aria-hidden="true" />
            : <PanelLeftClose size={18} aria-hidden="true" />
          }
        </button>

        {/* Mobile close button */}
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
      <nav
        className="flex-1 overflow-y-auto py-4 px-2"
        aria-label="Dashboard navigation"
      >
        <ul className="flex flex-col gap-0.5">
          {nav.map((entry) => {
            if (entry.kind === 'group') {
              return (
                <NavGroupItem
                  key={entry.id}
                  {...entry}
                  collapsed={collapsed}
                  onClose={onClose}
                  openGroups={openGroups}
                  toggleGroup={toggleGroup}
                />
              );
            }
            return (
              <NavLeafItem
                key={entry.href}
                {...entry}
                collapsed={collapsed}
                onClose={onClose}
              />
            );
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="px-2 py-3 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
        {!collapsed && (
          <div className="flex items-center gap-3 px-2 mb-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold select-none"
              style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
              aria-hidden="true"
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
                {user?.full_name ?? '—'}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {user ? ROLE_LABEL[user.role] : '—'}
              </p>
            </div>
          </div>
        )}

        <Link
          href="/profile"
          onClick={onClose}
          title={collapsed ? 'Profile & settings' : undefined}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-[var(--bg-sand)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <Settings size={16} aria-hidden="true" className="shrink-0" />
          {!collapsed && <span>Profile &amp; settings</span>}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          title={collapsed ? 'Sign out' : undefined}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-[var(--high-bg)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <LogOut size={16} aria-hidden="true" className="shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </div>
  );
}

export function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  return (
    <>
      {/* Desktop — sticky sidebar, width controlled by collapsed state */}
      <aside
        className="hidden lg:flex flex-col shrink-0 border-r h-screen sticky top-0 transition-all duration-200"
        style={{
          width: collapsed ? '64px' : '240px',
          borderColor: 'var(--border)',
        }}
        aria-label="Sidebar"
      >
        <SidebarContent
          collapsed={collapsed}
          onClose={onClose}
          onToggleCollapse={onToggleCollapse}
        />
      </aside>

      {/* Mobile — off-canvas overlay */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30 lg:hidden"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
            onClick={onClose}
            aria-hidden="true"
          />
          <aside
            className="fixed inset-y-0 left-0 z-40 w-72 shadow-xl lg:hidden flex flex-col border-r"
            style={{ borderColor: 'var(--border)' }}
            aria-label="Sidebar"
          >
            <SidebarContent
              collapsed={false}
              onClose={onClose}
              onToggleCollapse={onToggleCollapse}
            />
          </aside>
        </>
      )}
    </>
  );
}
