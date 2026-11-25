'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/contexts/ToastContext';
import { useAdminCamps } from '@/lib/api/queries';
import {
  createOrganization, deleteOrganization, listOrganizations, updateOrganization,
  type Organization, type OrganizationInput,
} from '@/lib/api/admin';

const EMPTY: OrganizationInput = { name: '', kind: 'NGO', camps: [], is_active: true };
const inputStyle = { borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' };

/**
 * Government bodies and partner organisations. Their members see aggregated statistics
 * (Overview, Reports) for the camps listed here — never a child's record.
 */
export default function OrganizationsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: orgs, isLoading } = useQuery({ queryKey: ['organizations'], queryFn: listOrganizations });
  const { data: camps } = useAdminCamps();
  const [editing, setEditing] = useState<{ id: string | null; form: OrganizationInput } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (patch: Partial<OrganizationInput>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));
  const toggleCamp = (id: string) => setEditing((e) => e && {
    ...e, form: { ...e.form, camps: e.form.camps.includes(id) ? e.form.camps.filter((c) => c !== id) : [...e.form.camps, id] },
  });

  const save = async () => {
    if (!editing) return;
    if (!editing.form.name.trim()) { setError('Give the organisation a name.'); return; }
    setSaving(true); setError('');
    try {
      if (editing.id) await updateOrganization(editing.id, editing.form);
      else await createOrganization(editing.form);
      await qc.invalidateQueries({ queryKey: ['organizations'] });
      toast.success(editing.id ? 'Organisation updated' : 'Organisation added');
      setEditing(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Could not save the organisation.');
    } finally { setSaving(false); }
  };

  const remove = async (o: Organization) => {
    if (!window.confirm(`Remove ${o.name}? Its ${o.member_count} member account(s) will see no statistics until moved to another organisation.`)) return;
    try {
      await deleteOrganization(o.id);
      await qc.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Organisation removed');
    } catch {
      toast.error('Could not remove the organisation.');
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>Organisations</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Government bodies and NGO/UN partners. Their staff see statistics for the camps listed — never a child&apos;s record.
            Add their accounts in Users with the Government or NGO partner role.
          </p>
        </div>
        <Button variant="primary" onClick={() => { setError(''); setEditing({ id: null, form: EMPTY }); }}>
          <Plus size={15} className="mr-1.5" aria-hidden="true" /> New organisation
        </Button>
      </div>

      {editing && (
        <div className="rounded-2xl border p-5 flex flex-col gap-4 animate-pop" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Name</span>
              <input value={editing.form.name} onChange={(e) => set({ name: e.target.value })}
                className="text-sm px-3 py-2 rounded-lg border outline-none" style={inputStyle}
                placeholder="e.g. Ministry of Health, UNICEF Rwanda" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Type</span>
              <select value={editing.form.kind} onChange={(e) => set({ kind: e.target.value as OrganizationInput['kind'] })}
                className="text-sm px-3 py-2 rounded-lg border outline-none" style={inputStyle}>
                <option value="GOVERNMENT">Government body</option>
                <option value="NGO">NGO / UN agency</option>
              </select>
            </label>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium mb-1" style={{ color: 'var(--ink)' }}>Camps covered</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {(camps ?? []).map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer select-none" style={{ color: 'var(--ink)' }}>
                  <input type="checkbox" className="w-4 h-4" checked={editing.form.camps.includes(c.id)} onChange={() => toggleCamp(c.id)} />
                  {c.name}
                </label>
              ))}
            </div>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {editing.form.kind === 'GOVERNMENT'
                ? 'Leave all unticked for a national body that oversees every camp.'
                : 'An NGO with no camps ticked sees nothing.'}
            </span>
          </fieldset>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none" style={{ color: 'var(--ink)' }}>
            <input type="checkbox" className="w-4 h-4" checked={editing.form.is_active} onChange={(e) => set({ is_active: e.target.checked })} />
            Active (members can see statistics)
          </label>
          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <div className="flex gap-2">
            <Button variant="primary" loading={saving} onClick={save}>{editing.id ? 'Save' : 'Add organisation'}</Button>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (orgs ?? []).length === 0 ? (
        <div className="rounded-2xl border p-10 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
          <Building2 size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No organisations yet.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 stagger">
          {(orgs ?? []).map((o) => (
            <li key={o.id} className="rounded-xl border px-4 py-3 flex items-start gap-3"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{o.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {o.camp_names.length > 0
                    ? o.camp_names.join(', ')
                    : o.kind === 'GOVERNMENT' ? 'All camps' : 'No camps yet'}
                  {` · ${o.member_count} member${o.member_count === 1 ? '' : 's'}`}
                </p>
              </div>
              <Badge variant={o.kind === 'GOVERNMENT' ? 'info' : 'default'}>{o.kind === 'GOVERNMENT' ? 'Government' : 'NGO / UN'}</Badge>
              {!o.is_active && <Badge variant="warn">Inactive</Badge>}
              <button type="button" aria-label={`Edit ${o.name}`}
                onClick={() => { setError(''); setEditing({ id: o.id, form: { name: o.name, kind: o.kind, camps: o.camps, is_active: o.is_active } }); }}>
                <Pencil size={15} style={{ color: 'var(--text-muted)' }} />
              </button>
              <button type="button" aria-label={`Remove ${o.name}`} onClick={() => remove(o)}>
                <Trash2 size={15} style={{ color: 'var(--danger)' }} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
