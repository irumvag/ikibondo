'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Loader2, Plus, Syringe } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

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

interface Vaccine { id: string; name: string; short_code: string; }
interface Child { id: string; full_name: string; registration_number: string; }

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
  return data.data ?? [];
}

export default function ClinicSessionPage() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ClinicSession | null>(null);
  const [attendance, setAttendance] = useState<Record<string, 'DONE' | 'MISSED' | 'SKIPPED'>>({});
  const [batch, setBatch] = useState('');
  const [newVaccine, setNewVaccine] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: sessions = [], isLoading } = useQuery({ queryKey: ['nurse', 'clinic-sessions'], queryFn: listSessions });
  const { data: vaccines = [] } = useQuery({ queryKey: ['vaccines'], queryFn: listVaccines });
  const { data: children = [] } = useQuery({ queryKey: ['nurse', 'children-list'], queryFn: listChildren });

  const openSessionMut = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/vaccinations/clinic-sessions/', {
        vaccine: newVaccine,
        session_date: newDate,
      });
      return data.data as ClinicSession;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['nurse', 'clinic-sessions'] });
      setSelectedSession(s);
      setShowNew(false);
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
      if (next[childId] === 'DONE') { next[childId] = 'MISSED'; }
      else if (next[childId] === 'MISSED') { delete next[childId]; }
      else { next[childId] = 'DONE'; }
      return next;
    });
  };

  return (
    <div className="flex gap-6 max-w-4xl h-[calc(100vh-8rem)]">
      {/* Session list */}
      <div className="w-72 shrink-0 flex flex-col gap-3 overflow-y-auto">
        <div className="flex items-center justify-between shrink-0">
          <h1 className="text-xl font-bold text-gray-900">Clinic Sessions</h1>
          <button onClick={() => setShowNew(true)} className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <>{[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</>
        ) : sessions.length === 0 ? (
          <EmptyState icon={<Syringe size={24} />} title="No sessions" description="Open a new clinic session to start." />
        ) : (
          sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSession(s)}
              className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${selectedSession?.id === s.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
            >
              <p className="text-sm font-medium text-gray-900">{s.vaccine_name}</p>
              <p className="text-xs text-gray-500">{s.session_date} · {s.attendance_count} recorded · <span className={s.status === 'OPEN' ? 'text-green-600' : 'text-gray-400'}>{s.status}</span></p>
            </button>
          ))
        )}
      </div>

      {/* Session detail / attendance recording */}
      <div className="flex-1 flex flex-col border border-gray-200 rounded-2xl overflow-hidden bg-white">
        {!selectedSession ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            Select or open a session
          </div>
        ) : (
          <>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-900">{selectedSession.vaccine_name} — {selectedSession.session_date}</p>
                <p className="text-xs text-gray-500">{selectedSession.camp_name} · {selectedSession.attendance_count} doses recorded</p>
              </div>
              {selectedSession.status === 'OPEN' && (
                <div className="flex gap-2">
                  <input
                    value={batch}
                    onChange={(e) => setBatch(e.target.value)}
                    placeholder="Batch #"
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs w-28"
                  />
                  <button
                    onClick={() => recordMut.mutate(selectedSession.id)}
                    disabled={recordMut.isPending || Object.keys(attendance).length === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {recordMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Record ({Object.keys(attendance).length})
                  </button>
                  <button
                    onClick={() => closeMut.mutate(selectedSession.id)}
                    disabled={closeMut.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Close session
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {selectedSession.status === 'CLOSED' ? (
                <p className="text-sm text-gray-400 text-center mt-8">This session is closed.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  <p className="text-xs text-gray-400 mb-1">Tap to toggle DONE / MISSED for each child:</p>
                  {children.map((child) => {
                    const status = attendance[child.id];
                    return (
                      <button
                        key={child.id}
                        onClick={() => toggleChild(child.id)}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                          status === 'DONE' ? 'border-green-400 bg-green-50' :
                          status === 'MISSED' ? 'border-red-300 bg-red-50' :
                          'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="text-left">
                          <p className="font-medium text-gray-900">{child.full_name}</p>
                          <p className="text-xs text-gray-400">{child.registration_number}</p>
                        </div>
                        {status === 'DONE' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                        {status === 'MISSED' && <XCircle className="h-4 w-4 text-red-500" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* New session modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">Open Clinic Session</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vaccine *</label>
              <select value={newVaccine} onChange={(e) => setNewVaccine(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">Select vaccine…</option>
                {vaccines.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Session date *</label>
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNew(false)} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm">Cancel</button>
              <button
                onClick={() => openSessionMut.mutate()}
                disabled={!newVaccine || !newDate || openSessionMut.isPending}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                {openSessionMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Open
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
