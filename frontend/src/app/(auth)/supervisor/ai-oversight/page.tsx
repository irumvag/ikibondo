'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Flag, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

interface HighRiskRecord {
  id: string;
  child: string;
  child_name: string;
  measurement_date: string;
  risk_level: 'HIGH';
  risk_factors: { feature: string; value: number }[];
  ml_confidence: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  muac_cm: number | null;
}

async function fetchHighRisk(): Promise<HighRiskRecord[]> {
  const { data } = await apiClient.get('/health-records/', { params: { risk_level: 'HIGH', page_size: 50 } });
  return data.data ?? [];
}

async function disputeClassification(childId: string): Promise<void> {
  await apiClient.post('/consultations/', { child: childId });
}

export default function AIOverviewPage() {
  const qc = useQueryClient();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['supervisor', 'high-risk'],
    queryFn: fetchHighRisk,
  });

  const disputeMut = useMutation({
    mutationFn: (childId: string) => disputeClassification(childId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supervisor', 'high-risk'] }),
  });

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Oversight</h1>
        <p className="mt-1 text-sm text-gray-500">
          High-risk ML classifications in your camp. Confirm or dispute each assessment.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle size={28} />}
          title="No high-risk flags"
          description="No children are currently classified as high risk in your camp."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {records.map((rec) => (
            <div key={rec.id} className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  <p className="font-semibold text-gray-900">{rec.child_name}</p>
                  <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">HIGH RISK</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Assessment: {rec.measurement_date}
                  {rec.ml_confidence && ` · Confidence: ${(parseFloat(rec.ml_confidence) * 100).toFixed(0)}%`}
                  {rec.muac_cm && ` · MUAC: ${rec.muac_cm} cm`}
                </p>
                {Array.isArray(rec.risk_factors) && rec.risk_factors.slice(0, 3).map((f, i) => (
                  typeof f === 'object' && 'feature' in f &&
                  <span key={i} className="inline-block text-xs text-red-700 bg-red-100 rounded px-1.5 py-0.5 mr-1 mt-1">
                    {(f as { feature: string }).feature}
                  </span>
                ))}
              </div>
              <button
                onClick={() => disputeMut.mutate(rec.child)}
                disabled={disputeMut.isPending}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-60"
              >
                {disputeMut.isPending && disputeMut.variables === rec.child
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Flag className="h-3.5 w-3.5" />
                }
                Dispute
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
