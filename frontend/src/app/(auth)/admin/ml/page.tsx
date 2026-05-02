'use client';

import { Cpu, CheckCircle, XCircle, Calendar, Tag, Activity, Layers } from 'lucide-react';
import { useModelInfo } from '@/lib/api/queries';
import { Skeleton } from '@/components/ui/Skeleton';

function MetricRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between py-3 border-b last:border-b-0"
      style={{ borderColor: 'var(--border)' }}
    >
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  );
}

function PctBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-sand)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(value * 100, 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-sm font-semibold w-12 text-right" style={{ color: 'var(--ink)' }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

export default function MLModelPage() {
  const { data: info, isLoading, isError } = useModelInfo();

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          ML Model
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Unified malnutrition risk classifier powering all predictions.
        </p>
      </div>

      {/* Model status card */}
      <div
        className="rounded-2xl border p-6 flex flex-col gap-5"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
          </div>
        ) : isError ? (
          <p className="text-sm" style={{ color: 'var(--danger)' }}>
            Could not load model metadata. Ensure the backend is running.
          </p>
        ) : (
          <>
            {/* Status banner */}
            <div
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{
                backgroundColor: info!.model_loaded ? 'var(--success-bg, #f0fdf4)' : 'var(--warn-bg, #fffbeb)',
                color: info!.model_loaded ? 'var(--success)' : 'var(--warn)',
              }}
            >
              {info!.model_loaded
                ? <CheckCircle size={20} aria-hidden="true" />
                : <XCircle size={20} aria-hidden="true" />}
              <span className="font-semibold text-sm">
                {info!.model_loaded ? 'Model loaded and ready' : 'Model not loaded — run training script'}
              </span>
            </div>

            {/* Metrics */}
            <div>
              <MetricRow
                label="Version"
                value={
                  <span className="flex items-center gap-1.5">
                    <Tag size={13} aria-hidden="true" />
                    {info!.version}
                  </span>
                }
              />
              <MetricRow
                label="Trained at"
                value={
                  info!.trained_at
                    ? <span className="flex items-center gap-1.5">
                        <Calendar size={13} aria-hidden="true" />
                        {new Date(info!.trained_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
                      </span>
                    : '—'
                }
              />
              <MetricRow
                label="Feature count"
                value={
                  <span className="flex items-center gap-1.5">
                    <Layers size={13} aria-hidden="true" />
                    {info!.n_features} features
                  </span>
                }
              />
            </div>

            {/* Accuracy metrics */}
            {(info!.macro_f1 != null || info!.high_recall != null) && (
              <div className="flex flex-col gap-4">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Performance metrics
                </p>
                {info!.macro_f1 != null && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        <Activity size={13} className="inline mr-1" aria-hidden="true" />
                        Macro F1
                      </span>
                    </div>
                    <PctBar value={info!.macro_f1} color="var(--ink)" />
                  </div>
                )}
                {info!.high_recall != null && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        <Activity size={13} className="inline mr-1" aria-hidden="true" />
                        HIGH-risk recall
                      </span>
                    </div>
                    <PctBar value={info!.high_recall} color="var(--danger, #ef4444)" />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Info note */}
      <div
        className="rounded-xl p-4 text-sm"
        style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}
      >
        <p>
          <strong style={{ color: 'var(--ink)' }}>To retrain:</strong> run{' '}
          <code className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-elev)' }}>
            python -m apps.ml_engine.training.train_model
          </code>{' '}
          from the backend directory. The model file and metadata will be saved automatically.
        </p>
      </div>
    </div>
  );
}
