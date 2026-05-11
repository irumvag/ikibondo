'use client';

import { useState } from 'react';
import { Baby } from 'lucide-react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useCampChildren, useAdminZones, QK } from '@/lib/api/queries';
import { closeChild, transferChildZone } from '@/lib/api/admin';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import type { SupervisedChild } from '@/lib/api/supervisor';

const STATUS_OPTIONS = [
  { value: '',       label: 'All statuses' },
  { value: 'SAM',    label: 'SAM'    },
  { value: 'MAM',    label: 'MAM'    },
  { value: 'NORMAL', label: 'Normal' },
];

const VAX_STATUS_OPTIONS = [
  { value: '',            label: 'All vaccination statuses' },
  { value: 'OVERDUE',     label: 'Overdue'                  },
  { value: 'UP_TO_DATE',  label: 'Up to date'               },
  { value: 'NOT_STARTED', label: 'Not started'              },
];

const SEX_OPTIONS = [
  { value: '',  label: 'All' },
  { value: 'M', label: 'Male'   },
  { value: 'F', label: 'Female' },
];

// ── Close modal ───────────────────────────────────────────────────────────────

function CloseModal({ child, campId, onDone, onCancel }: {
  child: SupervisedChild; campId: string; onDone: () => void; onCancel: () => void;
}) {
  const [status, setStatus] = useState<'DECEASED' | 'TRANSFERRED' | 'DEPARTED'>('DECEASED');
  const [reason, setReason] = useState('');
  const mut = useMutation({
    mutationFn: () => closeChild(child.id, { closure_status: status, reason }),
    onSuccess: onDone,
  });
  return (
    <div style={overlay}>
      <div style={modal}>
        <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700 }}>Close record — {child.full_name}</h3>
        <label style={lbl}>Closure reason</label>
        <select value={status} onChange={e => setStatus(e.target.value as never)} style={inputSt}>
          <option value="DECEASED">Deceased</option>
          <option value="TRANSFERRED">Transferred</option>
          <option value="DEPARTED">Departed</option>
        </select>
        <label style={{ ...lbl, marginTop: 10 }}>Details (required)</label>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
          style={{ ...inputSt, resize: 'vertical' }} placeholder="Provide additional context…" />
        {mut.isError && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '6px 0 0' }}>Failed to close record.</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnSec}>Cancel</button>
          <button onClick={() => mut.mutate()} disabled={!reason.trim() || mut.isPending}
            style={{ ...btnDanger, opacity: (!reason.trim() || mut.isPending) ? 0.5 : 1 }}>
            {mut.isPending ? 'Closing…' : 'Close Record'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Transfer modal ────────────────────────────────────────────────────────────

function TransferModal({ child, campId, onDone, onCancel }: {
  child: SupervisedChild; campId: string; onDone: () => void; onCancel: () => void;
}) {
  const [zoneId, setZoneId] = useState('');
  const { data: zones } = useAdminZones(campId);
  const mut = useMutation({
    mutationFn: () => transferChildZone(child.id, { zone: zoneId }),
    onSuccess: onDone,
  });
  return (
    <div style={overlay}>
      <div style={modal}>
        <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700 }}>Transfer Zone — {child.full_name}</h3>
        <label style={lbl}>New zone</label>
        <select value={zoneId} onChange={e => setZoneId(e.target.value)} style={inputSt}>
          <option value="" disabled>Select zone…</option>
          {(zones ?? []).map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        {mut.isError && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '6px 0 0' }}>Transfer failed.</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnSec}>Cancel</button>
          <button onClick={() => mut.mutate()} disabled={!zoneId || mut.isPending}
            style={{ ...btnPrimary, opacity: (!zoneId || mut.isPending) ? 0.5 : 1 }}>
            {mut.isPending ? 'Transferring…' : 'Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Columns factory ───────────────────────────────────────────────────────────

const COLUMNS = (
  onClose: (c: SupervisedChild) => void,
  onTransfer: (c: SupervisedChild) => void,
) => [
  {
    key: 'full_name', header: 'Child name', width: '180px',
    render: (v: unknown, row: unknown) => {
      const c = row as SupervisedChild;
      return (
        <div>
          <p className="font-medium text-sm" style={{ color: 'var(--ink)' }}>{v as string}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.registration_number}</p>
        </div>
      );
    },
  },
  { key: 'age_display', header: 'Age',  width: '90px'  },
  {
    key: 'sex', header: 'Sex', width: '70px',
    render: (v: unknown) => (v === 'M' ? 'Male' : 'Female'),
  },
  { key: 'camp_name',     header: 'Camp',     width: '140px', render: (v: unknown) => (v as string) || '—' },
  { key: 'guardian_name', header: 'Guardian', width: '150px', render: (v: unknown) => (v as string) || '—' },
  {
    key: 'guardian_phone', header: 'Phone', width: '130px',
    render: (v: unknown) => (v as string) || '—',
  },
  {
    key: 'is_active', header: 'Active', width: '80px',
    render: (v: unknown) => <Badge variant={v ? 'success' : 'default'}>{v ? 'Yes' : 'No'}</Badge>,
  },
  {
    key: 'id', header: '', width: '160px',
    render: (_: unknown, row: unknown) => {
      const c = row as SupervisedChild;
      return (
        <div style={{ display: 'flex', gap: 5 }}>
          <button onClick={() => onTransfer(c)} style={btnSmall}>Transfer</button>
          <button onClick={() => onClose(c)} style={{ ...btnSmall, color: 'var(--danger)' }}>Close</button>
        </div>
      );
    },
  },
];

