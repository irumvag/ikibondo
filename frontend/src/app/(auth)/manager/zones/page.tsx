'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, X, Check } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAdminZones, QK } from '@/lib/api/queries';
import { createZone, updateZone, deleteZone } from '@/lib/api/admin';
import type { Zone } from '@/lib/api/admin';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

interface ZoneForm {
  name: string;
  code: string;
  description: string;
  estimated_households: string;
  estimated_population: string;
  status: string;
}

const EMPTY_FORM: ZoneForm = {
  name: '', code: '', description: '',
  estimated_households: '', estimated_population: '',
  status: 'ACTIVE',
};

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

export default function ManagerZonesPage() {
  const user   = useAuthStore((s) => s.user);
  const campId = user?.camp ?? '';
  const qc     = useQueryClient();

  const { data: zones = [], isLoading } = useAdminZones(campId);

  const [showCreate, setShowCreate]   = useState(false);
  const [editing,    setEditing]      = useState<Zone | null>(null);
  const [form,       setForm]         = useState<ZoneForm>(EMPTY_FORM);
  const [saving,     setSaving]       = useState(false);
  const [saveError,  setSaveError]    = useState('');
  const [toast,      setToast]        = useState('');
  const [deleting,   setDeleting]     = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: QK.adminZones(campId) });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSaveError('');
    setShowCreate(true);
  }

  function openEdit(z: Zone) {
    setEditing(z);
    setForm({
      name:                 z.name,
      code:                 z.code,
      description:          z.description ?? '',
      estimated_households: z.estimated_households?.toString() ?? '',
      estimated_population: z.estimated_population?.toString() ?? '',
      status:               z.status,
    });
    setSaveError('');
    setShowCreate(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!campId) return;
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        name:        form.name,
        code:        form.code,
        description: form.description || undefined,
        estimated_households: form.estimated_households ? parseInt(form.estimated_households) : undefined,
        estimated_population: form.estimated_population ? parseInt(form.estimated_population) : undefined,
        status:      form.status,
      };
      if (editing) {
        await updateZone(campId, editing.id, payload);
        setToast(`Zone "${form.name}" updated.`);
      } else {
        await createZone(campId, payload);
        setToast(`Zone "${form.name}" created.`);
      }
      await invalidate();
      setShowCreate(false);
      setEditing(null);
      setTimeout(() => setToast(''), 4000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSaveError(msg ?? 'Failed to save zone. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(z: Zone) {
    if (!confirm(`Delete zone "${z.name}"? This cannot be undone.`)) return;
    setDeleting(z.id);
    try {
      await deleteZone(campId, z.id);
      await invalidate();
      setToast(`Zone "${z.name}" deleted.`);
      setTimeout(() => setToast(''), 4000);
    } catch {
      alert('Failed to delete zone.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
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
          <Check size={15} style={{ color: 'var(--success)' }} aria-hidden="true" />
          <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            Zones
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {user?.camp_name ?? 'Your camp'} — manage geographic zones
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          <Plus size={16} className="mr-1.5" aria-hidden="true" />
          Add zone
        </Button>
      </div>

      {/* Zone list */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : zones.length === 0 ? (
        <EmptyState
          icon={<MapPin size={28} />}
          title="No zones yet"
          description="Add zones to organise your camp into areas managed by CHWs."
          action={{ label: 'Add first zone', onClick: openCreate }}
        />
      ) : (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
        >
          {zones.map((z) => (
            <div
              key={z.id}
              className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0 flex-wrap"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{z.name}</p>
                  <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}>
                    {z.code}
                  </span>
                  <Badge variant={z.is_active ? 'success' : 'default'}>{z.status}</Badge>
                </div>
                {z.description && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{z.description}</p>
                )}
                <div className="flex gap-4 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {z.estimated_households != null && <span>{z.estimated_households.toLocaleString()} households</span>}
                  {z.estimated_population != null && <span>{z.estimated_population.toLocaleString()} people</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="secondary" onClick={() => openEdit(z)}>
                  Edit
                </Button>
                <button
                  type="button"
                  onClick={() => handleDelete(z)}
                  disabled={deleting === z.id}
                  className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--high-bg)] disabled:opacity-50"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label={`Delete zone ${z.name}`}
                >
                  {deleting === z.id ? '…' : <X size={14} aria-hidden="true" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit modal */}
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
              {editing ? 'Edit zone' : 'New zone'}
            </h3>

            <form onSubmit={handleSave} className="flex flex-col gap-3">
              <Input
                label="Zone name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="e.g. North Block A"
              />
              <Input
                label="Zone code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
                placeholder="e.g. NBA-01"
              />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Status</label>
                <div className="flex gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm({ ...form, status: s })}
                      className="flex-1 py-2 rounded-xl border text-xs font-medium transition-colors"
                      style={{
                        borderColor:     form.status === s ? 'var(--ink)' : 'var(--border)',
                        backgroundColor: form.status === s ? 'var(--ink)' : 'transparent',
                        color:           form.status === s ? 'var(--bg)'  : 'var(--text-muted)',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Est. households"
                  type="number"
                  value={form.estimated_households}
                  onChange={(e) => setForm({ ...form, estimated_households: e.target.value })}
                  placeholder="e.g. 500"
                />
                <Input
                  label="Est. population"
                  type="number"
                  value={form.estimated_population}
                  onChange={(e) => setForm({ ...form, estimated_population: e.target.value })}
                  placeholder="e.g. 2500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Description (optional)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="Brief description of this zone..."
                  className="px-3 py-2 rounded-xl border text-sm resize-none outline-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
                />
              </div>

              {saveError && (
                <p className="text-xs" style={{ color: 'var(--danger)' }}>{saveError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <Button type="submit" variant="primary" loading={saving} className="flex-1">
                  {editing ? 'Save changes' : 'Create zone'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { setShowCreate(false); setSaveError(''); }}
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
