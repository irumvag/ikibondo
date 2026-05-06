'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Syringe, AlertTriangle, CalendarDays, CheckCircle2,
  Send, ArrowRight, Clock,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { apiClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VaccinationRecord {
  id: string;
  child: string;
  child_name: string;
  vaccine: string;
  vaccine_name: string;
  vaccine_code: string;
  dose_number: number;
  scheduled_date: string;
  administered_date: string | null;
  administered_by_name: string | null;
  status: 'SCHEDULED' | 'DONE' | 'MISSED' | 'SKIPPED';
  batch_number: string;
  is_overdue: boolean;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function listVaccinations(params: Record<string, unknown>): Promise<{
  items: VaccinationRecord[];
  count: number;
}> {
  const { data } = await apiClient.get('/vaccinations/', { params });
  const items = data.data ?? data.results ?? [];
  const count = data.pagination?.count ?? data.count ?? items.length;
  return { items, count };
}

async function sendBulkReminder(campId: string) {
  const { data } = await apiClient.post('/vaccinations/bulk-remind/', { camp_id: campId });
  return data;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status, overdue }: { status: string; overdue: boolean }) {
  if (status === 'DONE') return <Badge variant="success">Done</Badge>;
  if (status === 'MISSED') return <Badge variant="danger">Missed</Badge>;
  if (status === 'SKIPPED') return <Badge variant="default">Skipped</Badge>;
  if (overdue) return <Badge variant="danger">Overdue</Badge>;
  return <Badge variant="warn">Scheduled</Badge>;
}

function VaxTable({
  title, icon, items, isLoading, emptyTitle, emptyDesc,
}: {
  title: string;
  icon: React.ReactNode;
  items: VaccinationRecord[];
  isLoading: boolean;
  emptyTitle: string;
  emptyDesc: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
        <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{title}</h3>
        {!isLoading && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}>{items.length}</span>}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDesc} />
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {items.map((r, idx) => (
            <div
              key={r.id}
              className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
              style={{ borderColor: 'var(--border)', backgroundColor: idx % 2 === 0 ? 'var(--bg-elev)' : 'transparent' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                    {r.child_name}
                  </p>
                  <StatusBadge status={r.status} overdue={r.is_overdue} />
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {r.vaccine_name}
                  {r.administered_date
                    ? ` · Given ${new Date(r.administered_date).toLocaleDateString()}`
                    : ` · Due ${new Date(r.scheduled_date).toLocaleDateString()}`}
                  {r.administered_by_name && ` · by ${r.administered_by_name}`}
                  {r.batch_number && ` · Batch: ${r.batch_number}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'today',    label: 'Today',    icon: <Clock size={14} /> },
  { key: 'overdue',  label: 'Overdue',  icon: <AlertTriangle size={14} /> },
  { key: 'upcoming', label: 'Upcoming', icon: <CalendarDays size={14} /> },
  { key: 'history',  label: 'History',  icon: <CheckCircle2 size={14} /> },
] as const;

type Tab = typeof TABS[number]['key'];

export default function NurseVaccinesPage() {
  const user   = useAuthStore((s) => s.user);
  const campId = user?.camp ?? undefined;
  const qc     = useQueryClient();
  const [tab, setTab] = useState<Tab>('today');

  const todayStr = new Date().toISOString().split('T')[0];

  // Today's scheduled vaccinations
  const { data: todayScheduledData, isLoading: todayScheduledLoading } = useQuery({
    queryKey: ['nurse', 'vax', 'today-scheduled', campId, todayStr],
    queryFn: () => listVaccinations({ child__camp: campId, status: 'SCHEDULED', scheduled_date: todayStr, page_size: 200 }),
    enabled: !!campId,
    staleTime: 30_000,
  });

  // Today's done vaccinations
  const { data: todayDoneData, isLoading: todayDoneLoading } = useQuery({
    queryKey: ['nurse', 'vax', 'today-done', campId, todayStr],
    queryFn: () => listVaccinations({ child__camp: campId, status: 'DONE', scheduled_date: todayStr, page_size: 200 }),
    enabled: !!campId,
    staleTime: 30_000,
  });

  // Today's missed vaccinations
  const { data: todayMissedData, isLoading: todayMissedLoading } = useQuery({
    queryKey: ['nurse', 'vax', 'today-missed', campId, todayStr],
    queryFn: () => listVaccinations({ child__camp: campId, status: 'MISSED', scheduled_date: todayStr, page_size: 200 }),
    enabled: !!campId,
    staleTime: 30_000,
  });

  // Overdue — scheduled but past due date
  const { data: overdueData, isLoading: overdueLoading } = useQuery({
    queryKey: ['nurse', 'vax', 'overdue', campId],
    queryFn: () => listVaccinations({ child__camp: campId, status: 'SCHEDULED', is_overdue: true, page_size: 100 }),
    enabled: !!campId,
    staleTime: 30_000,
  });

  // Upcoming — scheduled, not yet due (next 30 days)
  const { data: upcomingData, isLoading: upcomingLoading } = useQuery({
    queryKey: ['nurse', 'vax', 'upcoming', campId],
    queryFn: () => listVaccinations({
      child__camp: campId,
      status: 'SCHEDULED',
      page_size: 100,
    }),
    enabled: !!campId,
    staleTime: 30_000,
  });

  // History — done vaccinations
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['nurse', 'vax', 'history', campId],
    queryFn: () => listVaccinations({ child__camp: campId, status: 'DONE', page_size: 100 }),
    enabled: !!campId,
    staleTime: 60_000,
  });

  const bulkRemindMut = useMutation({
    mutationFn: () => sendBulkReminder(campId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nurse', 'vax'] }),
  });

  // Client-side filter by today in case backend doesn't support scheduled_date param
  const todayScheduledItems = (todayScheduledData?.items ?? []).filter((r) => r.scheduled_date === todayStr);
  const todayDoneItems      = (todayDoneData?.items ?? []).filter((r) => r.scheduled_date === todayStr);
  const todayMissedItems    = (todayMissedData?.items ?? []).filter((r) => r.scheduled_date === todayStr);

  const overdueItems  = overdueData?.items ?? [];
  const upcomingItems = (upcomingData?.items ?? []).filter((r) => !r.is_overdue);
  const historyItems  = historyData?.items ?? [];

  const overdueCount  = overdueItems.length;
  const todayCount    = todayScheduledItems.length;

  // Group today's scheduled items by vaccine_name
  const todayByVaccine = todayScheduledItems.reduce<Record<string, VaccinationRecord[]>>((acc, r) => {
    if (!acc[r.vaccine_name]) acc[r.vaccine_name] = [];
    acc[r.vaccine_name].push(r);
    return acc;
  }, {});

  const todayLoading = todayScheduledLoading || todayDoneLoading || todayMissedLoading;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
            Vaccinations
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Track scheduled, overdue, and completed doses for your camp.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {overdueCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => bulkRemindMut.mutate()}
              loading={bulkRemindMut.isPending}
              disabled={!campId}
              title="Send SMS reminders to parents of overdue children"
            >
              <Send size={13} className="mr-1.5" aria-hidden="true" />
              Remind {overdueCount} overdue
            </Button>
          )}
          <Link
            href="/nurse/vaccines/session"
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl border transition-colors hover:opacity-80"
            style={{ borderColor: 'var(--ink)', color: 'var(--ink)', backgroundColor: 'transparent' }}
          >
            <Syringe size={13} aria-hidden="true" />
            Clinic sessions
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Today',    value: todayCount,           color: 'var(--primary)',  bg: 'var(--bg-elev)'  },
          { label: 'Overdue',  value: overdueCount,         color: 'var(--danger)',   bg: 'var(--high-bg)'  },
          { label: 'Upcoming', value: upcomingItems.length, color: 'var(--warn)',     bg: 'var(--med-bg)'   },
          { label: 'Done',     value: historyItems.length,  color: 'var(--success)',  bg: 'var(--low-bg)'   },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="rounded-2xl border p-4 flex flex-col gap-1" style={{ borderColor: 'var(--border)', backgroundColor: bg }}>
            <p className="text-2xl font-bold" style={{ color, fontFamily: 'var(--font-fraunces)' }}>{value}</p>
            <p className="text-xs font-medium" style={{ color }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
            style={{
              borderColor: tab === key ? 'var(--ink)' : 'transparent',
              color: tab === key ? 'var(--ink)' : 'var(--text-muted)',
            }}
          >
            {icon}
            {label}
            {key === 'today' && todayCount > 0 && (
              <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>
                {todayCount}
              </span>
            )}
            {key === 'overdue' && overdueCount > 0 && (
              <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: 'var(--danger)', color: '#fff' }}>
                {overdueCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'today' && (
        <div className="flex flex-col gap-5">
          {/* Summary bar */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm flex-1" style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
              <Clock size={14} style={{ color: 'var(--primary)' }} aria-hidden="true" />
              <span style={{ color: 'var(--ink)' }}>
                <strong>{todayCount}</strong> vaccination{todayCount !== 1 ? 's' : ''} scheduled for today
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm flex-1" style={{ backgroundColor: 'var(--low-bg)', border: '1px solid var(--border)' }}>
              <CheckCircle2 size={14} style={{ color: 'var(--success)' }} aria-hidden="true" />
              <span style={{ color: 'var(--ink)' }}>
                <strong>{todayDoneItems.length}</strong> already done today
              </span>
            </div>
          </div>

          {todayLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : todayCount === 0 && todayDoneItems.length === 0 ? (
            <EmptyState
              title="No vaccinations scheduled today"
              description="No doses are scheduled for today in your camp."
            />
          ) : (
            <div className="flex flex-col gap-5">
              {/* Grouped by vaccine */}
              {Object.keys(todayByVaccine).length > 0 && (
                <div className="flex flex-col gap-4">
                  <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>Scheduled today</h3>
                  {Object.entries(todayByVaccine).map(([vaccineName, records]) => (
                    <div key={vaccineName} className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{vaccineName}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}>
                          {records.length} child{records.length !== 1 ? 'ren' : ''}
                        </span>
                      </div>
                      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                        {records.map((r, idx) => (
                          <div
                            key={r.id}
                            className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
                            style={{ borderColor: 'var(--border)', backgroundColor: idx % 2 === 0 ? 'var(--bg-elev)' : 'transparent' }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{r.child_name}</p>
                                <StatusBadge status={r.status} overdue={r.is_overdue} />
                              </div>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                Dose {r.dose_number} · Due {new Date(r.scheduled_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Done today */}
              {todayDoneItems.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>Completed today</h3>
                  <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                    {todayDoneItems.map((r, idx) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
                        style={{ borderColor: 'var(--border)', backgroundColor: idx % 2 === 0 ? 'var(--low-bg)' : 'transparent' }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{r.child_name}</p>
                            <StatusBadge status={r.status} overdue={false} />
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {r.vaccine_name} · Dose {r.dose_number}
                            {r.administered_by_name && ` · by ${r.administered_by_name}`}
                            {r.batch_number && ` · Batch: ${r.batch_number}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missed today */}
              {todayMissedItems.length > 0 && (
                <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'var(--high-bg)', color: 'var(--danger)' }}>
                  <AlertTriangle size={14} aria-hidden="true" />
                  {todayMissedItems.length} child{todayMissedItems.length !== 1 ? 'ren' : ''} missed their appointment today.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'overdue' && (
        <div className="flex flex-col gap-4">
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'var(--high-bg)', color: 'var(--danger)' }}>
              <AlertTriangle size={14} aria-hidden="true" />
              {overdueCount} child{overdueCount !== 1 ? 'ren' : ''} missed their scheduled vaccination.
              Use "Remind overdue" to send SMS reminders to their guardians.
            </div>
          )}
          <VaxTable
            title="Overdue vaccinations"
            icon={<AlertTriangle size={16} />}
            items={overdueItems}
            isLoading={overdueLoading}
            emptyTitle="No overdue vaccinations"
            emptyDesc="All children in your camp are up to date."
          />
        </div>
      )}

      {tab === 'upcoming' && (
        <VaxTable
          title="Upcoming (next 30 days)"
          icon={<Clock size={16} />}
          items={upcomingItems}
          isLoading={upcomingLoading}
          emptyTitle="No upcoming vaccinations"
          emptyDesc="No doses scheduled in the next 30 days."
        />
      )}

      {tab === 'history' && (
        <VaxTable
          title="Vaccination history"
          icon={<CheckCircle2 size={16} />}
          items={historyItems}
          isLoading={historyLoading}
          emptyTitle="No completed vaccinations"
          emptyDesc="No doses have been administered yet."
        />
      )}
    </div>
  );
}
