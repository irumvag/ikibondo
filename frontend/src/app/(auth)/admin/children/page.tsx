'use client';

import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Baby, Search, X, ExternalLink, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useAdminChildren, useAdminCamps, QK } from '@/lib/api/queries';
import { closeChild, transferChildZone, listZones } from '@/lib/api/admin';
import type { AdminChild } from '@/lib/api/admin';

// ── helpers ──────────────────────────────────────────────────────────────────

function riskBadge(level: string | null) {
  if (!level) return null;
  const map: Record<string, string> = {
    HIGH:   'var(--danger)',
    MEDIUM: 'var(--warn)',
    LOW:    'var(--success)',
  };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
      background: `color-mix(in srgb, ${map[level] ?? 'var(--ink)'} 12%, var(--bg-elev))`,
      color: map[level] ?? 'var(--ink)',
    }}>
      {level}
    </span>
  );
}

function nutBadge(status: string | null) {
  if (!status) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>;
  const map: Record<string, string> = {
    SAM: 'var(--danger)', MAM: 'var(--warn)', NORMAL: 'var(--success)',
  };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
      background: `color-mix(in srgb, ${map[status] ?? 'var(--ink)'} 12%, var(--bg-elev))`,
      color: map[status] ?? 'var(--ink)',
    }}>
      {status}
    </span>
  );
}

function age(dob: string) {
  const months = Math.floor(
    (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44),
  );
  if (months < 24) return `${months}m`;
  return `${Math.floor(months / 12)}y`;
}

// ── Close modal ───────────────────────────────────────────────────────────────

