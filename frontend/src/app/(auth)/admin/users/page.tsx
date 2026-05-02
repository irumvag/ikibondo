'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UserCheck, UserPlus, Users } from 'lucide-react';
import { useAdminUsers, usePendingApprovals, QK } from '@/lib/api/queries';
import { approveUser, createStaffUser } from '@/lib/api/admin';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { AuthUser } from '@/store/authStore';

const ROLE_OPTIONS = ['', 'ADMIN', 'SUPERVISOR', 'NURSE', 'CHW', 'PARENT'];
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin', SUPERVISOR: 'Supervisor', NURSE: 'Nurse', CHW: 'CHW', PARENT: 'Parent',
};

function roleBadgeVariant(role: string) {
  if (role === 'ADMIN') return 'danger';
  if (role === 'SUPERVISOR') return 'warn';
  if (role === 'NURSE') return 'info';
  return 'default';
}

const USER_COLUMNS = [
  { key: 'full_name',  header: 'Name',       width: '180px' },
  { key: 'email',      header: 'Email',       width: '220px' },
  {
    key: 'role', header: 'Role', width: '120px',
    render: (v: unknown) => (
      <Badge variant={roleBadgeVariant(v as string)}>
        {ROLE_LABELS[v as string] ?? v as string}
      </Badge>
    ),
  },
  { key: 'camp_name', header: 'Camp',   width: '140px', render: (v: unknown) => (v as string) || '—' },
  {
    key: 'is_approved', header: 'Status', width: '100px',
    render: (v: unknown) => (
      <Badge variant={v ? 'success' : 'warn'}>{v ? 'Active' : 'Pending'}</Badge>
    ),
  },
  {
    key: 'date_joined', header: 'Joined', width: '120px',
    render: (v: unknown) => new Date(v as string).toLocaleDateString(),
  },
];

const PENDING_COLUMNS = (onApprove: (id: string) => void, approving: string | null) => [
  { key: 'full_name', header: 'Name',  width: '180px' },
  { key: 'email',     header: 'Email', width: '220px' },
  {
    key: 'role', header: 'Role', width: '120px',
    render: (v: unknown) => (
      <Badge variant={roleBadgeVariant(v as string)}>
        {ROLE_LABELS[v as string] ?? v as string}
      </Badge>
    ),
  },
  { key: 'camp_name', header: 'Camp', width: '140px', render: (v: unknown) => (v as string) || '—' },
  {
    key: 'id', header: '', width: '100px',
    render: (_: unknown, row: unknown) => {
      const user = row as AuthUser;
      return (
        <Button
          size="sm"
          variant="secondary"
          loading={approving === user.id}
          onClick={() => onApprove(user.id)}
        >
          Approve
        </Button>
      );
    },
  },
];

// ── Create user form ──────────────────────────────────────────────────────────

interface CreateUserForm {
  full_name: string; email: string; role: string; phone_number: string; password: string;
}

const EMPTY_FORM: CreateUserForm = { full_name: '', email: '', role: 'CHW', phone_number: '', password: '' };

export default function UsersPage() {
  const qc = useQueryClient();
  const [roleFilter, setRoleFilter] = useState('');
  const [approving, setApproving] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateUserForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const { data: users, isLoading: usersLoading } = useAdminUsers(roleFilter || undefined);
  const { data: pending, isLoading: pendingLoading } = usePendingApprovals();

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      await createStaffUser({
        ...form,
        phone_number: form.phone_number || undefined,
      });
      qc.invalidateQueries({ queryKey: QK.adminUsers });
      setShowCreate(false);
      setForm(EMPTY_FORM);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setCreateError(msg ?? 'Failed to create user. Check the form and try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            User Management
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {users?.length ?? 0} total accounts
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <UserPlus size={16} className="mr-2" aria-hidden="true" />
          Create staff account
        </Button>
      </div>

      {/* Pending approvals */}
      {(pending?.length ?? 0) > 0 && (
        <section aria-labelledby="pending-heading">
          <div className="flex items-center gap-2 mb-3">
            <UserCheck size={18} style={{ color: 'var(--warn)' }} aria-hidden="true" />
            <h3 id="pending-heading" className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
              Pending approvals
              <span
                className="ml-2 px-2 py-0.5 rounded-full text-xs"
                style={{ backgroundColor: 'var(--warn-bg)', color: 'var(--warn)' }}
              >
                {pending!.length}
              </span>
            </h3>
          </div>
          <DataTable
            columns={PENDING_COLUMNS(handleApprove, approving) as Parameters<typeof DataTable>[0]['columns']}
            data={pending ?? []}
            keyField="id"
            isLoading={pendingLoading}
            emptyTitle="No pending approvals"
          />
        </section>
      )}

      {/* All users */}
      <section aria-labelledby="all-users-heading">
        <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Users size={18} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
            <h3 id="all-users-heading" className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
              All accounts
            </h3>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border outline-none"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--bg-elev)',
              color: 'var(--ink)',
            }}
            aria-label="Filter by role"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{r ? ROLE_LABELS[r] : 'All roles'}</option>
            ))}
          </select>
        </div>
        <DataTable
          columns={USER_COLUMNS as Parameters<typeof DataTable>[0]['columns']}
          data={(users ?? []) }
          keyField="id"
          isLoading={usersLoading}
          emptyTitle="No users found"
          emptyDescription={roleFilter ? `No ${ROLE_LABELS[roleFilter]} accounts yet.` : undefined}
        />
      </section>

      {/* Create user modal */}
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
            <h3 className="font-bold text-lg" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
              Create staff account
            </h3>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <Input
                label="Full name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <Input
                label="Phone number (optional)"
                type="tel"
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="text-sm px-3 py-2 rounded-lg border outline-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
                  required
                >
                  {ROLE_OPTIONS.filter(Boolean).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Temporary password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              {createError && (
                <p className="text-xs" style={{ color: 'var(--danger)' }}>{createError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <Button type="submit" variant="primary" loading={creating} className="flex-1">
                  Create account
                </Button>
                <Button type="button" variant="secondary" onClick={() => { setShowCreate(false); setCreateError(''); }}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

