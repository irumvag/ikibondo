'use client';

import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Syringe, ChevronRight, ChevronDown, Plus, X } from 'lucide-react';
import { useSupervisorClinicSessions, QK } from '@/lib/api/queries';
import { listVaccines } from '@/lib/api/admin';
import { createClinicSession, closeClinicSession, getSessionAttendees } from '@/lib/api/supervisor';
import type { ClinicSession, ClinicAttendee } from '@/lib/api/supervisor';
import type { VaccineRecord } from '@/lib/api/admin';
import { useEffect } from 'react';

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const color = status === 'OPEN' ? 'var(--success)' : 'var(--text-muted)';
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: `color-mix(in srgb, ${color} 14%, var(--bg-elev))`, color }}>
      {status}
    </span>
  );
}

// ── Session row (with attendees expand) ───────────────────────────────────────

function SessionRow({ session, onClose, onRefresh }: {
  session: ClinicSession; onClose: (id: string) => void; onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [attendees, setAttendees] = useState<ClinicAttendee[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);

  async function toggle() {
    if (!expanded && attendees.length === 0) {
      setLoadingAttendees(true);
      try { setAttendees(await getSessionAttendees(session.id)); } finally { setLoadingAttendees(false); }
    }
    setExpanded(x => !x);
  }

  return (
    <>
      <tr style={{ borderBottom: expanded ? 'none' : '1px solid var(--border)' }}>
        <td style={{ ...td, width: 24, cursor: 'pointer' }} onClick={toggle}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td style={td}><span style={{ fontWeight: 600 }}>{session.vaccine_name}</span></td>
        <td style={td}>{new Date(session.date).toLocaleDateString()}</td>
        <td style={td}><StatusBadge status={session.status} /></td>
        <td style={td}>{session.attendee_count}</td>
        <td style={td}>{session.opened_by_name ?? '—'}</td>
        <td style={{ ...td, whiteSpace: 'nowrap' }}>
          {session.status === 'OPEN' && (
            <button onClick={() => onClose(session.id)}
              style={{ background: 'none', border: '1px solid var(--warn)', color: 'var(--warn)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 12 }}>
              Close session
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} style={{ padding: '10px 16px', background: 'color-mix(in srgb, var(--primary) 4%, var(--bg-elev))', borderBottom: '1px solid var(--border)' }}>
            {loadingAttendees ? (
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading attendees…</span>
            ) : attendees.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No attendees recorded yet.</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {attendees.map(a => (
                  <span key={a.id} style={{ fontSize: 12, border: '1px solid var(--border)', borderRadius: 8, padding: '3px 10px', background: 'var(--bg-elev)' }}>
                    {a.child_name} · <span style={{ color: 'var(--text-muted)' }}>{a.status}</span>
                  </span>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Create modal ──────────────────────────────────────────────────────────────

function CreateModal({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [vaccines, setVaccines] = useState<VaccineRecord[]>([]);
  const [vaccineId, setVaccineId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    listVaccines({ is_active: true }).then(setVaccines).catch(() => setVaccines([]));
  }, []);

  const mut = useMutation({
    mutationFn: () => createClinicSession({ vaccine: vaccineId, date }),
    onSuccess: onDone,
  });

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>New Clinic Session</h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <label style={lbl}>Vaccine</label>
        <select value={vaccineId} onChange={e => setVaccineId(e.target.value)} style={inputSt}>
          <option value="" disabled>Select vaccine…</option>
          {vaccines.map(v => <option key={v.id} value={v.id}>{v.name} (dose {v.dose_number})</option>)}
        </select>
        <label style={{ ...lbl, marginTop: 12 }}>Session date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputSt} />
        {mut.isError && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '8px 0 0' }}>Failed to create session.</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnSec}>Cancel</button>
          <button onClick={() => mut.mutate()} disabled={!vaccineId || !date || mut.isPending}
            style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: (!vaccineId || !date || mut.isPending) ? 0.5 : 1 }}>
            {mut.isPending ? 'Creating…' : 'Create Session'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const STATUSES = ['', 'OPEN', 'CLOSED'];

export default function SupervisorClinicSessionsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, isError } = useSupervisorClinicSessions({ status: status || undefined, page });
  const total = data?.count ?? 0;
  const sessions = data?.results ?? [];
  const totalPages = Math.ceil(total / 20);

  const closeMut = useMutation({
    mutationFn: (id: string) => closeClinicSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.supervisorClinicSessions() }),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: QK.supervisorClinicSessions() });
    setShowCreate(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
            Clinic Sessions
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Vaccination clinic sessions in your camp · {total} total
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> New Session
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {STATUSES.map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }} style={{
            border: `1px solid ${status === s ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 20, padding: '5px 14px', cursor: 'pointer', fontSize: 13,
            background: status === s ? 'color-mix(in srgb, var(--primary) 10%, var(--bg-elev))' : 'var(--bg-elev)',
            color: status === s ? 'var(--primary)' : 'var(--ink)', fontWeight: status === s ? 600 : 400,
          }}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : isError ? (
        <p style={{ color: 'var(--danger)' }}>Failed to load clinic sessions.</p>
      ) : sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          <Syringe size={36} style={{ marginBottom: 8, opacity: 0.4 }} />
          <p>No clinic sessions found.</p>
          <button onClick={() => setShowCreate(true)}
            style={{ marginTop: 12, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>
            Create first session
          </button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={th}></th>
                <th style={th}>Vaccine</th>
                <th style={th}>Date</th>
                <th style={th}>Status</th>
                <th style={th}>Attendees</th>
                <th style={th}>Opened by</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <SessionRow
                  key={s.id}
                  session={s}
                  onClose={id => closeMut.mutate(id)}
                  onRefresh={() => qc.invalidateQueries({ queryKey: QK.supervisorClinicSessions() })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={btnSec}>← Prev</button>
          <span style={{ lineHeight: '32px', fontSize: 13 }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={btnSec}>Next →</button>
        </div>
      )}

      {showCreate && <CreateModal onDone={invalidate} onCancel={() => setShowCreate(false)} />}
    </div>
  );
}

const inputSt: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', background: 'var(--bg-elev)', color: 'var(--ink)', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 };
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontWeight: 600, fontSize: 12 };
const td: React.CSSProperties = { padding: '10px 10px', verticalAlign: 'middle' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modal: React.CSSProperties = { background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 400, maxWidth: '90vw' };
const btnSec: React.CSSProperties = { background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--ink)' };
