'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Link from 'next/link';
import { Baby, ArrowRight, AlertTriangle } from 'lucide-react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useCampChildren, useAdminZones, QK } from '@/lib/api/queries';
import { closeChild, transferChildZone } from '@/lib/api/admin';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import type { SupervisedChild } from '@/lib/api/supervisor';

type ColumnsT = ReturnType<typeof useTranslations<'supervisor.children'>>;

type ChildWithDeletion = SupervisedChild & { deletion_requested_at?: string | null };

const STATUS_OPTIONS = (t: ColumnsT) => [
  { value: '',       label: t('optAllStatuses') },
  { value: 'SAM',    label: 'SAM'    },
  { value: 'MAM',    label: 'MAM'    },
  { value: 'NORMAL', label: t('optNormal') },
];

const VAX_STATUS_OPTIONS = (t: ColumnsT) => [
  { value: '',            label: t('optAllVaccinationStatuses') },
  { value: 'OVERDUE',     label: t('optOverdue')                  },
  { value: 'UP_TO_DATE',  label: t('optUpToDate')               },
  { value: 'NOT_STARTED', label: t('optNotStarted')              },
];

const SEX_OPTIONS = (t: ColumnsT) => [
  { value: '',  label: t('optAll') },
  { value: 'M', label: t('optMale')   },
  { value: 'F', label: t('optFemale') },
];

// ── Close modal ───────────────────────────────────────────────────────────────

function CloseModal({ child, onDone, onCancel }: {
  child: SupervisedChild; campId: string; onDone: () => void; onCancel: () => void;
}) {
  const t = useTranslations('supervisor.children');
  const [status, setStatus] = useState<'DECEASED' | 'TRANSFERRED' | 'DEPARTED'>('DECEASED');
  const [reason, setReason] = useState('');
  const mut = useMutation({
    mutationFn: () => closeChild(child.id, { status, reason }),
    onSuccess: onDone,
  });
  return (
    <div style={overlay}>
      <div style={modal}>
        <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700 }}>{t('closeRecord', { full_name: child.full_name })}</h3>
        <label htmlFor="children-closure-reason" style={lbl}>{t('closureReason')}</label>
        <select id="children-closure-reason" value={status} onChange={e => setStatus(e.target.value as never)} style={inputSt}>
          <option value="DECEASED">{t('deceased')}</option>
          <option value="TRANSFERRED">{t('transferred')}</option>
          <option value="DEPARTED">{t('departed')}</option>
        </select>
        <label htmlFor="children-details-required" style={{ ...lbl, marginTop: 10 }}>{t('detailsRequired')}</label>
        <textarea id="children-details-required" value={reason} onChange={e => setReason(e.target.value)} rows={3}
          style={{ ...inputSt, resize: 'vertical' }} placeholder={t('provideAdditionalContext')} />
        {mut.isError && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '6px 0 0' }}>{t('failedToCloseRecord')}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnSec}>{t('cancel')}</button>
          <button onClick={() => mut.mutate()} disabled={!reason.trim() || mut.isPending}
            style={{ ...btnDanger, opacity: (!reason.trim() || mut.isPending) ? 0.5 : 1 }}>
            {mut.isPending ? t('closing') : t('closeRecord2')}
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
  const t = useTranslations('supervisor.children');
  const [zoneId, setZoneId] = useState('');
  const { data: zones } = useAdminZones(campId);
  const mut = useMutation({
    mutationFn: () => transferChildZone(child.id, { zone: zoneId }),
    onSuccess: onDone,
  });
  return (
    <div style={overlay}>
      <div style={modal}>
        <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700 }}>{t('transferZone', { full_name: child.full_name })}</h3>
        <label htmlFor="children-new-zone" style={lbl}>{t('newZone')}</label>
        <select id="children-new-zone" value={zoneId} onChange={e => setZoneId(e.target.value)} style={inputSt}>
          <option value="" disabled>{t('selectZone')}</option>
          {(zones ?? []).map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        {mut.isError && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '6px 0 0' }}>{t('transferFailed')}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnSec}>{t('cancel')}</button>
          <button onClick={() => mut.mutate()} disabled={!zoneId || mut.isPending}
            style={{ ...btnPrimary, opacity: (!zoneId || mut.isPending) ? 0.5 : 1 }}>
            {mut.isPending ? t('transferring') : t('transfer')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Columns factory ───────────────────────────────────────────────────────────

const COLUMNS = (
  t: ColumnsT,
  onClose: (c: SupervisedChild) => void,
  onTransfer: (c: SupervisedChild) => void,
) => [
  {
    key: 'full_name', header: t('colChild'), width: '220px',
    render: (v: unknown, row: unknown) => {
      const c = row as ChildWithDeletion;
      return (
        <Link href={`/nurse/children/${c.id}`} className="flex items-center gap-2 group">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-sm group-hover:underline" style={{ color: 'var(--ink)' }}>
                {v as string}
              </p>
              {c.deletion_requested_at && (
                <span title={t('deletionPending')}><AlertTriangle size={12} style={{ color: 'var(--danger)' }} /></span>
              )}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.registration_number}</p>
          </div>
          <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        </Link>
      );
    },
  },
  { key: 'age_display', header: t('colAge'),  width: '90px'  },
  {
    key: 'sex', header: t('colSex'), width: '70px',
    render: (v: unknown) => (v === 'M' ? t('male') : t('female')),
  },
  { key: 'camp_name',     header: t('colCamp'),     width: '140px', render: (v: unknown) => (v as string) || '—' },
  { key: 'guardian_name', header: t('colGuardian'), width: '150px', render: (v: unknown) => (v as string) || '—' },
  {
    key: 'guardian_phone', header: t('colPhone'), width: '130px',
    render: (v: unknown) => (v as string) || '—',
  },
  {
    key: 'is_active', header: t('colActive'), width: '80px',
    render: (v: unknown) => <Badge variant={v ? 'success' : 'default'}>{v ? t('yes') : t('no')}</Badge>,
  },
  {
    key: 'id', header: '', width: '160px',
    render: (_: unknown, row: unknown) => {
      const c = row as SupervisedChild;
      return (
        <div style={{ display: 'flex', gap: 5 }}>
          <button onClick={() => onTransfer(c)} style={btnSmall}>{t('transfer')}</button>
          <button onClick={() => onClose(c)} style={{ ...btnSmall, color: 'var(--danger)' }}>{t('close')}</button>
        </div>
      );
    },
  },
];

