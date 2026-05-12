'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check, UserCheck, UserPlus, Users, Baby, X,
  UserCog, Search,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAdminUsers, usePendingApprovals, QK } from '@/lib/api/queries';
import { approveUser, createStaffUser, listGuardians, assignCHWToGuardian } from '@/lib/api/admin';
import type { Guardian } from '@/lib/api/admin';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import type { AuthUser } from '@/store/authStore';

const STAFF_ROLES = ['CHW', 'NURSE'] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

const ROLE_LABELS: Record<string, string> = { CHW: 'Community Health Worker', NURSE: 'Nurse', PARENT: 'Parent' };

const TABS = [
  { id: 'approvals', label: 'Pending approvals', icon: UserCheck },
  { id: 'staff',     label: 'CHWs & Nurses',     icon: Users },
  { id: 'assign',    label: 'Assign CHW',         icon: UserCog },
] as const;
type Tab = (typeof TABS)[number]['id'];

const TOAST_MS = 5000;

interface CreateForm {
  full_name: string; email: string; phone_number: string;
  role: StaffRole; password: string;
}
const EMPTY_FORM: CreateForm = { full_name: '', email: '', phone_number: '', role: 'CHW', password: '' };

// ── Pending approval row ──────────────────────────────────────────────────────
function PendingRow({ user, onApprove, approving }: {
  user: AuthUser;
  onApprove: (id: string) => void;
  approving: string | null;
}) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
        style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
      >
        {user.full_name?.charAt(0).toUpperCase() ?? '?'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{user.full_name}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {user.email} {user.phone_number ? `· ${user.phone_number}` : ''}
        </p>
      </div>
      <Badge variant="warn">Pending</Badge>
      <Button size="sm" variant="secondary" loading={approving === user.id} onClick={() => onApprove(user.id)}>
        Approve
      </Button>
    </div>
  );
}

// ── Staff row ─────────────────────────────────────────────────────────────────
function StaffRow({ user }: { user: AuthUser }) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
        style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
      >
        {user.full_name?.charAt(0).toUpperCase() ?? '?'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{user.full_name}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {user.email} {user.phone_number ? `· ${user.phone_number}` : ''}
        </p>
      </div>
      <Badge variant={user.role === 'NURSE' ? 'info' : 'default'}>
        {ROLE_LABELS[user.role] ?? user.role}
      </Badge>
      <Badge variant={user.is_approved ? 'success' : 'warn'}>
        {user.is_approved ? 'Active' : 'Pending'}
      </Badge>
    </div>
  );
}

