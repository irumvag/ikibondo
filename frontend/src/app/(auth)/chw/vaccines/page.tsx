'use client';

import { useState } from 'react';
import { Syringe, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { administerVaccine, type VaccinationRecord } from '@/lib/api/chw';
import { useVaccinationQueue } from '@/lib/api/queries';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

const RISK_COLOR: Record<string, string> = {
  HIGH:   'var(--danger)',
  MEDIUM: 'var(--warn)',
  LOW:    'var(--success)',
};

const todayStr = () => new Date().toISOString().split('T')[0];

interface AdministerForm {
  administered_date: string;
  batch_number:      string;
  notes:             string;
}

export default function VaccinesPage() {
  const qc = useQueryClient();

  const [page,     setPage]     = useState(1);
  const [selected, setSelected] = useState<VaccinationRecord | null>(null);
  const [form,     setForm]     = useState<AdministerForm>({
    administered_date: todayStr(),
    batch_number: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState<string | null>(null);

  const { data, isLoading } = useVaccinationQueue(page);

  const items     = data?.items ?? [];
  const totalCount = data?.count ?? 0;
  const pageSize  = 30;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const openModal = (rec: VaccinationRecord) => {
    setSelected(rec);
    setForm({ administered_date: todayStr(), batch_number: '', notes: '' });
    setError('');
    setSuccess(null);
  };

  const closeModal = () => { setSelected(null); setError(''); };

  const setF = <K extends keyof AdministerForm>(k: K, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleAdminister = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError('');
    try {
      await administerVaccine(selected.id, {
        administered_date: form.administered_date || undefined,
        batch_number:      form.batch_number.trim() || undefined,
        notes:             form.notes.trim() || undefined,
      });
      await qc.invalidateQueries({ queryKey: ['vaccination-queue'] });
      setSuccess(selected.child_name);
      setSelected(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to administer vaccine. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            Vaccination queue
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {isLoading ? '—' : totalCount} scheduled{totalCount !== 1 ? ' doses' : ' dose'}
          </p>
        </div>
        {totalCount > 0 && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium"
            style={{ backgroundColor: '#fef2f2', color: 'var(--danger)' }}
          >
            <AlertCircle size={14} aria-hidden="true" />
            {totalCount} pending
          </div>
        )}
      </div>

      {/* Success banner */}
      {success && (
        <div
          className="rounded-xl px-4 py-3 text-sm font-medium"
          style={{ backgroundColor: '#f0fdf4', color: 'var(--success)', borderLeft: '3px solid var(--success)' }}
        >
          Vaccine administered for {success}.
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Syringe size={32} />}
          title="Queue empty"
          description="No scheduled doses at this time."
        />
      ) : (
        <>
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div className="overflow-x-auto">
            {/* Head */}
            <div
              className="grid grid-cols-[1fr_1fr_130px_90px_80px_90px] gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider min-w-[680px]"
              style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-elev)', borderBottom: '1px solid var(--border)' }}
            >
              <span>Child</span>
              <span>Zone / Guardian</span>
              <span>Vaccine</span>
              <span>Scheduled</span>
              <span>Overdue</span>
              <span>Dropout</span>
            </div>

            {/* Rows */}
            {items.map((rec) => (
              <button
                key={rec.id}
                type="button"
                onClick={() => openModal(rec)}
                className="w-full grid grid-cols-[1fr_1fr_130px_90px_80px_90px] gap-3 items-center px-4 py-3.5 border-b text-left hover:bg-[var(--bg-sand)] transition-colors min-w-[680px]"
                style={{ borderColor: 'var(--border)' }}
              >
                <span className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                  {rec.child_name}
                </span>
                <span className="flex flex-col gap-0.5 min-w-0">
                  {rec.zone_name && (
                    <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      📍 {rec.zone_name}
                    </span>
                  )}
                  {rec.guardian_name && (
                    <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {rec.guardian_name}
                    </span>
                  )}
                </span>
                <span className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
                  {rec.vaccine_name}{' '}
                  <span className="font-mono text-xs">({rec.vaccine_code})</span>
                </span>
                <span className="text-xs whitespace-nowrap" style={{ color: 'var(--ink)' }}>
                  {rec.scheduled_date}
                </span>
                <span>
                  {rec.is_overdue && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: '#fef2f2', color: 'var(--danger)' }}
                    >
                      Overdue
                    </span>
                  )}
                </span>
                <span>
                  {rec.dropout_risk_tier && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${RISK_COLOR[rec.dropout_risk_tier] ?? 'var(--text-muted)'}20`,
                        color: RISK_COLOR[rec.dropout_risk_tier] ?? 'var(--text-muted)',
                      }}
                    >
                      {rec.dropout_risk_tier}
                    </span>
                  )}
                </span>
              </button>
            ))}
            </div>{/* /overflow-x-auto */}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-muted)' }}>
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft size={14} aria-hidden="true" /> Prev
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next <ChevronRight size={14} aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Administer modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            className="w-full sm:max-w-md rounded-2xl p-6 flex flex-col gap-5 shadow-xl"
            style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Syringe size={18} style={{ color: 'var(--ink)' }} aria-hidden="true" />
                <h3
                  className="text-lg font-bold"
                  style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
                >
                  Administer vaccine
                </h3>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {selected.child_name} &middot; {selected.vaccine_name} ({selected.vaccine_code})
              </p>
              {(selected.zone_name || selected.guardian_name) && (
                <p className="text-xs mt-0.5 flex gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                  {selected.zone_name && <span>📍 {selected.zone_name}</span>}
                  {selected.guardian_name && <span>👤 {selected.guardian_name}{selected.guardian_phone ? ` · ${selected.guardian_phone}` : ''}</span>}
                </p>
              )}
            </div>

            <Input
              label="Date administered"
              type="date"
              value={form.administered_date}
              onChange={(e) => setF('administered_date', e.target.value)}
              required
            />
            <Input
              label="Batch number (optional)"
              value={form.batch_number}
              onChange={(e) => setF('batch_number', e.target.value)}
              placeholder="e.g. BCG2024-01"
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                Notes <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(optional)</span>
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setF('notes', e.target.value)}
                rows={2}
                placeholder="Any observations..."
                className="w-full px-3 py-2.5 rounded-xl border text-sm resize-none bg-[var(--bg-elev)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ink)] border-[var(--border)]"
              />
            </div>

            {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                loading={submitting}
                onClick={handleAdminister}
              >
                Confirm &amp; record
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