export default function ChildrenPage() {
  const t = useTranslations('supervisor.children');
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const campId = user?.camp ?? '';
  const [statusFilter, setStatusFilter] = useState('');
  const [vaxFilter, setVaxFilter] = useState('');
  const [sexFilter, setSexFilter] = useState('');
  const [search, setSearch] = useState('');
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
    search || undefined,
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
        >{t('children')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {data ? t('registeredInCamp', { count: data.count }) : t('allRegisteredChildrenIn')}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Baby size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t('searchByNameOr')}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none flex-1 min-w-[200px]"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          aria-label={t('searchChildren')}
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          aria-label={t('filterByNutritionStatus')}
        >
          {STATUS_OPTIONS(t).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={vaxFilter}
          onChange={(e) => { setVaxFilter(e.target.value); setPage(1); }}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          aria-label={t('filterByVaccinationStatus')}
        >
          {VAX_STATUS_OPTIONS(t).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={sexFilter}
          onChange={(e) => setSexFilter(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
          aria-label={t('filterBySex')}
        >
          {SEX_OPTIONS(t).map((o) => (
            <option key={o.value} value={o.value}>{o.label === 'All' ? t('allSexes') : o.label}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={COLUMNS(t, setCloseTarget, setTransferTarget) as Parameters<typeof DataTable>[0]['columns']}
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
  background: 'var(--ink)', color: 'var(--bg)', border: 'none', borderRadius: 8,
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

