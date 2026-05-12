'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Flag, Loader2, CheckCircle, Brain } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HighRiskRecord {
  id: string;
  child: string;
  child_name: string;
  measurement_date: string;
  risk_level: 'HIGH';
  risk_factors: { feature: string; value: number }[] | null;
  ml_confidence: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  muac_cm: number | null;
  nutrition_status: string | null;
}

// ── Data fetching — paginated, cached 2 min ───────────────────────────────────

async function fetchHighRisk(): Promise<HighRiskRecord[]> {
  const { data } = await apiClient.get('/health-records/', {
    params: { risk_level: 'HIGH', page_size: 50, ordering: '-measurement_date' },
  });
  // Backend wraps in { data: { results: [...], count: N } } for paginated endpoints
  const payload = data?.data ?? data;
  if (Array.isArray(payload)) return payload;
  if (payload?.results) return payload.results as HighRiskRecord[];
  return [];
}

async function openConsultation(childId: string): Promise<void> {
  await apiClient.post('/consultations/', {
    child: childId,
    disputed_classification: true,
  });
}

// ── Record card ───────────────────────────────────────────────────────────────

function HighRiskCard({
  rec,
  onDispute,
  disputed,
  disputing,
}: {
  rec: HighRiskRecord;
  onDispute: () => void;
  disputed: boolean;
  disputing: boolean;
}) {
  const factors = Array.isArray(rec.risk_factors) ? rec.risk_factors.slice(0, 4) : [];
  const confidence = rec.ml_confidence ? Math.round(parseFloat(rec.ml_confidence) * 100) : null;

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-3"
      style={{
        borderColor: 'color-mix(in srgb, var(--danger) 30%, var(--border))',
        backgroundColor: 'color-mix(in srgb, var(--danger) 5%, var(--bg-elev))',
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle
            size={16}
            className="shrink-0"
            style={{ color: 'var(--danger)' }}
            aria-hidden="true"
          />
          <p className="font-semibold truncate" style={{ color: 'var(--ink)' }}>
            {rec.child_name}
          </p>
          <Badge variant="danger" className="shrink-0">HIGH RISK</Badge>
        </div>

        {disputed ? (
          <span
            className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: 'color-mix(in srgb, var(--success) 10%, transparent)', color: 'var(--success)' }}
          >
            <CheckCircle size={13} aria-hidden="true" />
            Disputed
          </span>
        ) : (
          <button
            type="button"
            onClick={onDispute}
            disabled={disputing}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80 disabled:opacity-50"
            style={{
              borderColor: 'color-mix(in srgb, var(--warn) 60%, var(--border))',
              backgroundColor: 'color-mix(in srgb, var(--warn) 8%, var(--bg-elev))',
              color: 'var(--warn)',
            }}
            aria-label={`Dispute classification for ${rec.child_name}`}
          >
            {disputing
              ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              : <Flag size={13} aria-hidden="true" />}
            Dispute
          </button>
        )}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>Assessment: {new Date(rec.measurement_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
        {confidence !== null && (
          <span className="flex items-center gap-1">
            <Brain size={11} aria-hidden="true" />
            AI confidence: <strong style={{ color: 'var(--ink)' }}>{confidence}%</strong>
          </span>
        )}
        {rec.muac_cm != null && <span>MUAC: {rec.muac_cm} cm</span>}
        {rec.weight_kg != null && <span>Weight: {rec.weight_kg} kg</span>}
        {rec.nutrition_status && (
          <Badge variant={rec.nutrition_status === 'SAM' ? 'danger' : rec.nutrition_status === 'MAM' ? 'warn' : 'default'}>
            {rec.nutrition_status}
          </Badge>
        )}
      </div>

      {/* Risk factor chips */}
      {factors.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {factors.map((f, i) => (
            <span
              key={i}
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--danger) 12%, var(--bg-elev))',
                color: 'var(--danger)',
                border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)',
              }}
            >
              {typeof f === 'object' && 'feature' in f
                ? (f.feature as string).replace(/_/g, ' ')
                : String(f)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AIOverviewPage() {
  const qc = useQueryClient();
  const [disputedIds, setDisputedIds] = useState<Set<string>>(new Set());
  const [disputingId, setDisputingId] = useState<string | null>(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['supervisor', 'high-risk'],
    queryFn: fetchHighRisk,
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  const disputeMut = useMutation({
    mutationFn: (childId: string) => openConsultation(childId),
    onMutate: (childId) => setDisputingId(childId),
    onSuccess: (_, childId) => {
      setDisputedIds((prev) => new Set([...prev, childId]));
      setDisputingId(null);
      qc.invalidateQueries({ queryKey: ['supervisor', 'high-risk'] });
    },
    onError: () => setDisputingId(null),
  });

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          AI Oversight
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          High-risk ML classifications in your camp. Confirm or dispute each assessment to open a consultation thread.
        </p>
      </div>

      {/* Summary bar */}
      {!isLoading && records.length > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--danger) 8%, var(--bg-elev))',
            border: '1px solid color-mix(in srgb, var(--danger) 20%, var(--border))',
            color: 'var(--danger)',
          }}
        >
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            <strong>{records.length}</strong> child{records.length !== 1 ? 'ren' : ''} flagged HIGH risk ·{' '}
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
              {disputedIds.size} disputed this session
            </span>
          </span>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={<CheckCircle size={28} />}
          title="No high-risk flags"
          description="No children are currently classified as high risk in your camp."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {records.map((rec) => (
            <HighRiskCard
              key={rec.id}
              rec={rec}
              disputed={disputedIds.has(rec.child)}
              disputing={disputingId === rec.child}
              onDispute={() => disputeMut.mutate(rec.child)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
