'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, XCircle, Plus, Syringe, CalendarDays,
  Users, AlertTriangle, Pencil, Trash2, X,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClinicSession {
  id: string;
  camp: string;
  camp_name: string;
  vaccine: string;
  vaccine_name: string;
  session_date: string;
  opened_by_name: string | null;
  status: 'OPEN' | 'CLOSED';
  attendance_count: number;
}

interface EligibleChild {
  id: string;
  full_name: string;
  registration_number: string;
  age_display: string;
  scheduled_date: string;
  is_overdue: boolean;
  already_recorded: boolean;
  recorded_status: string | null;
}

interface Attendee {
  child_id: string;
  full_name: string;
  registration_number: string;
  age_display: string;
  status: string;
  batch_number: string;
}

interface Vaccine { id: string; name: string; short_code: string; }

// ── Constants ─────────────────────────────────────────────────────────────────

// Children scheduled more than 30 days from today are "far" — nurse should remind them later
const FAR_DATE_DAYS = 30;

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function listSessions(): Promise<ClinicSession[]> {
  const { data } = await apiClient.get('/vaccinations/clinic-sessions/');
  return data.data ?? data.results ?? [];
}

async function listVaccines(): Promise<Vaccine[]> {
  const { data } = await apiClient.get('/vaccinations/vaccines/');
  return data.data ?? data.results ?? [];
}

async function fetchEligibleChildren(sessionId: string): Promise<EligibleChild[]> {
  const { data } = await apiClient.get(`/vaccinations/clinic-sessions/${sessionId}/eligible-children/`);
  return data.data ?? data.results ?? [];
}

