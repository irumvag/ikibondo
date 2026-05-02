'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Globe, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAdminCamps, useAdminZones, QK } from '@/lib/api/queries';
import {
  createCamp, updateCamp, deleteCamp,
  createZone, updateZone, deleteZone,
} from '@/lib/api/admin';
import type { Camp, Zone } from '@/lib/api/admin';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'CLOSED'];

function statusVariant(s: string) {
  if (s === 'ACTIVE') return 'success';
  if (s === 'INACTIVE') return 'default';
  return 'warn';
}

// ── Camp form ─────────────────────────────────────────────────────────────────

interface CampForm {
  name: string; code: string; district: string; province: string;
  status: string; estimated_population: string; managing_body: string; capacity: string;
}

const EMPTY_CAMP: CampForm = {
  name: '', code: '', district: '', province: '',
  status: 'ACTIVE', estimated_population: '', managing_body: '', capacity: '',
};

function campFormToPayload(f: CampForm) {
  return {
    name: f.name.trim(),
    code: f.code.trim().toUpperCase(),
    district: f.district.trim() || undefined,
    province: f.province.trim() || undefined,
    status: f.status,
    estimated_population: f.estimated_population ? Number(f.estimated_population) : undefined,
    managing_body: f.managing_body.trim() || undefined,
    capacity: f.capacity ? Number(f.capacity) : undefined,
  };
}

function campToForm(c: Camp): CampForm {
  return {
    name: c.name,
    code: c.code,
    district: c.district ?? '',
    province: c.province ?? '',
    status: c.status,
    estimated_population: c.estimated_population?.toString() ?? '',
    managing_body: c.managing_body ?? '',
    capacity: c.capacity?.toString() ?? '',
  };
}

// ── Zone form ─────────────────────────────────────────────────────────────────

interface ZoneForm {
  name: string; code: string; description: string;
  status: string; estimated_households: string; estimated_population: string;
}

const EMPTY_ZONE: ZoneForm = {
  name: '', code: '', description: '', status: 'ACTIVE',
  estimated_households: '', estimated_population: '',
};

function zoneFormToPayload(f: ZoneForm) {
  return {
    name: f.name.trim(),
    code: f.code.trim().toUpperCase(),
    description: f.description.trim() || undefined,
    status: f.status,
    estimated_households: f.estimated_households ? Number(f.estimated_households) : undefined,
    estimated_population: f.estimated_population ? Number(f.estimated_population) : undefined,
  };
}

function zoneToForm(z: Zone): ZoneForm {
  return {
    name: z.name,
    code: z.code,
    description: z.description ?? '',
    status: z.status,
    estimated_households: z.estimated_households?.toString() ?? '',
    estimated_population: z.estimated_population?.toString() ?? '',
  };
}

// ── CampFormFields ────────────────────────────────────────────────────────────