// ── Guardian CHW assignment row ───────────────────────────────────────────────
function GuardianRow({ g, chws, onAssign }: {
  g: Guardian;
  chws: AuthUser[];
  onAssign: (guardianId: string, chwId: string | null) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(g.assigned_chw ?? '');

  const handleChange = async (val: string) => {
    setSelected(val);
    setSaving(true);
    try { await onAssign(g.id, val || null); } finally { setSaving(false); }
  };

  const inputStyle = {
    padding: '0.375rem 0.625rem',
    borderRadius: '0.5rem',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg)',
    color: 'var(--ink)',
    fontSize: '0.8125rem',
    outline: 'none',
    opacity: saving ? 0.6 : 1,
  };

  return (
    <div
      className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
        style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
      >
        {g.full_name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{g.full_name}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {g.phone_number} · {g.relationship}
          {g.has_account && (
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: '#f0fdf4', color: 'var(--success)' }}>
              Has app account
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          <Baby size={11} className="inline mr-1" />{g.children_count ?? 0}
        </span>
        <select
          value={selected}
          disabled={saving}
          onChange={(e) => handleChange(e.target.value)}
          style={inputStyle}
        >
          <option value="">— No CHW —</option>
          {chws.map((c) => (
            <option key={c.id} value={c.id}>{c.full_name}</option>
          ))}
        </select>
        {saving && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Saving…</span>
        )}
        {!saving && selected && (
          <Check size={13} style={{ color: 'var(--success)' }} />
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SupervisorUsersPage() {
  const qc   = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const campId = user?.camp ?? null;

  const { data: allUsers = [],   isLoading: usersLoading   } = useAdminUsers();
  const { data: allPending = [], isLoading: pendingLoading } = usePendingApprovals();

  const staffUsers    = allUsers.filter((u) => (u.role === 'CHW' || u.role === 'NURSE') && u.camp === campId);
  const campChws      = allUsers.filter((u) => u.role === 'CHW' && u.camp === campId && u.is_approved);
  const pendingInCamp = allPending.filter((u) => u.camp === campId);

  const [activeTab, setActiveTab]   = useState<Tab>('approvals');
  const [approving, setApproving]   = useState<string | null>(null);
  const [toast, setToast]           = useState('');
  const [guardianSearch, setGuardianSearch] = useState('');

  // Guardians for assign tab
  const { data: guardians = [], isLoading: guardiansLoading } = useQuery({
    queryKey: ['guardians', guardianSearch],
    queryFn:  () => listGuardians(guardianSearch || undefined),
    staleTime: 30_000,
    enabled:  activeTab === 'assign',
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const handleApprove = async (userId: string) => {
    setApproving(userId);
    try {
      await approveUser(userId);
      qc.invalidateQueries({ queryKey: QK.pendingApprovals });
      qc.invalidateQueries({ queryKey: QK.adminUsers });
      setToast('Account approved successfully.');
    } finally {
      setApproving(null);
    }
  };

  const handleAssign = async (guardianId: string, chwId: string | null) => {
    await assignCHWToGuardian(guardianId, chwId);
    qc.invalidateQueries({ queryKey: ['guardians'] });
  };

  // Create staff
  const [showCreate, setShowCreate]   = useState(false);
  const [form, setForm]               = useState<CreateForm>(EMPTY_FORM);
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campId) return;
    setCreating(true);
    setCreateError('');
    try {
      const created = await createStaffUser({
        full_name: form.full_name, email: form.email,
        phone_number: form.phone_number || undefined,
        role: form.role, camp: campId,
        password: form.password || undefined,
      });
      qc.invalidateQueries({ queryKey: QK.adminUsers });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      setToast(`Account created. Welcome email sent to ${created.email}.`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setCreateError(msg ?? 'Failed to create account. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const pendingCount = pendingInCamp.length;

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
      {/* Toast */}
      {toast && (
        <div
          className="flex items-center gap-3 rounded-2xl border px-5 py-3"
          style={{
            borderColor: 'color-mix(in srgb, var(--success) 40%, transparent)',
            backgroundColor: 'color-mix(in srgb, var(--success) 10%, var(--bg-elev))',
          }}
        >
          <Check size={16} style={{ color: 'var(--success)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
            Camp staff & families
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Approve parents, manage CHWs, and assign families to health workers.
          </p>
        </div>
        {activeTab === 'staff' && (
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <UserPlus size={16} className="mr-2" />
            Add staff
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div
        className="flex rounded-xl p-1 gap-1"
        style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)' }}
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            style={{
              backgroundColor: activeTab === id ? 'var(--bg)' : 'transparent',
              color: activeTab === id ? 'var(--ink)' : 'var(--text-muted)',
              boxShadow: activeTab === id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Icon size={14} />
            {label}
            {id === 'approvals' && pendingCount > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-bold ml-0.5"
                style={{ backgroundColor: 'var(--warn)', color: '#fff' }}
              >
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Approvals tab ─────────────────────────────────────────────────── */}
      {activeTab === 'approvals' && (
        <>
          {pendingLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
            </div>
          ) : pendingInCamp.length === 0 ? (
            <div
              className="rounded-2xl border px-6 py-12 text-center"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
            >
              <UserCheck size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>No pending approvals</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                All parent registrations in your camp have been reviewed.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              {pendingInCamp.map((u) => (
                <PendingRow key={u.id} user={u} onApprove={handleApprove} approving={approving} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Staff tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'staff' && (
        <>
          {usersLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
            </div>
          ) : staffUsers.length === 0 ? (
            <div
              className="rounded-2xl border px-6 py-12 text-center"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
            >
              <Users size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>No staff accounts yet</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Use &ldquo;Add staff&rdquo; to create a CHW or Nurse account.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              {staffUsers.map((u) => <StaffRow key={u.id} user={u} />)}
            </div>
          )}
        </>
      )}

      {/* ── Assign CHW tab ────────────────────────────────────────────────── */}
      {activeTab === 'assign' && (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Assign a CHW to each guardian family so they can conduct home visits and view health records.
            </p>
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={guardianSearch}
              onChange={(e) => setGuardianSearch(e.target.value)}
              placeholder="Search family by name or phone…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border outline-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
            />
          </div>

          {campChws.length === 0 && (
            <div
              className="flex items-center gap-3 p-4 rounded-xl text-sm"
              style={{ backgroundColor: 'color-mix(in srgb, var(--warn) 8%, var(--bg-elev))', border: '1px solid var(--warn)', color: 'var(--ink)' }}
            >
              No active CHWs in your camp yet. Create CHW accounts in the &ldquo;CHWs &amp; Nurses&rdquo; tab first.
            </div>
          )}

          {guardiansLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
            </div>
          ) : guardians.length === 0 ? (
            <div
              className="rounded-2xl border px-6 py-12 text-center"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
            >
              <Baby size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {guardianSearch ? 'No families match your search' : 'No guardian families yet'}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              {guardians.map((g) => (
                <GuardianRow key={g.id} g={g} chws={campChws} onAssign={handleAssign} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create staff modal */}
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
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
                Add staff account
              </h3>
              <button type="button" onClick={() => setShowCreate(false)}>
                <X size={18} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <Input label="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              <Input label="Phone number (optional)" type="tel" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Role</label>
                <div className="flex gap-2">
                  {STAFF_ROLES.map((r) => (
                    <button
                      key={r} type="button"
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
                label="Temporary password (optional — leave blank to auto-generate)"
                type="password" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
              />
              {createError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{createError}</p>}
              <div className="flex gap-2 pt-1">
                <Button type="submit" variant="primary" loading={creating} className="flex-1">Create account</Button>
                <Button type="button" variant="secondary" onClick={() => { setShowCreate(false); setCreateError(''); }}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