async function fetchAttendees(sessionId: string): Promise<Attendee[]> {
  const { data } = await apiClient.get(`/vaccinations/clinic-sessions/${sessionId}/attendees/`);
  return data.data ?? data.results ?? [];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sortSessions(sessions: ClinicSession[]): ClinicSession[] {
  const open   = sessions.filter((s) => s.status === 'OPEN')
    .sort((a, b) => b.session_date.localeCompare(a.session_date));
  const closed = sessions.filter((s) => s.status === 'CLOSED')
    .sort((a, b) => b.session_date.localeCompare(a.session_date));
  return [...open, ...closed];
}

function AttendeeStatusBadge({ status }: { status: string }) {
  if (status === 'DONE')    return <Badge variant="success">Done</Badge>;
  if (status === 'MISSED')  return <Badge variant="danger">Missed</Badge>;
  if (status === 'SKIPPED') return <Badge variant="default">Skipped</Badge>;
  return <Badge variant="default">{status}</Badge>;
}

// ── Session Form Modal (create / edit) ─────────────────────────────────────────

function SessionFormModal({
  session,
  vaccines,
  onClose,
  onSaved,
}: {
  session?: ClinicSession | null;
  vaccines: Vaccine[];
  onClose: () => void;
  onSaved: (s: ClinicSession) => void;
}) {
  const isEdit = !!session;
  const [vaccine, setVaccine] = useState(session?.vaccine ?? vaccines[0]?.id ?? '');
  const [date, setDate]       = useState(session?.session_date ?? new Date().toISOString().split('T')[0]);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!vaccine && vaccines.length > 0) setVaccine(vaccines[0].id);
  }, [vaccines]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        const { data } = await apiClient.patch(`/vaccinations/clinic-sessions/${session!.id}/`, {
          vaccine, session_date: date,
        });
        return data.data as ClinicSession;
      }
      const { data } = await apiClient.post('/vaccinations/clinic-sessions/', {
        vaccine, session_date: date,
      });
      return data.data as ClinicSession;
    },
    onSuccess: (s) => onSaved(s),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to save. Please try again.');
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4"
        style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-fraunces)' }}>
            {isEdit ? 'Edit Session' : 'Open Clinic Session'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Vaccine *</label>
          <select
            value={vaccine}
            onChange={(e) => setVaccine(e.target.value)}
            disabled={isEdit && session?.status === 'OPEN'}
            className="rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)', opacity: isEdit && session?.status === 'OPEN' ? 0.6 : 1 }}
          >
            {vaccines.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          {isEdit && session?.status === 'OPEN' && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Vaccine cannot be changed on an open session.</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Session date *</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
          />
        </div>

        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => mutation.mutate()}
            disabled={!vaccine || !date || mutation.isPending}
            loading={mutation.isPending}
          >
            {isEdit ? 'Save changes' : 'Open session'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirmation dialog ─────────────────────────────────────────────────

function DeleteConfirmDialog({
  session,
  onClose,
  onDeleted,
}: {
  session: ClinicSession;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const mutation = useMutation({
    mutationFn: () => apiClient.delete(`/vaccinations/clinic-sessions/${session.id}/`),
    onSuccess: onDeleted,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4"
        style={{ backgroundColor: 'var(--bg-elev)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-semibold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-fraunces)' }}>Delete session?</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          This will permanently delete the <strong>{session.vaccine_name}</strong> session on{' '}
          {new Date(session.session_date).toLocaleDateString()}. This cannot be undone.
        </p>
        {mutation.isError && <p className="text-sm" style={{ color: 'var(--danger)' }}>Failed to delete. Please try again.</p>}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            className="flex-1"
            style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }}
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ClinicSessionPage() {
  const qc = useQueryClient();

  const [showForm, setShowForm]           = useState(false);
  const [editSession, setEditSession]     = useState<ClinicSession | null>(null);
  const [deleteSession, setDeleteSession] = useState<ClinicSession | null>(null);
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [attendance, setAttendance]       = useState<Record<string, 'DONE' | 'MISSED'>>({});
  const [batch, setBatch]                 = useState('');
  const [childSearch, setChildSearch]     = useState('');
  // Track children nurse clicked on that are "far" — show per-child reminder alert
  const [farAlerts, setFarAlerts]         = useState<Set<string>>(new Set());

  // ── Data ─────────────────────────────────────────────────────────────────────

  const { data: rawSessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['nurse', 'clinic-sessions'],
    queryFn: listSessions,
    staleTime: 30_000,
  });

  const sessions = sortSessions(rawSessions);
  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null;

  const { data: vaccines = [] } = useQuery({
    queryKey: ['vaccines'],
    queryFn: listVaccines,
    staleTime: 300_000,
  });

  const { data: eligibleChildren = [], isLoading: eligibleLoading } = useQuery({
    queryKey: ['clinic-session', selectedId, 'eligible'],
    queryFn: () => fetchEligibleChildren(selectedId!),
    enabled: !!selectedId && selectedSession?.status === 'OPEN',
    staleTime: 30_000,
  });

  const { data: attendees = [], isLoading: attendeesLoading } = useQuery({
    queryKey: ['clinic-session', selectedId, 'attendees'],
    queryFn: () => fetchAttendees(selectedId!),
    enabled: !!selectedId && selectedSession?.status === 'CLOSED',
    staleTime: 60_000,
  });

  // Reset per-session state when selection changes
  useEffect(() => {
    setAttendance({});
    setBatch('');
    setChildSearch('');
    setFarAlerts(new Set());
  }, [selectedId]);

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const recordMut = useMutation({
    mutationFn: async () => {
      const attendances = Object.entries(attendance).map(([child, status]) => ({
        child, status, batch_number: batch,
      }));
      await apiClient.post(`/vaccinations/clinic-sessions/${selectedId}/record-attendance/`, { attendances });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nurse', 'clinic-sessions'] });
      qc.invalidateQueries({ queryKey: ['clinic-session', selectedId, 'eligible'] });
      setAttendance({});
      setBatch('');
      setFarAlerts(new Set());
    },
  });

  const closeMut = useMutation({
    mutationFn: () => apiClient.post(`/vaccinations/clinic-sessions/${selectedId}/close/`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nurse', 'clinic-sessions'] });
      qc.invalidateQueries({ queryKey: ['clinic-session', selectedId, 'attendees'] });
    },
  });

  // ── Child toggle ───────────────────────────────────────────────────────────────

  const toggleChild = (child: EligibleChild) => {
    if (child.already_recorded) return;

    const days = daysUntil(child.scheduled_date);
    const isFar = days > FAR_DATE_DAYS;

    setAttendance((prev) => {
      const next = { ...prev };
      if (next[child.id] === 'DONE') {
        // DONE → MISSED
        next[child.id] = 'MISSED';
        setFarAlerts((fa) => { const s = new Set(fa); s.delete(child.id); return s; });
      } else if (next[child.id] === 'MISSED') {
        // MISSED → deselected
        delete next[child.id];
        setFarAlerts((fa) => { const s = new Set(fa); s.delete(child.id); return s; });
      } else {
        // unselected → DONE, and show far-date alert if applicable
        next[child.id] = 'DONE';
        if (isFar) {
          setFarAlerts((fa) => new Set([...fa, child.id]));
        }
      }
      return next;
    });
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const filteredEligible = childSearch.trim()
    ? eligibleChildren.filter(
        (c) =>
          c.full_name.toLowerCase().includes(childSearch.toLowerCase()) ||
          c.registration_number.toLowerCase().includes(childSearch.toLowerCase()),
      )
    : eligibleChildren;

  const doneCount   = Object.values(attendance).filter((s) => s === 'DONE').length;
  const missedCount = Object.values(attendance).filter((s) => s === 'MISSED').length;

  const openSessions   = sessions.filter((s) => s.status === 'OPEN');
  const closedSessions = sessions.filter((s) => s.status === 'CLOSED');

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
            Clinic Sessions
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Open a session for a vaccine, record attendance, then close it.
          </p>
        </div>
        <Button variant="primary" onClick={() => { setEditSession(null); setShowForm(true); }}>
          <Plus size={15} className="mr-1.5" aria-hidden="true" />
          New session
        </Button>
      </div>

      <div className="flex gap-5" style={{ minHeight: 520 }}>
        {/* ── Session list sidebar ── */}
        <div
          className="w-64 shrink-0 flex flex-col gap-1 rounded-2xl border p-3 overflow-y-auto"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', maxHeight: 'calc(100vh - 220px)' }}
        >
          {sessionsLoading ? (
            <>{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</>
          ) : sessions.length === 0 ? (
            <EmptyState icon={<Syringe size={22} />} title="No sessions" description="Open a new session to start." />
          ) : (
            <>
              {openSessions.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider px-1 mt-1 mb-0.5 flex items-center gap-1" style={{ color: 'var(--success)' }}>
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: 'var(--success)' }} />
                    Open ({openSessions.length})
                  </p>
                  {openSessions.map((s) => (
                    <SessionItem
                      key={s.id}
                      s={s}
                      active={selectedId === s.id}
                      onSelect={setSelectedId}
                      onEdit={() => { setEditSession(s); setShowForm(true); }}
                      onDelete={() => setDeleteSession(s)}
                    />
                  ))}
                </>
              )}
              {closedSessions.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider px-1 mt-3 mb-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    Closed ({closedSessions.length})
                  </p>
                  {closedSessions.map((s) => (
                    <SessionItem
                      key={s.id}
                      s={s}
                      active={selectedId === s.id}
                      onSelect={setSelectedId}
                      onEdit={() => { setEditSession(s); setShowForm(true); }}
                      onDelete={() => setDeleteSession(s)}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* ── Session detail panel ── */}
        <div
          className="flex-1 flex flex-col rounded-2xl border overflow-hidden"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
        >
          {!selectedSession ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
              <CalendarDays size={32} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Select a session from the list, or open a new one.
              </p>
            </div>
          ) : selectedSession.status === 'OPEN' ? (
            <>
              {/* OPEN session header */}
              <div className="px-5 py-4 border-b flex items-start justify-between gap-4 flex-wrap" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-fraunces)' }}>
                      {selectedSession.vaccine_name}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--low-bg)', color: 'var(--success)' }}>
                      Open
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {selectedSession.session_date} · {selectedSession.camp_name}
                    {selectedSession.opened_by_name && ` · by ${selectedSession.opened_by_name}`}
                  </p>
                  {!eligibleLoading && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {eligibleChildren.length} eligible ·{' '}
                      {eligibleChildren.filter((c) => c.already_recorded).length} already recorded ·{' '}
                      {eligibleChildren.filter((c) => !c.already_recorded && daysUntil(c.scheduled_date) > FAR_DATE_DAYS).length} scheduled far out
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {doneCount > 0 && (
                    <span className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: 'var(--low-bg)', color: 'var(--success)' }}>
                      {doneCount} done
                    </span>
                  )}
                  {missedCount > 0 && (
                    <span className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: 'var(--high-bg)', color: 'var(--danger)' }}>
                      {missedCount} missed
                    </span>
                  )}
                  <input
                    value={batch}
                    onChange={(e) => setBatch(e.target.value)}
                    placeholder="Batch #"
                    className="rounded-lg border px-2 py-1.5 text-xs w-28 outline-none"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => recordMut.mutate()}
                    disabled={recordMut.isPending || Object.keys(attendance).length === 0}
                    loading={recordMut.isPending}
                  >
                    <CheckCircle2 size={13} className="mr-1" aria-hidden="true" />
                    Save ({Object.keys(attendance).length})
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => closeMut.mutate()}
                    loading={closeMut.isPending}
                  >
                    Close session
                  </Button>
                </div>
              </div>

              {/* Eligible children list */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                <input
                  value={childSearch}
                  onChange={(e) => setChildSearch(e.target.value)}
                  placeholder="Search by name or registration number…"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
                />

                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Only children with a scheduled <strong>{selectedSession.vaccine_name}</strong> dose are listed.
                  Tap → <strong>Done</strong> · tap again → <strong>Missed</strong> · tap again → clear.
                </p>

                {eligibleLoading ? (
                  <div className="flex flex-col gap-2">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
                  </div>
                ) : filteredEligible.length === 0 ? (
                  <EmptyState
                    icon={<Users size={24} />}
                    title={childSearch ? 'No match' : 'No eligible children'}
                    description={childSearch ? 'Try a different search.' : 'No children have a scheduled dose for this vaccine.'}
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {filteredEligible.map((child) => {
                      const alreadyDone = child.already_recorded;
                      const st = alreadyDone ? child.recorded_status : attendance[child.id];
                      const days = daysUntil(child.scheduled_date);
                      const isFar = days > FAR_DATE_DAYS;
                      const showFarAlert = farAlerts.has(child.id);

                      return (
                        <div key={child.id} className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => toggleChild(child)}
                            disabled={alreadyDone}
                            className="flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-colors text-left w-full"
                            style={{
                              borderColor: alreadyDone
                                ? 'var(--border)'
                                : st === 'DONE'   ? 'var(--success)'
                                : st === 'MISSED' ? 'var(--danger)'
                                : isFar           ? 'var(--warn)'
                                : 'var(--border)',
                              backgroundColor: alreadyDone
                                ? 'var(--bg-sand)'
                                : st === 'DONE'   ? 'var(--low-bg)'
                                : st === 'MISSED' ? 'var(--high-bg)'
                                : 'transparent',
                              opacity: alreadyDone ? 0.7 : 1,
                              cursor:  alreadyDone ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm" style={{ color: 'var(--ink)' }}>{child.full_name}</p>
                                {child.is_overdue && !alreadyDone && (
                                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--high-bg)', color: 'var(--danger)' }}>
                                    Overdue
                                  </span>
                                )}
                                {isFar && !alreadyDone && !child.is_overdue && (
                                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--med-bg)', color: 'var(--warn)' }}>
                                    {days}d away
                                  </span>
                                )}
                                {alreadyDone && (
                                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}>
                                    Recorded
                                  </span>
                                )}
                              </div>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {child.registration_number}
                                {child.age_display && ` · ${child.age_display}`}
                                {` · Due ${new Date(child.scheduled_date).toLocaleDateString()}`}
                              </p>
                            </div>
                            <div className="shrink-0 ml-2">
                              {alreadyDone ? (
                                child.recorded_status === 'DONE'
                                  ? <CheckCircle2 size={16} style={{ color: 'var(--success)' }} aria-hidden="true" />
                                  : <XCircle     size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                              ) : st === 'DONE' ? (
                                <CheckCircle2 size={16} style={{ color: 'var(--success)' }} aria-hidden="true" />
                              ) : st === 'MISSED' ? (
                                <XCircle size={16} style={{ color: 'var(--danger)' }} aria-hidden="true" />
                              ) : null}
                            </div>
                          </button>

                          {/* Far-date reminder alert */}
                          {showFarAlert && (
                            <div
                              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                              style={{ backgroundColor: 'var(--med-bg)', color: 'var(--warn)' }}
                            >
                              <AlertTriangle size={12} aria-hidden="true" />
                              <span className="flex-1">
                                {child.full_name}&apos;s dose is scheduled in <strong>{days} days</strong> ({new Date(child.scheduled_date).toLocaleDateString()}).
                                Consider contacting the guardian to remind them before the date.
                              </span>
                              <button
                                type="button"
                                onClick={() => setFarAlerts((fa) => { const s = new Set(fa); s.delete(child.id); return s; })}
                                aria-label="Dismiss"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ── CLOSED session detail ── */
            <>
              <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <p className="font-semibold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-fraunces)' }}>
                    {selectedSession.vaccine_name}
                  </p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}>
                    Closed
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {selectedSession.session_date} · {selectedSession.camp_name}
                  {selectedSession.opened_by_name && ` · by ${selectedSession.opened_by_name}`}
                  {' '}· {selectedSession.attendance_count} recorded
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Attendance list</p>

                {attendeesLoading ? (
                  <div className="flex flex-col gap-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
                  </div>
                ) : attendees.length === 0 ? (
                  <EmptyState icon={<Users size={24} />} title="No records" description="No attendance was recorded in this session." />
                ) : (
                  <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                    {attendees.map((a, idx) => (
                      <div
                        key={a.child_id}
                        className="flex items-center justify-between px-4 py-3 border-b last:border-b-0"
                        style={{ borderColor: 'var(--border)', backgroundColor: idx % 2 === 0 ? 'var(--bg-elev)' : 'transparent' }}
                      >
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{a.full_name}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {a.registration_number}
                            {a.age_display && ` · ${a.age_display}`}
                            {a.batch_number && ` · Batch: ${a.batch_number}`}
                          </p>
                        </div>
                        <AttendeeStatusBadge status={a.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showForm && (
        <SessionFormModal
          session={editSession}
          vaccines={vaccines}
          onClose={() => { setShowForm(false); setEditSession(null); }}
          onSaved={(s) => {
            qc.invalidateQueries({ queryKey: ['nurse', 'clinic-sessions'] });
            setSelectedId(s.id);
            setShowForm(false);
            setEditSession(null);
          }}
        />
      )}

      {deleteSession && (
        <DeleteConfirmDialog
          session={deleteSession}
          onClose={() => setDeleteSession(null)}
          onDeleted={() => {
            qc.invalidateQueries({ queryKey: ['nurse', 'clinic-sessions'] });
            if (selectedId === deleteSession.id) setSelectedId(null);
            setDeleteSession(null);
          }}
        />
      )}
    </div>
  );
}

// ── Session list item ─────────────────────────────────────────────────────────

function SessionItem({
  s, active, onSelect, onEdit, onDelete,
}: {
  s: ClinicSession;
  active: boolean;
  onSelect: (id: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="rounded-xl border transition-colors"
      style={{
        borderColor: active ? 'var(--ink)' : 'var(--border)',
        backgroundColor: active ? 'var(--bg-sand)' : 'transparent',
      }}
    >
      <button
        type="button"
        onClick={() => onSelect(s.id)}
        className="text-left px-3 py-2.5 w-full"
      >
        <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{s.vaccine_name}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {new Date(s.session_date).toLocaleDateString()} · {s.attendance_count} doses
        </p>
      </button>

      {/* CRUD actions */}
      <div className="flex items-center gap-1 px-2 pb-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1 rounded-md hover:opacity-70 transition-opacity"
          aria-label="Edit session"
          title="Edit"
        >
          <Pencil size={12} style={{ color: 'var(--text-muted)' }} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded-md hover:opacity-70 transition-opacity"
          aria-label="Delete session"
          title="Delete"
        >
          <Trash2 size={12} style={{ color: 'var(--danger)' }} />
        </button>
      </div>
    </div>
  );
}
