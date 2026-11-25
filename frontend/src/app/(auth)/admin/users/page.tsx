'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check, Pencil, UserCheck, UserPlus, UserX, Users,
  ShieldOff, ShieldCheck, AlertTriangle,
} from 'lucide-react';
import { useAdminUsers, useAdminCamps, usePendingApprovals, QK } from '@/lib/api/queries';
import { approveUser, createStaffUser, updateUser, deactivateUser, suspendUser, bulkSuspendUsers, listOrganizations } from '@/lib/api/admin';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { AuthUser } from '@/store/authStore';

const ROLE_OPTIONS = ['', 'ADMIN', 'SUPERVISOR', 'NURSE', 'CHW', 'PARENT', 'GOVERNMENT', 'PARTNER'];
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin', SUPERVISOR: 'Supervisor', NURSE: 'Nurse', CHW: 'CHW', PARENT: 'Parent',
  GOVERNMENT: 'Government', PARTNER: 'NGO partner',
};

function roleBadgeVariant(role: string) {
  if (role === 'ADMIN') return 'danger';
  if (role === 'SUPERVISOR') return 'warn';
  if (role === 'NURSE') return 'info';
  return 'default';
}

function statusBadge(user: AuthUser) {
  if (user.suspended_at) return <Badge variant="danger">Suspended</Badge>;
  if (!user.is_approved) return <Badge variant="warn">Pending</Badge>;
  return <Badge variant="success">Active</Badge>;
}

// ── Pending columns ───────────────────────────────────────────────────────────

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
        <Button size="sm" variant="secondary" loading={approving === user.id} onClick={() => onApprove(user.id)}>
          Approve
        </Button>
      );
    },
  },
];

// ── All-users columns ─────────────────────────────────────────────────────────

const USER_COLUMNS = (
  onEdit: (u: AuthUser) => void,
  confirmingDeactivate: string | null,
  onRequestDeactivate: (id: string) => void,
  onCancelDeactivate: () => void,
  onConfirmDeactivate: (id: string) => void,
  deactivating: string | null,
  onSuspend: (user: AuthUser) => void,
  suspending: string | null,
  selected: Set<string>,
  onToggle: (id: string) => void,
  onToggleAll: () => void,
  allActiveUsers: AuthUser[],
) => [
  {
    key: 'select' as const, header: (
      <input
        type="checkbox"
        checked={allActiveUsers.length > 0 && selected.size === allActiveUsers.length}
        onChange={onToggleAll}
        title="Select all active"
      />
    ) as unknown as string, width: '40px',
    render: (_: unknown, row: unknown) => {
      const user = row as AuthUser;
      if (user.suspended_at) return null;
      return (
        <input
          type="checkbox"
          checked={selected.has(user.id)}
          onChange={() => onToggle(user.id)}
          onClick={e => e.stopPropagation()}
        />
      );
    },
  },
  { key: 'full_name', header: 'Name',  width: '170px' },
  { key: 'email',     header: 'Email', width: '210px' },
  {
    key: 'role', header: 'Role', width: '150px',
    render: (v: unknown, row: AuthUser) => (
      <span className="flex flex-wrap gap-1">
        <Badge variant={roleBadgeVariant(v as string)}>
          {ROLE_LABELS[v as string] ?? v as string}
        </Badge>
        {(row.roles ?? []).filter((r) => r !== v).map((r) => (
          <Badge key={r} variant="default">+ {ROLE_LABELS[r] ?? r}</Badge>
        ))}
      </span>
    ),
  },
  { key: 'camp_name', header: 'Camp', width: '130px', render: (v: unknown) => (v as string) || '—' },
  {
    key: 'is_approved', header: 'Status', width: '110px',
    render: (_: unknown, row: unknown) => statusBadge(row as AuthUser),
  },
  {
    key: 'suspension_reason', header: 'Suspension reason', width: '170px',
    render: (v: unknown, row: unknown) => {
      const user = row as AuthUser;
      if (!user.suspended_at) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
      return (
        <span className="text-xs" style={{ color: 'var(--danger)' }} title={v as string}>
          {(v as string)?.slice(0, 40) || 'No reason given'}
        </span>
      );
    },
  },
  {
    key: 'date_joined', header: 'Joined', width: '110px',
    render: (v: unknown) => new Date(v as string).toLocaleDateString(),
  },
  {
    key: 'actions', header: '', width: '210px',
    render: (_: unknown, row: unknown) => {
      const user = row as AuthUser;
      const isSuspended = !!user.suspended_at;

      if (confirmingDeactivate === user.id) {
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Deactivate?</span>
            <Button size="sm" variant="danger" loading={deactivating === user.id} onClick={() => onConfirmDeactivate(user.id)}>Yes</Button>
            <Button size="sm" variant="secondary" onClick={onCancelDeactivate}>No</Button>
          </div>
        );
      }

      return (
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => onEdit(user)}>
            <Pencil size={12} aria-hidden="true" /> Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title={isSuspended ? 'Reactivate account' : 'Suspend account'}
            loading={suspending === user.id}
            onClick={() => onSuspend(user)}
            style={{ color: isSuspended ? 'var(--success)' : 'var(--warn)' }}
          >
            {isSuspended
              ? <ShieldCheck size={13} aria-hidden="true" />
              : <ShieldOff  size={13} aria-hidden="true" />}
          </Button>
          {!isSuspended && (
            <Button size="sm" variant="ghost" onClick={() => onRequestDeactivate(user.id)}
              style={{ color: 'var(--danger)' }}>
              <UserX size={13} aria-hidden="true" />
            </Button>
          )}
        </div>
      );
    },
  },
];

