'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, UserCheck, UserPlus, Users } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAdminUsers, usePendingApprovals, QK } from '@/lib/api/queries';
import { approveUser, createStaffUser } from '@/lib/api/admin';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { AuthUser } from '@/store/authStore';

const STAFF_ROLES = ['CHW', 'NURSE'] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

const ROLE_LABELS: Record<string, string> = {
  CHW: 'Community Health Worker',
  NURSE: 'Nurse',
  PARENT: 'Parent',
};

function roleBadgeVariant(role: string) {
  if (role === 'NURSE') return 'info';
  return 'default';
}

// Toast auto-dismiss
const TOAST_MS = 5000;

// ── Pending parent columns ────────────────────────────────────────────────────

const PENDING_COLUMNS = (
  onApprove: (id: string) => void,
  approving: string | null,
) => [
  { key: 'full_name',    header: 'Name',  width: '180px' },
  { key: 'phone_number', header: 'Phone', width: '160px', render: (v: unknown) => (v as string) || '—' },
  { key: 'email',        header: 'Email', width: '200px', render: (v: unknown) => (v as string) || '—' },
  {
    key: 'id', header: '', width: '110px',
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

// ── Staff columns ─────────────────────────────────────────────────────────────

const STAFF_COLUMNS = [
  { key: 'full_name',    header: 'Name',  width: '180px' },
  { key: 'phone_number', header: 'Phone', width: '160px', render: (v: unknown) => (v as string) || '—' },
  { key: 'email',        header: 'Email', width: '200px', render: (v: unknown) => (v as string) || '—' },
  {
    key: 'role', header: 'Role', width: '140px',
    render: (v: unknown) => (
      <Badge variant={roleBadgeVariant(v as string)}>
        {ROLE_LABELS[v as string] ?? v as string}
      </Badge>
    ),
  },
  {
    key: 'is_approved', header: 'Status', width: '90px',
    render: (v: unknown) => (
      <Badge variant={v ? 'success' : 'warn'}>{v ? 'Active' : 'Pending'}</Badge>
    ),
  },
];

// ── Form ──────────────────────────────────────────────────────────────────────

interface CreateForm {
  full_name: string;
  email: string;
  phone_number: string;
  role: StaffRole;
  password: string;
}

const EMPTY_FORM: CreateForm = {
  full_name: '',
  email: '',
  phone_number: '',
  role: 'CHW',
  password: '',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SupervisorUsersPage() {
  const qc   = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // All users — filtered client-side by supervisor's camp
  const { data: allUsers = [], isLoading: usersLoading } = useAdminUsers();
  const { data: allPending = [], isLoading: pendingLoading } = usePendingApprovals();

  const campId = user?.camp ?? null;

  // CHW + NURSE in this camp
  const staffUsers = allUsers.filter(
    (u) => (u.role === 'CHW' || u.role === 'NURSE') && u.camp === campId,
  );

  // Pending parents in this camp
  const pendingParents = allPending.filter(
    (u) => u.role === 'PARENT' && u.camp === campId,
  );

  // Approve
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

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]             = useState<CreateForm>(EMPTY_FORM);
  const [creating, setCreating]     = useState(false);
  const [createError, setCreateError] = useState('');
  const [createToast, setCreateToast] = useState('');

  useEffect(() => {
    if (!createToast) return;
    const t = setTimeout(() => setCreateToast(''), TOAST_MS);
    return () => clearTimeout(t);
  }, [createToast]);

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
      setCreateToast(created.email);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setCreateError(msg ?? 'Failed to create staff account. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Success toast */}
      {createToast && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-2xl border px-5 py-3"
          style={{
            borderColor: 'color-mix(in srgb, var(--success) 40%, transparent)',
            backgroundColor: 'color-mix(in srgb, var(--success) 10%, var(--bg-elev))',
          }}
        >
          <Check size={16} style={{ color: 'var(--success)' }} aria-hidden="true" />
          <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
            Account created. Welcome email sent to <strong>{createToast}</strong>.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            Camp staff
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            CHWs, Nurses, and pending parent accounts in your camp
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <UserPlus size={16} className="mr-2" aria-hidden="true" />
          Add staff
        </Button>
      </div>

      {/* Pending parent approvals */}
      {pendingParents.length > 0 && (
        <section aria-labelledby="pending-heading">
          <div className="flex items-center gap-2 mb-3">
            <UserCheck size={18} style={{ color: 'var(--warn)' }} aria-hidden="true" />
            <h3 id="pending-heading" className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
              Pending parent approvals
              <span
                className="ml-2 px-2 py-0.5 rounded-full text-xs"
                style={{ backgroundColor: 'var(--warn-bg)', color: 'var(--warn)' }}
              >
                {pendingParents.length}
              </span>
            </h3>
          </div>
          <DataTable
            columns={PENDING_COLUMNS(handleApprove, approving) as Parameters<typeof DataTable>[0]['columns']}
            data={pendingParents}
            keyField="id"
            isLoading={pendingLoading}
            emptyTitle="No pending approvals"
          />
        </section>
      )}

      {/* Staff list */}
      <section aria-labelledby="staff-heading">
        <div className="flex items-center gap-2 mb-3">
          <Users size={18} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <h3 id="staff-heading" className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
            CHWs &amp; Nurses
          </h3>
        </div>
        <DataTable
          columns={STAFF_COLUMNS as Parameters<typeof DataTable>[0]['columns']}
          data={staffUsers}
          keyField="id"
          isLoading={usersLoading}
          emptyTitle="No staff accounts yet"
          emptyDescription="Use 'Add staff' to create a CHW or Nurse account for your camp."
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
            <h3
              className="font-bold text-lg"
              style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
            >
              Add staff account
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

              {/* Role — CHW or NURSE only */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Role</label>
                <div className="flex gap-2">
                  {STAFF_ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm({ ...form, role: r })}
                      className="flex-1 py-2 rounded-xl border text-sm font-medium transition-colors"
                      style={{
                        borderColor:     form.role === r ? 'var(--ink)' : 'var(--border)',
                        backgroundColor: form.role === r ? 'var(--ink)' : 'transparent',
                        color:           form.role === r ? 'var(--bg)' : 'var(--text-muted)',
                      }}
                    >
                      {r === 'CHW' ? 'CHW' : 'Nurse'}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                label="Temporary password (optional — leave blank to auto-generate and email to user)"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
              />

              {createError && (
                <p className="text-xs" style={{ color: 'var(--danger)' }}>{createError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <Button type="submit" variant="primary" loading={creating} className="flex-1">
                  Create account
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { setShowCreate(false); setCreateError(''); }}
                >
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
