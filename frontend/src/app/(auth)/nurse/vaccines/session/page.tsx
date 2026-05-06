'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Loader2, Plus, Syringe, CalendarDays } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

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

interface Vaccine  { id: string; name: string; short_code: string; }
interface Child    { id: string; full_name: string; registration_number: string; }

async function listSessions(): Promise<ClinicSession[]> {
  const { data } = await apiClient.get('/vaccinations/clinic-sessions/');
  return data.data ?? data.results ?? [];
}
async function listVaccines(): Promise<Vaccine[]> {
  const { data } = await apiClient.get('/vaccinations/vaccines/');
  return data.data ?? data.results ?? [];
}
async function listChildren(): Promise<Child[]> {
  const { data } = await apiClient.get('/children/', { params: { page_size: 200 } });
  return data.data ?? data.results ?? [];
}

export default function ClinicSessionPage() {
  const qc = useQueryClient();
  const [showNew, setShowNew]               = useState(false);
  const [selectedSession, setSelectedSession] = useState<ClinicSession | null>(null);
  const [attendance, setAttendance]         = useState<Record<string, 'DONE' | 'MISSED'>>({});
  const [batch, setBatch]                   = useState('');
  const [newVaccine, setNewVaccine]         = useState('');
  const [newDate, setNewDate]               = useState(new Date().toISOString().split('T')[0]);
  const [childSearch, setChildSearch]       = useState('');

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['nurse', 'clinic-sessions'],
    queryFn:  listSessions,
  });
  const { data: vaccines = [] } = useQuery({ queryKey: ['vaccines'],              queryFn: listVaccines });
  const { data: children = [] } = useQuery({ queryKey: ['nurse', 'children-list'], queryFn: listChildren });

  const openSessionMut = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/vaccinations/clinic-sessions/', {
        vaccine: newVaccine, session_date: newDate,
      });
      return data.data as ClinicSession;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['nurse', 'clinic-sessions'] });
      setSelectedSession(s);
      setShowNew(false);
      setNewVaccine('');
    },
  });

  const recordMut = useMutation({
    mutationFn: async (sessionId: string) => {
      const attendances = Object.entries(attendance).map(([child, status]) => ({
        child, status, batch_number: batch,
      }));
      await apiClient.post(`/vaccinations/clinic-sessions/${sessionId}/record-attendance/`, { attendances });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nurse', 'clinic-sessions'] });
      setAttendance({});
      setBatch('');
    },
  });

  const closeMut = useMutation({
    mutationFn: (id: string) => apiClient.post(`/vaccinations/clinic-sessions/${id}/close/`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nurse', 'clinic-sessions'] });
      setSelectedSession(null);
    },
  });

  const toggleChild = (childId: string) => {
    setAttendance((prev) => {
      const next = { ...prev };
      if (next[childId] === 'DONE')   { next[childId] = 'MISSED'; }
      else if (next[childId] === 'MISSED') { delete next[childId]; }
      else                                  { next[childId] = 'DONE'; }
      return next;
    });
  };

  const filteredChildren = childSearch.trim()
    ? children.filter((c) =>
        c.full_name.toLowerCase().includes(childSearch.toLowerCase()) ||
        c.registration_number.toLowerCase().includes(childSearch.toLowerCase())
      )
    : children;

  const doneCount   = Object.values(attendance).filter((s) => s === 'DONE').length;
  const missedCount = Object.values(attendance).filter((s) => s === 'MISSED').length;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
            Clinic Sessions
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Open a session, record vaccinations, and close when done.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowNew(true)}>
          <Plus size={15} className="mr-1.5" aria-hidden="true" />
          New session
        </Button>
      </div>

      <div className="flex gap-5 min-h-[500px]">
        {/* ── Session list ── */}
        <div
          className="w-64 shrink-0 flex flex-col gap-2 rounded-2xl border p-3 overflow-y-auto"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', maxHeight: 'calc(100vh - 220px)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider px-1 mb-1" style={{ color: 'var(--text-muted)' }}>
            Sessions ({sessions.length})
          </p>
          {isLoading ? (
            <>{[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</>
          ) : sessions.length === 0 ? (
            <EmptyState icon={<Syringe size={22} />} title="No sessions" description="Open a new session to start." />
          ) : (
            sessions.map((s) => {
              const active = selectedSession?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSession(s)}
                  className="text-left rounded-xl px-3 py-2.5 transition-colors border"
                  style={{
                    borderColor:       active ? 'var(--ink)' : 'var(--border)',
                    backgroundColor:   active ? 'var(--bg-sand)' : 'transparent',
                  }}
                >
                  <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{s.vaccine_name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {s.session_date} · {s.attendance_count} doses
                  </p>
                  <span
                    className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: s.status === 'OPEN' ? 'var(--low-bg)' : 'var(--bg-sand)',
                      color:           s.status === 'OPEN' ? 'var(--success)' : 'var(--text-muted)',
                    }}
                  >
                    {s.status}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* ── Session detail ── */}
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
          ) : (
            <>
              {/* Session header */}
              <div
                className="px-5 py-4 border-b flex items-start justify-between gap-4 flex-wrap"
                style={{ borderColor: 'var(--border)' }}
              >
                <div>
                  <p className="font-semibold" style={{ color: 'var(--ink)' }}>
                    {selectedSession.vaccine_name} — {selectedSession.session_date}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {selectedSession.camp_name} · {selectedSession.attendance_count} doses recorded
                  </p>
                </div>

                {selectedSession.status === 'OPEN' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Attendance summary chips */}
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
                      onClick={() => recordMut.mutate(selectedSession.id)}
                      disabled={recordMut.isPending || Object.keys(attendance).length === 0}
                      loading={recordMut.isPending}
                    >
                      <CheckCircle2 size={13} className="mr-1" aria-hidden="true" />
                      Record ({Object.keys(attendance).length})
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => closeMut.mutate(selectedSession.id)}
                      loading={closeMut.isPending}
                    >
                      Close session
                    </Button>
                  </div>
                )}
              </div>

              {/* Child attendance list */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {selectedSession.status === 'CLOSED' ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-12">
                    <CheckCircle2 size={28} style={{ color: 'var(--success)' }} aria-hidden="true" />
                    <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Session closed</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {selectedSession.attendance_count} doses were recorded.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Search within children */}
                    <input
                      value={childSearch}
                      onChange={(e) => setChildSearch(e.target.value)}
                      placeholder="Search child by name or number…"
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
                    />
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Tap to mark <strong>Done</strong> · tap again for <strong>Missed</strong> · tap again to clear.
                    </p>
                    <div className="flex flex-col gap-2">
                      {filteredChildren.map((child) => {
                        const st = attendance[child.id];
                        return (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => toggleChild(child.id)}
                            className="flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-colors text-left"
                            style={{
                              borderColor:     st === 'DONE'   ? 'var(--success)' : st === 'MISSED' ? 'var(--danger)' : 'var(--border)',
                              backgroundColor: st === 'DONE'   ? 'var(--low-bg)'  : st === 'MISSED' ? 'var(--high-bg)' : 'var(--bg-elev)',
                            }}
                          >
                            <div>
                              <p className="font-medium text-sm" style={{ color: 'var(--ink)' }}>{child.full_name}</p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{child.registration_number}</p>
                            </div>
                            {st === 'DONE'   && <CheckCircle2 size={16} style={{ color: 'var(--success)' }} aria-hidden="true" />}
                            {st === 'MISSED' && <XCircle      size={16} style={{ color: 'var(--danger)'  }} aria-hidden="true" />}
                          </button>
                        );
                      })}
                      {filteredChildren.length === 0 && (
                        <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>No children match your search.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── New session modal ── */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowNew(false)}>
          <div
            className="rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4"
            style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-fraunces)' }}>Open Clinic Session</h2>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Vaccine *</label>
              <select
                value={newVaccine}
                onChange={(e) => setNewVaccine(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
              >
                <option value="">Select vaccine…</option>
                {vaccines.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Session date *</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => openSessionMut.mutate()}
                disabled={!newVaccine || !newDate || openSessionMut.isPending}
                loading={openSessionMut.isPending}
              >
                Open session
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
