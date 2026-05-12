'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays, AlertTriangle, Clock, Syringe, CheckCircle,
  Phone, UserCircle, ChevronDown, ChevronUp, Bell,
} from 'lucide-react';
import { useDailyPlan, useCHWFamilies } from '@/lib/api/queries';
import type { DailyPlanItem } from '@/lib/api/chw';
import type { CHWFamily, CHWChildSummary } from '@/lib/api/chw';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

// ── helpers ────────────────────────────────────────────────────────────────────

const RISK_COLOR: Record<string, string> = {
  HIGH: 'var(--danger)', MEDIUM: 'var(--warn)', LOW: 'var(--success)', UNKNOWN: 'var(--text-muted)',
};
const RISK_VARIANT: Record<string, 'danger' | 'warn' | 'success' | 'default'> = {
  HIGH: 'danger', MEDIUM: 'warn', LOW: 'success', UNKNOWN: 'default',
};

function RiskDot({ level }: { level: string }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
      background: RISK_COLOR[level] ?? RISK_COLOR.UNKNOWN,
    }} />
  );
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ── main page ──────────────────────────────────────────────────────────────────

export default function CHWTodayPage() {
  const router = useRouter();
  const [visited, setVisited]   = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['all']));

  // Fetch both in parallel — daily-plan gives authoritative priority scores,
  // families gives guardian grouping & full child details
  const { data: planItems = [], isLoading: planLoading }     = useDailyPlan();
  const { data: families  = [], isLoading: familiesLoading } = useCHWFamilies();

  const isLoading = planLoading || familiesLoading;

  // Build lookup: child_id → DailyPlanItem for priority data
  const planMap = new Map<string, DailyPlanItem>(planItems.map((p) => [p.child_id, p]));

  // Helper: get server priority score for a child (falls back to 0)
  const getScore = (childId: string) => planMap.get(childId)?.priority_score ?? 0;

  const toggleFamily = (id: string) =>
    setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Separate into priority vs all-clear based on server score
  const activeFamilies = families.filter((f) => f.children.some((c) => getScore(c.id) > 0));
  const quietFamilies  = families.filter((f) => f.children.every((c) => getScore(c.id) === 0));

  // Count totals from plan (more accurate than local compute)
  const toVisit = planItems.filter((p) => p.priority_score > 0);
  const done    = toVisit.filter((p) => visited.has(p.child_id));

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays size={20} style={{ color: 'var(--primary)' }} />
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
            Today&apos;s Plan
          </h2>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{todayLabel()}</p>
      </div>

      {/* Summary cards */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard value={toVisit.length}              label="To visit"  color="var(--primary)" />
          <SummaryCard value={done.length}                 label="Done today" color="var(--success)" />
          <SummaryCard
            value={toVisit.length - done.length}
            label="Remaining"
            color={toVisit.length - done.length > 0 ? 'var(--warn)' : 'var(--success)'}
          />
        </div>
      )}

      {/* Progress bar */}
      {!isLoading && toVisit.length > 0 && (
        <div className="rounded-xl border p-3.5 flex items-center gap-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1.5">
              <span style={{ color: 'var(--ink)' }}>Visit progress</span>
              <span style={{ color: 'var(--text-muted)' }}>{done.length} / {toVisit.length} children</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.round((done.length / toVisit.length) * 100)}%`,
                  background: done.length === toVisit.length ? 'var(--success)' : 'var(--primary)',
                }}
              />
            </div>
          </div>
          {done.length === toVisit.length && (
            <CheckCircle size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />
          )}
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : families.length === 0 ? (
        <EmptyState
          icon={<CheckCircle size={32} />}
          title="No families assigned"
          description="Your supervisor has not assigned any families yet."
        />
      ) : (
        <>
          {activeFamilies.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Needs attention · {activeFamilies.length} famil{activeFamilies.length === 1 ? 'y' : 'ies'}
              </p>
              {activeFamilies.map((family) => (
                <FamilyCard
                  key={family.id}
                  family={family}
                  planMap={planMap}
                  visited={visited}
                  expanded={expanded.has(family.id)}
                  onToggle={() => toggleFamily(family.id)}
                  onLogVisit={(childId) => router.push(`/chw/visit?child=${childId}`)}
                  onMarkDone={(childId) => setVisited((s) => new Set([...s, childId]))}
                />
              ))}
            </div>
          )}

          {quietFamilies.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Up to date · {quietFamilies.length} famil{quietFamilies.length === 1 ? 'y' : 'ies'}
              </p>
              {quietFamilies.map((family) => (
                <FamilyCard
                  key={family.id}
                  family={family}
                  planMap={planMap}
                  visited={visited}
                  expanded={expanded.has(family.id)}
                  onToggle={() => toggleFamily(family.id)}
                  onLogVisit={(childId) => router.push(`/chw/visit?child=${childId}`)}
                  onMarkDone={(childId) => setVisited((s) => new Set([...s, childId]))}
                  dimmed
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Risk legend */}
      <div className="flex gap-4 text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
        {(['HIGH', 'MEDIUM', 'LOW'] as const).map((r) => (
          <span key={r} className="flex items-center gap-1.5">
            <RiskDot level={r} />
            {r.charAt(0) + r.slice(1).toLowerCase()} risk
          </span>
        ))}
      </div>
    </div>
  );
}

// ── SummaryCard ────────────────────────────────────────────────────────────────

function SummaryCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="rounded-xl border p-3.5 flex flex-col gap-1 text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color }}>
        {value}
      </span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

// ── FamilyCard ─────────────────────────────────────────────────────────────────

function FamilyCard({ family, planMap, visited, expanded, onToggle, onLogVisit, onMarkDone, dimmed = false }: {
  family:     CHWFamily;
  planMap:    Map<string, DailyPlanItem>;
  visited:    Set<string>;
  expanded:   boolean;
  onToggle:   () => void;
  onLogVisit: (childId: string) => void;
  onMarkDone: (childId: string) => void;
  dimmed?:    boolean;
}) {
  const highRisk    = family.children.filter((c) => c.risk_level === 'HIGH').length;
  const overdueVax  = family.children.reduce((s, c) => s + c.overdue_vaccines, 0);
  const hasPending  = family.children.some((c) => planMap.get(c.id)?.has_pending_request);
  const visitedKids = family.children.filter((c) => visited.has(c.id)).length;
  const totalKids   = family.children.length;

  // Sort children by server priority score descending
  const sortedChildren = [...family.children].sort(
    (a, b) => (planMap.get(b.id)?.priority_score ?? 0) - (planMap.get(a.id)?.priority_score ?? 0),
  );

  return (
    <div
      className="rounded-xl border overflow-hidden transition-opacity"
      style={{
        borderColor: highRisk > 0 ? 'var(--danger)' : 'var(--border)',
        background: 'var(--card)',
        opacity: dimmed ? 0.75 : 1,
      }}
    >
      {/* Family header */}
      <button
        className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-[var(--bg-sand)] transition-colors"
        onClick={onToggle}
      >
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--bg-elev)' }}>
          <UserCircle size={20} style={{ color: 'var(--text-muted)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{family.full_name}</span>
            {hasPending  && <Badge variant="warn"><Bell size={9} className="mr-0.5 inline" />Visit request</Badge>}
            {highRisk > 0 && <Badge variant="danger">{highRisk} high risk</Badge>}
            {overdueVax > 0 && <Badge variant="warn">{overdueVax} overdue vax</Badge>}
            {visitedKids > 0 && (
              <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>
                {visitedKids}/{totalKids} done
              </span>
            )}
          </div>
          {family.phone_number && (
            <a
              href={`tel:${family.phone_number}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs flex items-center gap-1 mt-0.5 hover:underline"
              style={{ color: 'var(--primary)' }}
            >
              <Phone size={10} />{family.phone_number}
            </a>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {totalKids} child{totalKids !== 1 ? 'ren' : ''}
          </span>
          {expanded
            ? <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} />
            : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </button>

      {/* Children list */}
      {expanded && (
        <div className="border-t divide-y" style={{ borderColor: 'var(--border)' }}>
          {sortedChildren.map((child) => (
            <ChildPlanRow
              key={child.id}
              child={child}
              planItem={planMap.get(child.id)}
              isVisited={visited.has(child.id)}
              onLogVisit={() => onLogVisit(child.id)}
              onMarkDone={() => onMarkDone(child.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── ChildPlanRow ───────────────────────────────────────────────────────────────

function ChildPlanRow({ child, planItem, isVisited, onLogVisit, onMarkDone }: {
  child:      CHWChildSummary;
  planItem:   DailyPlanItem | undefined;
  isVisited:  boolean;
  onLogVisit: () => void;
  onMarkDone: () => void;
}) {
  const score   = planItem?.priority_score ?? 0;
  const reasons = planItem?.priority_reasons ?? [];

  return (
    <div
      className="px-4 py-3 flex items-start gap-3 transition-opacity"
      style={{ background: 'var(--bg)', opacity: isVisited ? 0.55 : 1 }}
    >
      <RiskDot level={child.risk_level} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{child.full_name}</span>
          <Badge variant={RISK_VARIANT[child.risk_level] ?? 'default'}>{child.risk_level}</Badge>
          {isVisited && (
            <span className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--success)' }}>
              <CheckCircle size={11} /> Visited
            </span>
          )}
        </div>

        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {child.age_display}{child.zone_name ? ` · ${child.zone_name}` : ''}
        </p>

        {/* Server-supplied priority reasons */}
        {score > 0 && reasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {reasons.map((reason) => (
              <ReasonChip key={reason} reason={reason} />
            ))}
          </div>
        )}

        {/* Next vaccine info when no urgent issues */}
        {score === 0 && child.next_vaccine_name && (
          <p className="text-xs mt-1" style={{ color: 'var(--success)' }}>
            ✓ Up to date · next: {child.next_vaccine_name} {child.next_vaccine_date ?? ''}
          </p>
        )}
        {score === 0 && !child.next_vaccine_name && (
          <p className="text-xs mt-1" style={{ color: 'var(--success)' }}>✓ Up to date</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1 items-end shrink-0">
        <button
          onClick={onLogVisit}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium hover:opacity-80 transition-opacity"
          style={{
            background: isVisited ? 'var(--bg-elev)' : 'var(--primary)',
            color:       isVisited ? 'var(--text-muted)' : '#fff',
            border:      isVisited ? '1px solid var(--border)' : 'none',
          }}
        >
          {isVisited ? 'Re-visit' : 'Log Visit'}
        </button>
        {!isVisited && score > 0 && (
          <button onClick={onMarkDone} className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>
            Mark done
          </button>
        )}
      </div>
    </div>
  );
}

// ── ReasonChip ─────────────────────────────────────────────────────────────────

const REASON_ICON: Record<string, React.ReactNode> = {
  'Visit request':   <Bell size={9} />,
  'High risk':       <AlertTriangle size={9} />,
  'Overdue vaccine': <Syringe size={9} />,
  'Never visited':   <Clock size={9} />,
};

function ReasonChip({ reason }: { reason: string }) {
  const icon = REASON_ICON[reason] ?? <Clock size={9} />;
  const isUrgent = reason === 'Visit request' || reason === 'High risk';
  return (
    <span
      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
      style={{
        borderColor: 'var(--border)',
        background:  'var(--bg)',
        color: isUrgent ? 'var(--danger)' : 'var(--text-muted)',
      }}
    >
      {icon}{reason}
    </span>
  );
}
