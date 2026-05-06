'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { CalendarDays, AlertTriangle, Clock, Syringe, MessageSquare, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

interface DailyPlanItem {
  child_id: string;
  child_name: string;
  registration_number: string;
  age_display: string;
  priority_score: number;
  priority_reasons: string[];
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  has_pending_request: boolean;
  has_overdue_vaccine: boolean;
  last_visit_days_ago: number | null;
}

async function fetchDailyPlan(): Promise<DailyPlanItem[]> {
  try {
    const { data } = await apiClient.get('/chw/daily-plan/');
    return data.data ?? [];
  } catch {
    // Fallback: derive from caseload ordered by risk
    const { data } = await apiClient.get('/children/', {
      params: { page_size: 50, ordering: '-risk_level' },
    });
    const items = data.data ?? data.results ?? [];
    return items.map((c: {
      id: string;
      full_name: string;
      registration_number: string;
      age_display?: string;
      risk_level?: string;
    }) => ({
      child_id: c.id,
      child_name: c.full_name,
      registration_number: c.registration_number,
      age_display: c.age_display ?? '',
      priority_score: 0,
      priority_reasons: [],
      risk_level: c.risk_level ?? 'UNKNOWN',
      has_pending_request: false,
      has_overdue_vaccine: false,
      last_visit_days_ago: null,
    }));
  }
}

const RISK_COLORS: Record<string, string> = {
  HIGH:    'var(--danger)',
  MEDIUM:  'var(--warn)',
  LOW:     'var(--success)',
  UNKNOWN: 'var(--text-muted)',
};

function RiskDot({ level }: { level: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: RISK_COLORS[level] ?? RISK_COLORS.UNKNOWN,
        flexShrink: 0,
      }}
    />
  );
}

function PriorityTag({ reason }: { reason: string }) {
  const icons: Record<string, React.ReactNode> = {
    'HIGH RISK':       <AlertTriangle size={11} />,
    'OVERDUE VACCINE': <Syringe size={11} />,
    'VISIT REQUEST':   <MessageSquare size={11} />,
    'NOT VISITED':     <Clock size={11} />,
  };
  const icon = Object.entries(icons).find(([k]) => reason.toUpperCase().includes(k))?.[1];
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
      style={{ background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
    >
      {icon}
      {reason}
    </span>
  );
}

export default function CHWTodayPage() {
  const router = useRouter();
  const [visited, setVisited] = useState<Set<string>>(new Set());

  const { data: plan = [], isLoading } = useQuery({
    queryKey: ['chw-daily-plan'],
    queryFn: fetchDailyPlan,
    staleTime: 5 * 60 * 1000,
  });

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const done = plan.filter((p) => visited.has(p.child_id)).length;

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays size={20} style={{ color: 'var(--primary)' }} />
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
            Today&apos;s Schedule
          </h2>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{today}</p>
      </div>

      {/* Progress bar */}
      {!isLoading && plan.length > 0 && (
        <div className="rounded-xl border p-4 flex items-center gap-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span style={{ color: 'var(--ink)' }}>Visits completed</span>
              <span style={{ color: 'var(--text-muted)' }}>{done} / {plan.length}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.round((done / plan.length) * 100)}%`, background: 'var(--primary)' }}
              />
            </div>
          </div>
          {done === plan.length && plan.length > 0 && (
            <CheckCircle size={20} style={{ color: 'var(--success)', flexShrink: 0 }} />
          )}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : plan.length === 0 ? (
        <EmptyState
          icon={<CheckCircle size={32} />}
          title="All clear for today"
          description="No visits are scheduled or overdue for your caseload right now."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {plan.map((item, idx) => {
            const isVisited = visited.has(item.child_id);
            return (
              <div
                key={item.child_id}
                className="rounded-xl border p-4 flex items-start gap-3 transition-opacity"
                style={{
                  background: 'var(--card)',
                  borderColor: 'var(--border)',
                  opacity: isVisited ? 0.6 : 1,
                }}
              >
                {/* Rank */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}
                >
                  {idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <RiskDot level={item.risk_level} />
                    <span className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
                      {item.child_name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {item.registration_number}
                    </span>
                    {item.age_display && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.age_display}</span>
                    )}
                  </div>

                  {/* Priority tags */}
                  {item.priority_reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.priority_reasons.map((r) => <PriorityTag key={r} reason={r} />)}
                    </div>
                  )}

                  {/* Inline tags when no reasons from API */}
                  {item.priority_reasons.length === 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.risk_level === 'HIGH' && <PriorityTag reason="High risk" />}
                      {item.has_overdue_vaccine && <PriorityTag reason="Overdue vaccine" />}
                      {item.has_pending_request && <PriorityTag reason="Visit request" />}
                      {item.last_visit_days_ago !== null && item.last_visit_days_ago > 30 && (
                        <PriorityTag reason={`Last visit ${item.last_visit_days_ago}d ago`} />
                      )}
                      {item.last_visit_days_ago === null && <PriorityTag reason="Never visited" />}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1 items-end flex-shrink-0">
                  <Button
                    size="sm"
                    variant={isVisited ? 'ghost' : 'primary'}
                    onClick={() => router.push(`/chw/visit?child=${item.child_id}`)}
                  >
                    {isVisited ? 'Re-visit' : 'Log Visit'}
                  </Button>
                  {!isVisited && (
                    <button
                      className="text-xs"
                      style={{ color: 'var(--text-muted)' }}
                      onClick={() => setVisited((s) => new Set([...s, item.child_id]))}
                    >
                      Mark done
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
        {(['HIGH', 'MEDIUM', 'LOW'] as const).map((r) => (
          <span key={r} className="flex items-center gap-1">
            <RiskDot level={r} />
            {r.charAt(0) + r.slice(1).toLowerCase()} risk
          </span>
        ))}
      </div>
    </div>
  );
}
