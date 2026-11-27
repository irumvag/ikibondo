'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Repeat } from 'lucide-react';
import { useAuthStore, type UserRole } from '@/store/authStore';
import { switchRole } from '@/lib/api/auth';
import { ROLE_HOME } from '@/lib/roles';
import { useRoleLabel } from '@/i18n/useRoleLabel';
import { useToast } from '@/contexts/ToastContext';

/** Switch to another role the person holds (only shown when they hold more than one). */
export function useRoleSwitch() {
  const t = useTranslations('common.roleSwitcher');
  const roleName = useRoleLabel();
  const router = useRouter();
  const qc = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  const toast = useToast();
  const [switching, setSwitching] = useState<UserRole | null>(null);

  const switchTo = async (role: UserRole) => {
    setSwitching(role);
    try {
      const { access, refresh, user } = await switchRole(role);
      // Nothing cached for the previous role may leak into the new one
      qc.clear();
      setAuth(user, access, refresh);
      router.push(ROLE_HOME[role]);
      toast.success(t('nowWorkingAs', { role: roleName(role) }));
    } catch {
      toast.error(t('couldNotSwitch'));
    } finally {
      setSwitching(null);
    }
  };
  return { switchTo, switching };
}

export function RoleSwitcher() {
  const t = useTranslations('common.roleSwitcher');
  const roleName = useRoleLabel();
  const user = useAuthStore((s) => s.user);
  const { switchTo, switching } = useRoleSwitch();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const roles = user?.roles ?? [];
  if (!user || roles.length < 2) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-bold border transition-colors hover:bg-[var(--bg-sand)]"
        style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
        title={t('switchRole')}
        aria-label={t('switchRoleWorkingAs', { role: roleName(user.role) })}
      >
        <Repeat size={13} aria-hidden="true" />
        <span className="hidden sm:inline">{roleName(user.role)}</span>
        <ChevronDown size={13} aria-hidden="true" className="transition-transform" style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 rounded-xl border p-1.5 z-50 animate-pop"
          style={{ backgroundColor: 'var(--bg-elev)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-lg)' }}
        >
          <p className="px-2.5 pt-1.5 pb-2 text-xs" style={{ color: 'var(--text-muted)' }}>{t('workAs')}</p>
          {roles.map((r) => {
            const active = r === user.role;
            return (
              <button
                key={r}
                role="menuitemradio"
                aria-checked={active}
                disabled={active || switching !== null}
                onClick={() => { setOpen(false); void switchTo(r); }}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm text-left transition-colors hover:bg-[var(--bg-sand)] disabled:cursor-default"
                style={{ color: 'var(--ink)', fontWeight: active ? 700 : 500 }}
              >
                {roleName(r)}
                {active && <Check size={15} aria-hidden="true" style={{ color: 'var(--success)' }} />}
                {switching === r && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>…</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