export default function ChildrenPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const campId = user?.camp ?? '';
  const [statusFilter, setStatusFilter] = useState('');
  const [vaxFilter, setVaxFilter] = useState('');
  const [sexFilter, setSexFilter] = useState('');
  const [page, setPage] = useState(1);
  const [closeTarget, setCloseTarget] = useState<SupervisedChild | null>(null);
  const [transferTarget, setTransferTarget] = useState<SupervisedChild | null>(null);

  function invalidate() {
    qc.invalidateQueries({ queryKey: QK.campChildren(campId) });
    setCloseTarget(null);
    setTransferTarget(null);
  }

  const { data, isLoading } = useCampChildren(
    campId || undefined,
    statusFilter || undefined,
    page,
    undefined,
    vaxFilter || undefined,
  );

  // Client-side sex filter (ChildFilter handles camp + status + vaccination_status server-side)
  const displayed = sexFilter
    ? (data?.items ?? []).filter((c: SupervisedChild) => c.sex === sexFilter)
    : (data?.items ?? []);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          Children
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {data ? `${data.count.toLocaleString()} registered in your camp` : 'All registered children in your camp.'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Baby size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          aria-label="Filter by nutrition status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={vaxFilter}
          onChange={(e) => { setVaxFilter(e.target.value); setPage(1); }}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          aria-label="Filter by vaccination status"
        >
          {VAX_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={sexFilter}
          onChange={(e) => setSexFilter(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          aria-label="Filter by sex"
        >
          {SEX_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label === 'All' ? 'All sexes' : o.label}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={COLUMNS(setCloseTarget, setTransferTarget) as Parameters<typeof DataTable>[0]['columns']}
        data={displayed}
        keyField="id"
        isLoading={isLoading}
        emptyTitle="No children found"
        emptyDescription="No children match the selected filters."
        pagination={
          data && data.count > 20 && !sexFilter
            ? { page, pageSize: 20, total: data.count, onPageChange: setPage }
            : undefined
        }
      />

      {closeTarget && (
        <CloseModal child={closeTarget} campId={campId} onDone={invalidate} onCancel={() => setCloseTarget(null)} />
      )}
      {transferTarget && (
        <TransferModal child={transferTarget} campId={campId} onDone={invalidate} onCancel={() => setTransferTarget(null)} />
      )}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px',
  background: 'var(--bg-elev)', color: 'var(--ink)', fontSize: 13, width: '100%', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 };
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 999,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modal: React.CSSProperties = {
  background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 12,
  padding: 24, width: 400, maxWidth: '90vw',
};
const btnPrimary: React.CSSProperties = {
  background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8,
  padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
const btnSec: React.CSSProperties = {
  background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--ink)',
};
const btnDanger: React.CSSProperties = {
  background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8,
  padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
const btnSmall: React.CSSProperties = {
  background: 'none', border: '1px solid var(--border)', borderRadius: 6,
  padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: 'var(--ink)',
};