function CampFormFields({ form, onChange }: {
  form: CampForm;
  onChange: (f: CampForm) => void;
}) {
  const set = (k: keyof CampForm, v: string) => onChange({ ...form, [k]: v });
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Camp name" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        <Input label="Code" value={form.code} onChange={(e) => set('code', e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="District" value={form.district} onChange={(e) => set('district', e.target.value)} />
        <Input label="Province" value={form.province} onChange={(e) => set('province', e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Status</label>
        <select
          value={form.status}
          onChange={(e) => set('status', e.target.value)}
          className="text-sm px-3 py-2 rounded-lg border outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
        >
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Est. population" type="number" value={form.estimated_population} onChange={(e) => set('estimated_population', e.target.value)} />
        <Input label="Capacity" type="number" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />
      </div>
      <Input label="Managing body" value={form.managing_body} onChange={(e) => set('managing_body', e.target.value)} />
    </>
  );
}

// ── ZoneFormFields ────────────────────────────────────────────────────────────

function ZoneFormFields({ form, onChange }: {
  form: ZoneForm;
  onChange: (f: ZoneForm) => void;
}) {
  const set = (k: keyof ZoneForm, v: string) => onChange({ ...form, [k]: v });
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Zone name" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        <Input label="Code" value={form.code} onChange={(e) => set('code', e.target.value)} required />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Status</label>
        <select
          value={form.status}
          onChange={(e) => set('status', e.target.value)}
          className="text-sm px-3 py-2 rounded-lg border outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
        >
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Est. households" type="number" value={form.estimated_households} onChange={(e) => set('estimated_households', e.target.value)} />
        <Input label="Est. population" type="number" value={form.estimated_population} onChange={(e) => set('estimated_population', e.target.value)} />
      </div>
      <Input label="Description" value={form.description} onChange={(e) => set('description', e.target.value)} />
    </>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 flex flex-col gap-4 shadow-xl max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)' }}
      >
        <h3 className="font-bold text-lg" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

// ── ZonesPanel ────────────────────────────────────────────────────────────────

function ZonesPanel({ campId }: { campId: string }) {
  const qc = useQueryClient();
  const { data: zones, isLoading } = useAdminZones(campId);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<ZoneForm>(EMPTY_ZONE);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [editForm, setEditForm] = useState<ZoneForm>(EMPTY_ZONE);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: QK.adminZones(campId) });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      await createZone(campId, zoneFormToPayload(createForm));
      invalidate();
      setShowCreate(false);
      setCreateForm(EMPTY_ZONE);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setCreateError(msg ?? 'Failed to create zone.');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (z: Zone) => {
    setEditingZone(z);
    setEditForm(zoneToForm(z));
    setEditError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingZone) return;
    setSaving(true);
    setEditError('');
    try {
      await updateZone(campId, editingZone.id, zoneFormToPayload(editForm));
      invalidate();
      setEditingZone(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setEditError(msg ?? 'Failed to save zone.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (zoneId: string) => {
    setDeleting(zoneId);
    try {
      await deleteZone(campId, zoneId);
      invalidate();
      setConfirmingDelete(null);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Zone list */}
      {isLoading
        ? [0, 1].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)
        : (zones ?? []).length === 0
        ? (
          <p className="text-xs py-3" style={{ color: 'var(--text-muted)' }}>
            No zones yet. Add one below.
          </p>
        )
        : (zones ?? []).map((z) => (
          <div
            key={z.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)' }}
          >
            <span className="flex-1 text-sm font-medium" style={{ color: 'var(--ink)' }}>{z.name}</span>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}>
              {z.code}
            </span>
            <Badge variant={statusVariant(z.status)}>{z.status}</Badge>
            {z.estimated_population && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {z.estimated_population.toLocaleString()} pop.
              </span>
            )}
            <div className="flex items-center gap-1 ml-1">
              {confirmingDelete === z.id
                ? (
                  <>
                    <span className="text-xs mr-1" style={{ color: 'var(--text-muted)' }}>Delete?</span>
                    <Button size="sm" variant="danger" loading={deleting === z.id} onClick={() => handleDelete(z.id)}>Yes</Button>
                    <Button size="sm" variant="secondary" onClick={() => setConfirmingDelete(null)}>No</Button>
                  </>
                )
                : (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(z)}>
                      <Pencil size={12} aria-hidden="true" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(z.id)}>
                      <Trash2 size={12} aria-hidden="true" />
                    </Button>
                  </>
                )}
            </div>
          </div>
        ))}

      {/* Add zone button */}
      <Button size="sm" variant="secondary" className="self-start mt-1" onClick={() => setShowCreate(true)}>
        <Plus size={14} aria-hidden="true" />Add zone
      </Button>

      {/* Create zone modal */}
      {showCreate && (
        <Modal title="Add zone" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <ZoneFormFields form={createForm} onChange={setCreateForm} />
            {createError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{createError}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="submit" variant="primary" loading={creating} className="flex-1">Create zone</Button>
              <Button type="button" variant="secondary" onClick={() => { setShowCreate(false); setCreateError(''); }}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit zone modal */}
      {editingZone && (
        <Modal title={`Edit zone — ${editingZone.name}`} onClose={() => setEditingZone(null)}>
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <ZoneFormFields form={editForm} onChange={setEditForm} />
            {editError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{editError}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="submit" variant="primary" loading={saving} className="flex-1">Save changes</Button>
              <Button type="button" variant="secondary" onClick={() => setEditingZone(null)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CampsPage() {
  const qc = useQueryClient();
  const { data: camps, isLoading } = useAdminCamps();
  const [expanded, setExpanded] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CampForm>(EMPTY_CAMP);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editingCamp, setEditingCamp] = useState<Camp | null>(null);
  const [editForm, setEditForm] = useState<CampForm>(EMPTY_CAMP);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const totalChildren = camps?.reduce((s, c) => s + c.active_children_count, 0) ?? 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      await createCamp(campFormToPayload(createForm));
      qc.invalidateQueries({ queryKey: QK.adminCamps });
      setShowCreate(false);
      setCreateForm(EMPTY_CAMP);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setCreateError(msg ?? 'Failed to create camp.');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (camp: Camp) => {
    setEditingCamp(camp);
    setEditForm(campToForm(camp));
    setEditError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCamp) return;
    setSaving(true);
    setEditError('');
    try {
      await updateCamp(editingCamp.id, campFormToPayload(editForm));
      qc.invalidateQueries({ queryKey: QK.adminCamps });
      setEditingCamp(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setEditError(msg ?? 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (campId: string) => {
    setDeleting(campId);
    try {
      await deleteCamp(campId);
      qc.invalidateQueries({ queryKey: QK.adminCamps });
      setConfirmingDelete(null);
      if (expanded === campId) setExpanded(null);
    } finally {
      setDeleting(null);
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
            Camps &amp; Zones
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {camps?.length ?? 0} camps &middot; {totalChildren.toLocaleString()} registered children
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} className="mr-2" aria-hidden="true" />
          New camp
        </Button>
      </div>

      {/* Camp list */}
      <div className="flex flex-col gap-0 rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {isLoading
          ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }} />)
          : (camps ?? []).map((camp) => (
            <div key={camp.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
              {/* Camp row */}
              <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: 'var(--bg-elev)' }}>
                {/* Toggle */}
                <button
                  type="button"
                  className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                  onClick={() => setExpanded((p) => (p === camp.id ? null : camp.id))}
                  aria-expanded={expanded === camp.id}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}
                  >
                    <Globe size={15} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{camp.name}</span>
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}>
                      {camp.code}
                    </span>
                    <Badge variant={statusVariant(camp.status)}>{camp.status}</Badge>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {camp.active_children_count.toLocaleString()} children
                    </span>
                    {camp.district && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        <MapPin size={12} className="inline mr-0.5" aria-hidden="true" />
                        {camp.district}
                      </span>
                    )}
                  </div>
                </button>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {confirmingDelete === camp.id
                    ? (
                      <>
                        <span className="text-xs mr-1" style={{ color: 'var(--text-muted)' }}>Delete camp?</span>
                        <Button size="sm" variant="danger" loading={deleting === camp.id} onClick={() => handleDelete(camp.id)}>Yes</Button>
                        <Button size="sm" variant="secondary" onClick={() => setConfirmingDelete(null)}>No</Button>
                      </>
                    )
                    : (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(camp)}>
                          <Pencil size={13} aria-hidden="true" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(camp.id)}>
                          <Trash2 size={13} aria-hidden="true" />
                        </Button>
                      </>
                    )}
                </div>
              </div>

              {/* Zones panel */}
              {expanded === camp.id && (
                <div className="px-6 pb-5 pt-3" style={{ backgroundColor: 'var(--bg-sand)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                    Zones in {camp.name}
                  </p>
                  <ZonesPanel campId={camp.id} />
                </div>
              )}
            </div>
          ))}

        {!isLoading && (camps?.length ?? 0) === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
            <Globe size={32} className="mx-auto mb-2 opacity-40" aria-hidden="true" />
            <p className="text-sm font-medium">No camps registered yet.</p>
          </div>
        )}
      </div>

      {/* Create camp modal */}
      {showCreate && (
        <Modal title="New camp" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <CampFormFields form={createForm} onChange={setCreateForm} />
            {createError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{createError}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="submit" variant="primary" loading={creating} className="flex-1">Create camp</Button>
              <Button type="button" variant="secondary" onClick={() => { setShowCreate(false); setCreateError(''); }}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit camp modal */}
      {editingCamp && (
        <Modal title={`Edit camp — ${editingCamp.name}`} onClose={() => setEditingCamp(null)}>
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <CampFormFields form={editForm} onChange={setEditForm} />
            {editError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{editError}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="submit" variant="primary" loading={saving} className="flex-1">Save changes</Button>
              <Button type="button" variant="secondary" onClick={() => setEditingCamp(null)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
