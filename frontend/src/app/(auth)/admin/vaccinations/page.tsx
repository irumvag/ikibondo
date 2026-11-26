'use client';

import { useTranslations } from 'next-intl';
import { useState, useCallback } from 'react';
import {
  Filter, Trash2, Plus, Edit2, Check, X,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  listVaccinations, deleteVaccination, updateVaccination, createVaccination,
  listVaccines, listCamps,
  type VaccinationRecord,
} from '@/lib/api/admin';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusVariant(s: string) {
  if (s === 'DONE') return 'success';
  if (s === 'MISSED') return 'danger';
  if (s === 'SKIPPED') return 'warn';
  return 'default';
}

function dropoutVariant(t: string | null) {
  if (t === 'HIGH') return 'danger';
  if (t === 'MEDIUM') return 'warn';
  if (t === 'LOW') return 'success';
  return 'default';
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditModal({
  record,
  onClose,
  onSaved,
}: {
  record: VaccinationRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const tt = useTranslations('admin.vaccinations');
  const [form, setForm] = useState({
    status: record.status,
    scheduled_date: record.scheduled_date,
    administered_date: record.administered_date ?? '',
    batch_number: record.batch_number ?? '',
    notes: record.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await updateVaccination(record.id, {
        status: form.status,
        scheduled_date: form.scheduled_date,
        administered_date: form.administered_date || undefined,
        batch_number: form.batch_number || undefined,
        notes: form.notes || undefined,
      });
      onSaved();
      onClose();
    } catch {
      setError(tt('failedToSavePlease'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div
        className="w-full max-w-md rounded-2xl border p-6 flex flex-col gap-4"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}
      >
        <div className="flex items-center justify-between">
          <p className="font-semibold text-base" style={{ color: 'var(--ink)' }}>{tt('editVaccination')}</p>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={18} aria-label={tt('close')} />
          </button>
        </div>

        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{tt('dose', { child_name: record.child_name, vaccine_name: record.vaccine_name, dose_number: record.dose_number })}</div>

        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="vaccinations-status" className="text-sm font-medium mb-1 block" style={{ color: 'var(--ink)' }}>{tt('status')}</label>
            <select id="vaccinations-status"
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as 'SCHEDULED' | 'DONE' | 'MISSED' | 'SKIPPED' }))}
              className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
            >
              {['SCHEDULED', 'DONE', 'MISSED', 'SKIPPED'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <Input
            label={tt('scheduledDate')}
            type="date"
            value={form.scheduled_date}
            onChange={(e) => setForm((p) => ({ ...p, scheduled_date: e.target.value }))}
          />
          <Input
            label={tt('administeredDate')}
            type="date"
            value={form.administered_date}
            onChange={(e) => setForm((p) => ({ ...p, administered_date: e.target.value }))}
          />
          <Input
            label={tt('batchNumber')}
            value={form.batch_number}
            onChange={(e) => setForm((p) => ({ ...p, batch_number: e.target.value }))}
          />
          <Input
            label={tt('notes')}
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          />
        </div>

        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>{tt('cancel')}</Button>
          <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
            <Check size={14} className="mr-1" aria-hidden="true" />{tt('save')}</Button>
        </div>
      </div>
    </div>
  );
}

// ── Create modal ──────────────────────────────────────────────────────────────

function CreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const tt = useTranslations('admin.vaccinations');
  const { data: vaccines } = useQuery({ queryKey: ['vaccines-all'], queryFn: () => listVaccines() });
  const [form, setForm] = useState({ child: '', vaccine: '', scheduled_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.child || !form.vaccine || !form.scheduled_date) {
      setError(tt('childIdVaccineAnd'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createVaccination({ child: form.child, vaccine: form.vaccine, scheduled_date: form.scheduled_date, notes: form.notes });
      onSaved();
      onClose();
    } catch {
      setError(tt('failedToCreateCheck'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div
        className="w-full max-w-md rounded-2xl border p-6 flex flex-col gap-4"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}
      >
        <div className="flex items-center justify-between">
          <p className="font-semibold text-base" style={{ color: 'var(--ink)' }}>{tt('addVaccinationRecord')}</p>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={18} aria-label={tt('close')} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <Input
            label={tt('childIdUuid')}
            value={form.child}
            onChange={(e) => setForm((p) => ({ ...p, child: e.target.value }))}
            placeholder="e.g. a1b2c3d4-..."
          />
          <div>
            <label htmlFor="vaccinations-vaccine" className="text-sm font-medium mb-1 block" style={{ color: 'var(--ink)' }}>{tt('vaccine')}</label>
            <select id="vaccinations-vaccine"
              value={form.vaccine}
              onChange={(e) => setForm((p) => ({ ...p, vaccine: e.target.value }))}
              className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
            >
              <option value="">{tt('selectVaccine')}</option>
              {(vaccines ?? []).map((v) => (
                <option key={v.id} value={v.id}>{tt('dose2', { name: v.name, dose_number: v.dose_number })}</option>
              ))}
            </select>
          </div>
          <Input
            label={tt('scheduledDate')}
            type="date"
            value={form.scheduled_date}
            onChange={(e) => setForm((p) => ({ ...p, scheduled_date: e.target.value }))}
          />
          <Input
            label={tt('notes')}
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          />
        </div>

        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>{tt('cancel')}</Button>
          <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
            <Plus size={14} className="mr-1" aria-hidden="true" />{tt('create')}</Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function AdminVaccinationsPage() {
  const tt = useTranslations('admin.vaccinations');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [campFilter, setCampFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<VaccinationRecord | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: camps } = useQuery({ queryKey: ['camps'], queryFn: listCamps });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-vaccinations', page, campFilter, statusFilter],
    queryFn: () => listVaccinations({
      camp: campFilter || undefined,
      status: statusFilter || undefined,
      page,
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVaccination,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-vaccinations'] }),
  });

  const records = data?.results ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-vaccinations'] });
  }, [queryClient]);

  const handleDelete = (id: string, childName: string) => {
    if (!confirm(tt('confirmDelete', { name: childName }))) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >{tt('vaccinations')}</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{tt('recordsFullCrud', { total: total.toLocaleString() })}</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={15} className="mr-1.5" aria-hidden="true" />{tt('addRecord')}</Button>
      </div>

      {/* Filters */}
      <div
        className="flex flex-wrap gap-3 p-4 rounded-xl border"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{tt('filter')}</span>
        </div>
        <select
          value={campFilter}
          onChange={(e) => { setCampFilter(e.target.value); setPage(1); }}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
        >
          <option value="">{tt('allCamps')}</option>
          {(camps ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
        >
          <option value="">{tt('allStatuses')}</option>
          {['SCHEDULED', 'DONE', 'MISSED', 'SKIPPED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-sand)' }}>
                {['Child', 'Vaccine', 'Dose', 'Scheduled', 'Status', 'Dropout risk', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold whitespace-nowrap"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      {[0,1,2,3,4,5,6].map((j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 rounded" /></td>
                      ))}
                    </tr>
                  ))
                : records.length === 0
                ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{tt('noVaccinationRecordsFound')}</td>
                    </tr>
                  )
                : records.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t hover:bg-[var(--bg-sand)] transition-colors"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: 'var(--ink)' }}>
                        {r.child_name}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--ink)' }}>
                        {r.vaccine_name}
                      </td>
                      <td className="px-4 py-3 text-center" style={{ color: 'var(--text-muted)' }}>
                        {r.dose_number}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--text-muted)' }}>
                        {r.scheduled_date}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                        {r.is_overdue && r.status === 'SCHEDULED' && (
                          <span className="ml-1 text-xs" style={{ color: 'var(--danger)' }}>{tt('overdue')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.dropout_risk_tier ? (
                          <Badge variant={dropoutVariant(r.dropout_risk_tier)}>
                            {r.dropout_risk_tier}
                          </Badge>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditing(r)}
                            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg)]"
                            style={{ color: 'var(--text-muted)' }}
                            title={tt('edit')}
                          >
                            <Edit2 size={14} aria-label={tt('edit')} />
                          </button>
                          <button
                            onClick={() => handleDelete(r.id, r.child_name)}
                            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg)]"
                            style={{ color: 'var(--danger)' }}
                            title={tt('delete')}
                          >
                            <Trash2 size={14} aria-label={tt('delete')} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-between px-5 py-3 border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{tt('pageOfRecords', { page: page, totalPages: totalPages, total: total.toLocaleString() })}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={14} aria-hidden="true" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight size={14} aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {editing && (
        <EditModal record={editing} onClose={() => setEditing(null)} onSaved={handleRefresh} />
      )}
      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onSaved={handleRefresh} />
      )}
    </div>
  );
}
