'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, Check } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAdminUsers, usePendingApprovals, QK } from '@/lib/api/queries';
import { approveUser, createStaffUser } from '@/lib/api/admin';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { AuthUser } from '@/store/authStore';

type ColumnsT = ReturnType<typeof useTranslations<'supervisor.staff'>>;

const STAFF_ROLES = ['CHW', 'NURSE'] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

// Text: messages/en.json supervisor.staff.roleName.<code>
const ROLES = ['CHW', 'NURSE'] as const;

interface CreateForm {
  full_name:    string;
  email:        string;
  phone_number: string;
  role:         StaffRole;
  password:     string;
}

const EMPTY_FORM: CreateForm = {
  full_name: '', email: '', phone_number: '', role: 'CHW', password: '',
};

const STAFF_COLUMNS = (t: ColumnsT) => [
  { key: 'full_name',    header: t('colName'),  width: '180px' },
  { key: 'email',        header: t('colEmail'), width: '200px', render: (v: unknown) => (v as string) || '—' },
  { key: 'phone_number', header: t('colPhone'), width: '140px', render: (v: unknown) => (v as string) || '—' },
  {
    key: 'role', header: t('colRole'), width: '180px',
    render: (v: unknown) => (
      <Badge variant={(v as string) === 'NURSE' ? 'info' : 'default'}>
        {(ROLES as readonly string[]).includes(v as string) ? t(`roleName.${v as (typeof ROLES)[number]}`) : v as string}
      </Badge>
    ),
  },
  {
    key: 'is_approved', header: t('colStatus'), width: '90px',
    render: (v: unknown) => (
      <Badge variant={v ? 'success' : 'warn'}>{v ? t('active') : t('pending')}</Badge>
    ),
  },
];

const PENDING_COLUMNS = (t: ColumnsT, onApprove: (id: string) => void, approving: string | null) => [
  { key: 'full_name',    header: t('colName'),  width: '180px' },
  { key: 'phone_number', header: t('colPhone'), width: '160px', render: (v: unknown) => (v as string) || '—' },
  { key: 'email',        header: t('colEmail'), width: '200px', render: (v: unknown) => (v as string) || '—' },
  {
    key: 'id', header: '', width: '110px',
    render: (_: unknown, row: unknown) => {
      const u = row as AuthUser;
      return (
        <Button size="sm" variant="secondary" loading={approving === u.id} onClick={() => onApprove(u.id)}>{t('approve')}</Button>
      );
    },
  },
];

export default function SupervisorStaffPage() {
  const t = useTranslations('supervisor.staff');
  const qc   = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const campId = user?.camp ?? null;

  const { data: allUsers = [],    isLoading: usersLoading   } = useAdminUsers();
  const { data: allPending = [],  isLoading: pendingLoading } = usePendingApprovals();

  const staffUsers     = allUsers.filter((u) => (u.role === 'CHW' || u.role === 'NURSE') && u.camp === campId);
  const pendingParents = allPending.filter((u) => u.role === 'PARENT' && u.camp === campId);

  const [approving, setApproving] = useState<string | null>(null);

  const handleApprove = async (userId: string) => {
    setApproving(userId);
    try {
      await approveUser(userId);
      qc.invalidateQueries({ queryKey: QK.pendingApprovals });
      qc.invalidateQueries({ queryKey: QK.adminUsers });
    } finally {
      setApproving(null);
    }
  };

  const [showCreate,   setShowCreate]   = useState(false);
  const [form,         setForm]         = useState<CreateForm>(EMPTY_FORM);
  const [creating,     setCreating]     = useState(false);
  const [createError,  setCreateError]  = useState('');
  const [toast,        setToast]        = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campId) return;
    setCreating(true);
    setCreateError('');
    try {
      const created = await createStaffUser({
        full_name:    form.full_name,
        email:        form.email,
        phone_number: form.phone_number || undefined,
        role:         form.role,
        camp:         campId,
        password:     form.password || undefined,
      });
      qc.invalidateQueries({ queryKey: QK.adminUsers });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      setToast(created.email);
      setTimeout(() => setToast(''), 5000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setCreateError(msg ?? 'Failed to create account. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-2xl border px-5 py-3"
          style={{
            borderColor: 'color-mix(in srgb, var(--success) 40%, transparent)',
            backgroundColor: 'color-mix(in srgb, var(--success) 10%, var(--bg-elev))',
          }}
        >
          <Check size={16} style={{ color: 'var(--success)' }} aria-hidden="true" />
          <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('accountCreatedWelcomeEmail')}{' '}<strong>{toast}</strong>.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >{t('staff')}</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('accountsInCamp', { camp: user?.camp_name ?? t('yourCamp') })}
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <UserPlus size={16} className="mr-1.5" aria-hidden="true" />{t('addStaff')}</Button>
      </div>

      {/* Pending parent approvals */}
      {(pendingLoading || pendingParents.length > 0) && (
        <section aria-labelledby="pending-hd">
          <div className="flex items-center gap-2 mb-3">
            <h3 id="pending-hd" className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{t('pendingParentApprovals')}{pendingParents.length > 0 && (
                <span
                  className="ml-2 px-2 py-0.5 rounded-full text-xs"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--warn) 15%, transparent)', color: 'var(--warn)' }}
                >
                  {pendingParents.length}
                </span>
              )}
            </h3>
          </div>
          <DataTable
            columns={PENDING_COLUMNS(t, handleApprove, approving) as Parameters<typeof DataTable>[0]['columns']}
            data={pendingParents}
            keyField="id"
            isLoading={pendingLoading}
            emptyTitle="No pending approvals"
          />
        </section>
      )}

      {/* Staff list */}
      <section aria-labelledby="staff-hd">
        <div className="flex items-center gap-2 mb-3">
          <Users size={18} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <h3 id="staff-hd" className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{t('chwsNurses')}</h3>
        </div>
        <DataTable
          columns={STAFF_COLUMNS(t) as Parameters<typeof DataTable>[0]['columns']}
          data={staffUsers}
          keyField="id"
          isLoading={usersLoading}
          emptyTitle="No staff accounts yet"
          emptyDescription="Use 'Add staff' to create CHW or Nurse accounts."
        />
      </section>

      {/* Create modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4 shadow-xl"
            style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)' }}
          >
            <h3 className="font-bold text-lg" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>{t('addStaffAccount')}</h3>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <Input label={t('fullName')} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
              <Input label={t('email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              <Input label={t('phoneOptional')} type="tel" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
              <div className="flex flex-col gap-1">
                <p id="staff-role-label" className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('role')}</p>
                <div role="group" aria-labelledby="staff-role-label" className="flex gap-2">
                  {STAFF_ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={form.role === r}
                      onClick={() => setForm({ ...form, role: r })}
                      className="flex-1 py-2 rounded-xl border text-sm font-medium transition-colors"
                      style={{
                        borderColor:     form.role === r ? 'var(--ink)' : 'var(--border)',
                        backgroundColor: form.role === r ? 'var(--ink)' : 'transparent',
                        color:           form.role === r ? 'var(--bg)'  : 'var(--text-muted)',
                      }}
                    >
                      {r === 'CHW' ? 'CHW' : t('nurse')}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                label={t('temporaryPasswordOptionalLeave')}
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
              />
              {createError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{createError}</p>}
              <div className="flex gap-2 pt-1">
                <Button type="submit" variant="primary" loading={creating} className="flex-1">{t('createAccount')}</Button>
                <Button type="button" variant="secondary" onClick={() => { setShowCreate(false); setCreateError(''); }}>{t('cancel')}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