// ── Form types ────────────────────────────────────────────────────────────────

interface CreateUserForm {
  full_name: string; email: string; role: string; phone_number: string; password: string;
  camp: string; organization: string;
}
const EMPTY_CREATE: CreateUserForm = {
  full_name: '', email: '', role: 'CHW', phone_number: '', password: '', camp: '', organization: '',
};

// Which extra field a role needs: camp staff work in one camp; oversight roles belong to an organisation
const CAMP_ROLES = ['CHW', 'NURSE', 'SUPERVISOR'];
const ORG_ROLES = ['GOVERNMENT', 'PARTNER'];

interface EditUserForm {
  full_name: string; email: string; phone_number: string;
  role: string; camp: string; is_approved: boolean;
  /** Roles held in addition to the main role */
  extra_roles: string[];
  organization: string;
}

const TOAST_MS = 5000;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const qc = useQueryClient();
  const [roleFilter, setRoleFilter]         = useState('');
  const [showSuspended, setShowSuspended]   = useState(false);

  // Approve
  const [approving, setApproving] = useState<string | null>(null);

  // Create
  const [showCreate, setShowCreate]     = useState(false);
  const [createForm, setCreateForm]     = useState<CreateUserForm>(EMPTY_CREATE);
  const [creating, setCreating]         = useState(false);
  const [createError, setCreateError]   = useState('');
  const [createToast, setCreateToast]   = useState('');

  useEffect(() => {
    if (!createToast) return;
    const t = setTimeout(() => setCreateToast(''), TOAST_MS);
    return () => clearTimeout(t);
  }, [createToast]);

  // Edit
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [editForm, setEditForm]       = useState<EditUserForm>({
    full_name: '', email: '', phone_number: '', role: '', camp: '', is_approved: false, extra_roles: [],
    organization: '',
  });
  const [saving, setSaving]         = useState(false);
  const [editError, setEditError]   = useState('');

  // Deactivate
  const [confirmingDeactivate, setConfirmingDeactivate] = useState<string | null>(null);
  const [deactivating, setDeactivating]                 = useState<string | null>(null);

  // Suspend
  const [suspending, setSuspending]   = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<AuthUser | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  // Bulk suspend
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [bulkSuspending, setBulkSuspending] = useState(false);
  const [showBulkModal, setShowBulkModal]   = useState(false);
  const [bulkReason, setBulkReason]         = useState('');

  const { data: users, isLoading: usersLoading } = useAdminUsers(roleFilter || undefined, showSuspended);
  const { data: pending, isLoading: pendingLoading } = usePendingApprovals();
  const { data: camps } = useAdminCamps();
  const { data: organizations } = useQuery({ queryKey: ['organizations'], queryFn: listOrganizations });

  const invalidateUsers = () => qc.invalidateQueries({ queryKey: QK.adminUsers });

  const handleApprove = async (userId: string) => {
    setApproving(userId);
    try {
      await approveUser(userId);
      qc.invalidateQueries({ queryKey: QK.pendingApprovals });
      invalidateUsers();
    } finally { setApproving(null); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true); setCreateError('');
    try {
      const { camp, organization, ...fields } = createForm;
      const created = await createStaffUser({
        ...fields,
        phone_number: fields.phone_number || undefined,
        password: fields.password || undefined,
        camp: CAMP_ROLES.includes(fields.role) ? camp || undefined : undefined,
        organization: ORG_ROLES.includes(fields.role) ? organization || undefined : undefined,
      });
      invalidateUsers();
      setShowCreate(false);
      setCreateForm(EMPTY_CREATE);
      setCreateToast(created.email);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      setCreateError(data?.error ?? data?.message ?? 'Failed to create user. Check the form and try again.');
    } finally { setCreating(false); }
  };

  const openEdit = (user: AuthUser) => {
    setEditingUser(user);
    setEditForm({
      full_name: user.full_name, email: user.email,
      phone_number: user.phone_number ?? '', role: user.role,
      camp: user.camp ?? '', is_approved: user.is_approved,
      extra_roles: (user.roles ?? []).filter((r) => r !== user.role),
      organization: user.organization ?? '',
    });
    setEditError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSaving(true); setEditError('');
    try {
      const { extra_roles, ...fields } = editForm;
      await updateUser(editingUser.id, {
        ...fields,
        phone_number: fields.phone_number || undefined,
        camp: fields.camp || null,
        roles: [fields.role, ...extra_roles.filter((r) => r !== fields.role)],
        organization: fields.organization || null,
      });
      invalidateUsers();
      setEditingUser(null);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      setEditError(data?.error ?? data?.message ?? 'Failed to save changes.');
    } finally { setSaving(false); }
  };

  // Opens the suspend modal (or immediately reactivates)
  const handleSuspendClick = (user: AuthUser) => {
    if (user.suspended_at) {
      // Reactivate immediately — no reason needed
      doSuspend(user.id, false, '');
    } else {
      setSuspendTarget(user);
      setSuspendReason('');
    }
  };

  const doSuspend = async (userId: string, suspend: boolean, reason: string) => {
    setSuspending(userId);
    try {
      await suspendUser(userId, { suspended: suspend, reason: reason || undefined });
      invalidateUsers();
    } finally {
      setSuspending(null);
      setSuspendTarget(null);
      setSuspendReason('');
    }
  };

  const handleBulkSuspend = async () => {
    setBulkSuspending(true);
    try {
      await bulkSuspendUsers(Array.from(selected), true, bulkReason);
      invalidateUsers();
      setSelected(new Set());
      setShowBulkModal(false);
      setBulkReason('');
    } finally { setBulkSuspending(false); }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const activeUsers = (users ?? []).filter(u => !u.suspended_at);
    if (selected.size === activeUsers.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(activeUsers.map(u => u.id)));
    }
  };

  const handleDeactivate = async (userId: string) => {
    setDeactivating(userId);
    try {
      await deactivateUser(userId);
      invalidateUsers();
      setConfirmingDeactivate(null);
    } finally { setDeactivating(null); }
  };

  // Derived counts for summary
  const suspendedCount = (users ?? []).filter((u) => u.suspended_at).length;

  return (
    <div className="flex flex-col gap-8">
      {/* Success toast */}
      {createToast && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-2xl border px-5 py-3"
          style={{
            borderColor:     'color-mix(in srgb, var(--success) 40%, transparent)',
            backgroundColor: 'color-mix(in srgb, var(--success) 10%, var(--bg-elev))',
          }}
        >
          <Check size={16} style={{ color: 'var(--success)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
            Account created. Welcome email sent to <strong>{createToast}</strong>.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
            User Management
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {(users ?? []).filter((u) => !u.suspended_at).length} active accounts
            {suspendedCount > 0 && (
              <span className="ml-2 font-semibold" style={{ color: 'var(--danger)' }}>
                · {suspendedCount} suspended
              </span>
            )}
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <UserPlus size={16} className="mr-2" />
          Create staff account
        </Button>
      </div>

      {/* Pending approvals */}
      {(pending?.length ?? 0) > 0 && (
        <section aria-labelledby="pending-heading">
          <div className="flex items-center gap-2 mb-3">
            <UserCheck size={18} style={{ color: 'var(--warn)' }} />
            <h3 id="pending-heading" className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
              Pending approvals
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs"
                style={{ backgroundColor: 'var(--warn-bg)', color: 'var(--warn)' }}>
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
            <Users size={18} style={{ color: 'var(--text-muted)' }} />
            <h3 id="all-users-heading" className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
              All accounts
            </h3>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Show suspended toggle */}
            <button
              type="button"
              onClick={() => setShowSuspended((v) => !v)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors"
              style={{
                borderColor:     showSuspended ? 'var(--danger)' : 'var(--border)',
                backgroundColor: showSuspended ? 'color-mix(in srgb, var(--danger) 8%, var(--bg-elev))' : 'var(--bg-elev)',
                color:           showSuspended ? 'var(--danger)' : 'var(--text-muted)',
              }}
            >
              <ShieldOff size={12} />
              {showSuspended ? 'Hiding suspended' : 'Show suspended'}
            </button>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-lg border outline-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
              aria-label="Filter by role"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r ? ROLE_LABELS[r] : 'All roles'}</option>
              ))}
            </select>

            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => setShowBulkModal(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium"
                style={{ background: 'var(--danger)', color: '#fff', border: 'none' }}
              >
                <ShieldOff size={12} />
                Suspend selected ({selected.size})
              </button>
            )}
          </div>
        </div>

        {/* Suspended info banner */}
        {showSuspended && suspendedCount > 0 && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl mb-3 text-sm"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--danger) 8%, var(--bg-elev))',
              border: '1px solid color-mix(in srgb, var(--danger) 25%, var(--border))',
              color: 'var(--danger)',
            }}
          >
            <AlertTriangle size={14} />
            <span>
              <strong>{suspendedCount}</strong> suspended account{suspendedCount !== 1 ? 's' : ''} shown.
              Click <ShieldCheck size={12} className="inline mx-0.5" /> to reactivate.
            </span>
          </div>
        )}

        <DataTable
          columns={USER_COLUMNS(
            openEdit,
            confirmingDeactivate,
            setConfirmingDeactivate,
            () => setConfirmingDeactivate(null),
            handleDeactivate,
            deactivating,
            handleSuspendClick,
            suspending,
            selected,
            toggleSelect,
            toggleSelectAll,
            (users ?? []).filter(u => !u.suspended_at),
          ) as Parameters<typeof DataTable>[0]['columns']}
          data={users ?? []}
          keyField="id"
          isLoading={usersLoading}
          emptyTitle="No users found"
          emptyDescription={roleFilter ? `No ${ROLE_LABELS[roleFilter]} accounts yet.` : undefined}
        />
      </section>

      {/* ── Suspend modal ──────────────────────────────────────────────────────── */}
      {suspendTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setSuspendTarget(null); }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border p-6 flex flex-col gap-4 shadow-xl"
            style={{ backgroundColor: 'var(--bg-elev)', borderColor: 'var(--border)' }}
          >
            <div>
              <h3 className="font-bold text-lg" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
                Suspend — {suspendTarget.full_name}
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                The user will be locked out immediately. You can reactivate at any time.
              </p>
            </div>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              rows={3}
              placeholder="Reason for suspension (optional)…"
              className="w-full rounded-xl border px-3 py-2 text-sm resize-none outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--ink)' }}
            />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setSuspendTarget(null)}>
                Cancel
              </Button>
              <button
                onClick={() => doSuspend(suspendTarget.id, true, suspendReason)}
                disabled={suspending === suspendTarget.id}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-medium px-3 py-2 transition-opacity disabled:opacity-50"
                style={{ background: 'var(--danger)', color: '#fff' }}
              >
                {suspending === suspendTarget.id
                  ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  : <ShieldOff size={14} />}
                Suspend account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk suspend modal ────────────────────────────────────────────────── */}
      {showBulkModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowBulkModal(false); }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border p-6 flex flex-col gap-4 shadow-xl"
            style={{ backgroundColor: 'var(--bg-elev)', borderColor: 'var(--border)' }}
          >
            <div>
              <h3 className="font-bold text-lg" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
                Bulk Suspend — {selected.size} account{selected.size !== 1 ? 's' : ''}
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                All selected users will be locked out immediately.
              </p>
            </div>
            <textarea
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              rows={3}
              placeholder="Reason for suspension (optional)…"
              className="w-full rounded-xl border px-3 py-2 text-sm resize-none outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--ink)' }}
            />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setShowBulkModal(false)}>
                Cancel
              </Button>
              <button
                onClick={handleBulkSuspend}
                disabled={bulkSuspending}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-medium px-3 py-2 transition-opacity disabled:opacity-50"
                style={{ background: 'var(--danger)', color: '#fff' }}
              >
                {bulkSuspending
                  ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  : <ShieldOff size={14} />}
                Suspend {selected.size} account{selected.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create modal ───────────────────────────────────────────────────────── */}
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
              <Input label="Full name" value={createForm.full_name}
                onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} required />
              <Input label="Email" type="email" value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required />
              <Input label="Phone number (optional)" type="tel" value={createForm.phone_number}
                onChange={(e) => setCreateForm({ ...createForm, phone_number: e.target.value })} />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Role</label>
                <select value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className="text-sm px-3 py-2 rounded-lg border outline-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
                  required
                >
                  {ROLE_OPTIONS.filter(Boolean).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              {CAMP_ROLES.includes(createForm.role) && (
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Camp</span>
                  <select value={createForm.camp} required
                    onChange={(e) => setCreateForm({ ...createForm, camp: e.target.value })}
                    className="text-sm px-3 py-2 rounded-lg border outline-none"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}>
                    <option value="">Choose a camp</option>
                    {(camps ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}
              {ORG_ROLES.includes(createForm.role) && (
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Organisation</span>
                  <select value={createForm.organization} required
                    onChange={(e) => setCreateForm({ ...createForm, organization: e.target.value })}
                    className="text-sm px-3 py-2 rounded-lg border outline-none"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}>
                    <option value="">Choose an organisation</option>
                    {(organizations ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    They see statistics for the organisation&apos;s camps only — never a child&apos;s record.
                  </span>
                </label>
              )}
              <Input
                label="Temporary password (leave blank to auto-generate)"
                type="password" value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                autoComplete="new-password"
              />
              {createError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{createError}</p>}
              <div className="flex gap-2 pt-1">
                <Button type="submit" variant="primary" loading={creating} className="flex-1">Create account</Button>
                <Button type="button" variant="secondary"
                  onClick={() => { setShowCreate(false); setCreateError(''); }}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit modal ─────────────────────────────────────────────────────────── */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingUser(null); }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4 shadow-xl"
            style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)' }}
          >
            <h3 className="font-bold text-lg" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
              Edit — {editingUser.full_name}
            </h3>
            <form onSubmit={handleSave} className="flex flex-col gap-3">
              <Input label="Full name" value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} required />
              <Input label="Email" type="email" value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
              <Input label="Phone number" type="tel" value={editForm.phone_number}
                onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })} />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Main role</label>
                <select value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value, extra_roles: editForm.extra_roles.filter((r) => r !== e.target.value) })}
                  className="text-sm px-3 py-2 rounded-lg border outline-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
                >
                  {ROLE_OPTIONS.filter(Boolean).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-sm font-medium mb-1" style={{ color: 'var(--ink)' }}>Also works as</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {ROLE_OPTIONS.filter((r) => r && r !== editForm.role).map((r) => (
                    <label key={r} className="flex items-center gap-2 cursor-pointer select-none text-sm" style={{ color: 'var(--ink)' }}>
                      <input type="checkbox" className="w-4 h-4 rounded"
                        checked={editForm.extra_roles.includes(r)}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          extra_roles: e.target.checked
                            ? [...editForm.extra_roles, r]
                            : editForm.extra_roles.filter((x) => x !== r),
                        })} />
                      {ROLE_LABELS[r]}
                    </label>
                  ))}
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  They switch between roles from the top bar. A parent role shows the children linked to their account.
                </p>
              </fieldset>
              {[editForm.role, ...editForm.extra_roles].some((r) => ORG_ROLES.includes(r)) && (
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Organisation</span>
                  <select value={editForm.organization}
                    onChange={(e) => setEditForm({ ...editForm, organization: e.target.value })}
                    className="text-sm px-3 py-2 rounded-lg border outline-none"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}>
                    <option value="">— None —</option>
                    {(organizations ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </label>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Camp</label>
                <select value={editForm.camp}
                  onChange={(e) => setEditForm({ ...editForm, camp: e.target.value })}
                  className="text-sm px-3 py-2 rounded-lg border outline-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
                >
                  <option value="">— No camp —</option>
                  {(camps ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={editForm.is_approved}
                  onChange={(e) => setEditForm({ ...editForm, is_approved: e.target.checked })}
                  className="w-4 h-4 rounded" />
                <span className="text-sm" style={{ color: 'var(--ink)' }}>Account approved</span>
              </label>
              {editError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{editError}</p>}
              <div className="flex gap-2 pt-1">
                <Button type="submit" variant="primary" loading={saving} className="flex-1">Save changes</Button>
                <Button type="button" variant="secondary" onClick={() => setEditingUser(null)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