function CloseModal({
  child, onDone, onCancel,
}: { child: AdminChild; onDone: () => void; onCancel: () => void }) {
  const [status, setStatus] = useState<'DECEASED' | 'TRANSFERRED' | 'DEPARTED'>('DECEASED');
  const [reason, setReason] = useState('');
  const mut = useMutation({
    mutationFn: () => closeChild(child.id, { closure_status: status, reason }),
    onSuccess: onDone,
  });
  return (
    <div style={overlay}>
      <div style={modal}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Close record — {child.full_name}</h3>
        <label style={lbl}>Closure reason</label>
        <select value={status} onChange={e => setStatus(e.target.value as never)} style={input}>
          <option value="DECEASED">Deceased</option>
          <option value="TRANSFERRED">Transferred</option>
          <option value="DEPARTED">Departed</option>
        </select>
        <label style={{ ...lbl, marginTop: 10 }}>Details (required)</label>
        <textarea
          value={reason} onChange={e => setReason(e.target.value)}
          rows={3} style={{ ...input, resize: 'vertical' }}
          placeholder="Provide additional context…"
        />
        {mut.isError && (
          <p style={{ color: 'var(--danger)', fontSize: 13, margin: '6px 0 0' }}>
            Failed to close record.
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnSecondary}>Cancel</button>
          <button
            onClick={() => mut.mutate()}
            disabled={!reason.trim() || mut.isPending}
            style={{ ...btnDanger, opacity: (!reason.trim() || mut.isPending) ? 0.5 : 1 }}
          >
            {mut.isPending ? 'Closing…' : 'Close Record'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Transfer modal ────────────────────────────────────────────────────────────

function TransferModal({
  child, onDone, onCancel,
}: { child: AdminChild; onDone: () => void; onCancel: () => void }) {
  const [zoneId, setZoneId] = useState('');
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const { data: camps } = useAdminCamps();

  async function loadZones(campId: string) {
    try {
      const z = await listZones(campId);
      setZones(z);
    } catch { setZones([]); }
  }

  const mut = useMutation({
    mutationFn: () => transferChildZone(child.id, { zone: zoneId }),
    onSuccess: onDone,
  });

  return (
    <div style={overlay}>
      <div style={modal}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Transfer Zone — {child.full_name}</h3>
        <label style={lbl}>Camp</label>
        <select style={input} onChange={e => loadZones(e.target.value)} defaultValue="">
          <option value="" disabled>Select camp…</option>
          {camps?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {zones.length > 0 && (
          <>
            <label style={{ ...lbl, marginTop: 10 }}>Zone</label>
            <select value={zoneId} onChange={e => setZoneId(e.target.value)} style={input}>
              <option value="" disabled>Select zone…</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </>
        )}
        {mut.isError && (
          <p style={{ color: 'var(--danger)', fontSize: 13, margin: '6px 0 0' }}>
            Transfer failed.
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnSecondary}>Cancel</button>
          <button
            onClick={() => mut.mutate()}
            disabled={!zoneId || mut.isPending}
            style={{ ...btnPrimary, opacity: (!zoneId || mut.isPending) ? 0.5 : 1 }}
          >
            {mut.isPending ? 'Transferring…' : 'Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminChildrenPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [camp, setCamp] = useState('');
  const [page, setPage] = useState(1);
  const [closeTarget, setCloseTarget] = useState<AdminChild | null>(null);
  const [transferTarget, setTransferTarget] = useState<AdminChild | null>(null);

  const { data: camps } = useAdminCamps();
  const { data, isLoading, isError } = useAdminChildren({
    search: search || undefined,
    camp: camp || undefined,
    page,
  });

  const total = data?.count ?? 0;
  const children = data?.results ?? [];
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  function invalidate() {
    qc.invalidateQueries({ queryKey: QK.adminChildren() });
    setCloseTarget(null);
    setTransferTarget(null);
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Baby size={22} />
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Children</h1>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 13 }}>
          {total} total
        </span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            placeholder="Search name or reg #…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ ...input, paddingLeft: 32, width: '100%', boxSizing: 'border-box' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={13} color="var(--text-muted)" />
            </button>
          )}
        </div>
        <select value={camp} onChange={e => { setCamp(e.target.value); setPage(1); }} style={{ ...input, flex: '0 0 180px' }}>
          <option value="">All camps</option>
          {camps?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : isError ? (
        <p style={{ color: 'var(--danger)' }}>Failed to load children.</p>
      ) : children.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          <Baby size={36} style={{ marginBottom: 8, opacity: 0.4 }} />
          <p>No children found.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={th}>Name</th>
                <th style={th}>Reg #</th>
                <th style={th}>Camp / Zone</th>
                <th style={th}>Age / Sex</th>
                <th style={th}>Risk</th>
                <th style={th}>Nutrition</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {children.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={td}>
                    <span style={{ fontWeight: 600 }}>{c.full_name}</span>
                  </td>
                  <td style={td}><code style={{ fontSize: 11 }}>{c.registration_number}</code></td>
                  <td style={td}>
                    <span>{c.camp_name}</span>
                    {c.zone_name && <><br /><span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{c.zone_name}</span></>}
                  </td>
                  <td style={td}>{age(c.date_of_birth)} / {c.sex}</td>
                  <td style={td}>{riskBadge(c.risk_level)}</td>
                  <td style={td}>{nutBadge(c.nutrition_status)}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <Link
                      href={`/nurse/children/${c.id}`}
                      style={{ color: 'var(--primary)', fontSize: 12, marginRight: 8, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                    >
                      <ExternalLink size={12} /> View
                    </Link>
                    <button onClick={() => setTransferTarget(c)} style={btnSmall}>Transfer</button>
                    <button onClick={() => setCloseTarget(c)} style={{ ...btnSmall, color: 'var(--danger)' }}>Close</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={btnSecondary}>← Prev</button>
          <span style={{ lineHeight: '32px', fontSize: 13 }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={btnSecondary}>Next →</button>
        </div>
      )}

      {/* Modals */}
      {closeTarget && (
        <CloseModal child={closeTarget} onDone={invalidate} onCancel={() => setCloseTarget(null)} />
      )}
      {transferTarget && (
        <TransferModal child={transferTarget} onDone={invalidate} onCancel={() => setTransferTarget(null)} />
      )}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const input: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px',
  background: 'var(--bg-elev)', color: 'var(--ink)', fontSize: 13,
};
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 };
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontWeight: 600, fontSize: 12 };
const td: React.CSSProperties = { padding: '10px 10px', verticalAlign: 'middle' };
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
const btnSecondary: React.CSSProperties = {
  background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--ink)',
};
const btnDanger: React.CSSProperties = {
  background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8,
  padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
const btnSmall: React.CSSProperties = {
  background: 'none', border: '1px solid var(--border)', borderRadius: 6,
  padding: '3px 8px', cursor: 'pointer', fontSize: 11, marginRight: 4, color: 'var(--ink)',
};
