'use client';

import Link from 'next/link';
import { Baby, Syringe, RefreshCw, UserPlus, Stethoscope } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { KPICard } from '@/components/ui/KPICard';
import { useCampChildren, useVaccinationQueue } from '@/lib/api/queries';
import { useSyncStore } from '@/store/syncStore';

const QUICK_ACTIONS = [
  { href: '/chw/register', icon: UserPlus,    label: 'Register a child',    desc: 'Add a new child to the system.' },
  { href: '/chw/visit',    icon: Stethoscope, label: 'Log a visit',         desc: 'Record measurements and symptoms.' },
  { href: '/chw/vaccines', icon: Syringe,     label: 'Vaccination queue',   desc: 'Administer scheduled doses.' },
  { href: '/chw/sync',     icon: RefreshCw,   label: 'Sync queue',          desc: 'Push offline records to the server.' },
];

export default function CHWDashboard() {
  const user        = useAuthStore((s) => s.user);
  const pending     = useSyncStore((s) => s.pending);
  const campId      = user?.camp ?? undefined;

  const { data: children, isLoading: childrenLoading } = useCampChildren(campId);
  const { data: vaccines, isLoading: vaccinesLoading }  = useVaccinationQueue(1);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          My Caseload
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Welcome back, {user?.full_name ?? 'CHW'} &middot; {user?.camp_name ?? '—'}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Children assigned"
          value={children ? children.count.toLocaleString() : '—'}
          icon={<Baby size={18} />}
          isLoading={childrenLoading}
        />
        <KPICard
          label="Vaccines due"
          value={vaccines ? vaccines.count.toString() : '—'}
          icon={<Syringe size={18} />}
          variant={vaccines && vaccines.count > 0 ? 'warn' : 'default'}
          subtext="Scheduled doses"
          isLoading={vaccinesLoading}
        />
        <KPICard
          label="Unsynced records"
          value={pending.length.toString()}
          icon={<RefreshCw size={18} />}
          variant={pending.length > 0 ? 'warn' : 'default'}
          subtext={pending.length === 0 ? 'All synced' : 'Pending upload'}
        />
        <KPICard
          label="Camp"
          value={user?.camp_name ?? '—'}
          icon={<Baby size={18} />}
          subtext="Assigned camp"
        />
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="text-base font-semibold mb-3" style={{ color: 'var(--ink)' }}>
          Quick actions
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          {QUICK_ACTIONS.map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-start gap-4 p-5 rounded-2xl border transition-colors hover:bg-[var(--bg-sand)]"
              style={{ borderColor: 'var(--border)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
              >
                <Icon size={20} aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
