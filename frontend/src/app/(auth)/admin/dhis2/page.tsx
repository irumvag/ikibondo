'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, CheckCircle, RefreshCw,
  XCircle, Play, ArrowDownUp, Upload, Download,
  Clock, ChevronDown, ChevronUp,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

// ── types ─────────────────────────────────────────────────────────────────────

interface SyncSummary {
  pulled: number;
  upserted: number;
  pushed_children: number;
  pushed_vaccinations: number;
  errors: string[];
  synced_at: string;
}

interface DHIS2Status {
  configured: boolean;
  dhis2_url: string | null;
  last_sync: SyncSummary | null;
}

interface DHIS2Conflict {
  id: string;
  object_type: string;
  object_id: string;
  object_repr: string;
  error_code: string;
  error_detail: string;
  retry_count: number;
  resolved: boolean;
  created_at: string;
}

// ── API functions ─────────────────────────────────────────────────────────────

async function getDHIS2Status(): Promise<DHIS2Status> {
  const { data } = await apiClient.get('/integrations/dhis2/status/');
  return data.data ?? data;
}

async function triggerDHIS2Sync(since?: string): Promise<SyncSummary> {
  const body = since ? { since } : {};
  const { data } = await apiClient.post('/integrations/dhis2/sync/', body);
  return data.data ?? data;
}

async function listDHIS2Conflicts(): Promise<DHIS2Conflict[]> {
  const { data } = await apiClient.get('/integrations/dhis2/conflicts/');
  const payload = data.data ?? data;
  return payload?.results ?? (Array.isArray(payload) ? payload : []);
}

async function retryConflict(id: string): Promise<void> {
  await apiClient.post(`/integrations/dhis2/conflicts/${id}/retry/`);
}

// ── SyncSummaryCard ───────────────────────────────────────────────────────────

function SyncSummaryCard({ summary, title }: { summary: SyncSummary; title: string }) {
  const t = useTranslations('admin.dhis2');
  const [showErrors, setShowErrors] = useState(false);

  const stats = [
    { label: t('pulledFromDhis2'),     value: summary.pulled,              icon: Download,    color: '#3b82f6' },
    { label: t('recordsUpserted'),      value: summary.upserted,            icon: ArrowDownUp, color: '#3b82f6' },
    { label: t('childrenPushed'),       value: summary.pushed_children,     icon: Upload,      color: '#10b981' },
    { label: t('vaccinationsPushed'),   value: summary.pushed_vaccinations, icon: Upload,      color: '#10b981' },
  ];

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-4"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="font-semibold" style={{ color: 'var(--ink)' }}>{title}</p>
        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
          <Clock size={12} />
          {new Date(summary.synced_at).toLocaleString()}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl p-3 flex flex-col gap-1" style={{ backgroundColor: 'var(--bg)' }}>
            <Icon size={14} style={{ color }} aria-hidden="true" />
            <p className="text-xl font-bold" style={{ color: 'var(--ink)' }}>{value}</p>
            <p className="text-xs leading-tight" style={{ color: 'var(--text-muted)' }}>{label}</p>
          </div>
        ))}
      </div>

      {summary.errors.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setShowErrors((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium"
            style={{ color: '#ef4444' }}
          >
            <AlertTriangle size={12} />{t('errorCount', { count: summary.errors.length })}
            {showErrors ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showErrors && (
            <ul className="mt-2 flex flex-col gap-1">
              {summary.errors.map((e, i) => (
                <li
                  key={i}
                  className="text-xs px-3 py-1.5 rounded-lg font-mono"
                  style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}
                >
                  {e}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-xs flex items-center gap-1.5" style={{ color: '#10b981' }}>
          <CheckCircle size={12} />{t('noErrorsDuringSync')}</p>
      )}
    </div>
  );
}

// ── ManualSyncPanel ───────────────────────────────────────────────────────────

function ManualSyncPanel({ configured }: { configured: boolean }) {
  const t = useTranslations('admin.dhis2');
  const qc = useQueryClient();
  const [since, setSince] = useState('');
  const [lastResult, setLastResult] = useState<SyncSummary | null>(null);

  const syncMut = useMutation({
    mutationFn: () => triggerDHIS2Sync(since || undefined),
    onSuccess: (summary) => {
      setLastResult(summary);
      qc.invalidateQueries({ queryKey: ['admin', 'dhis2', 'status'] });
    },
  });

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-4"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
    >
      <div className="flex items-center gap-2">
        <Play size={15} style={{ color: 'var(--text-muted)' }} />
        <p className="font-semibold" style={{ color: 'var(--ink)' }}>{t('manualSyncTrigger')}</p>
      </div>

      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('runsAFullBidirectional')}</p>

      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="dhis2-since-date-optional" className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('sinceDateOptional')}</label>
          <input id="dhis2-since-date-optional"
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--ink)' }}
          />
        </div>
        <Button
          variant="primary"
          disabled={!configured || syncMut.isPending}
          loading={syncMut.isPending}
          onClick={() => syncMut.mutate()}
        >
          <RefreshCw size={14} className="mr-1.5" aria-hidden="true" />
          {syncMut.isPending ? t('syncing') : t('runSyncNow')}
        </Button>
      </div>

      {!configured && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: '#f59e0b' }}>
          <AlertTriangle size={12} />{t('dhis2CredentialsNotConfigured')}</p>
      )}

      {syncMut.isError && (
        <p className="text-xs" style={{ color: '#ef4444' }}>{t('syncFailedDhis2May')}</p>
      )}

      {lastResult && <SyncSummaryCard summary={lastResult} title={t('syncResult')} />}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DHIS2Page() {
  const t = useTranslations('admin.dhis2');
  const qc = useQueryClient();

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['admin', 'dhis2', 'status'],
    queryFn: getDHIS2Status,
    retry: false,
    refetchInterval: 60_000,
  });

  const { data: conflicts = [], isLoading: conflictsLoading } = useQuery({
    queryKey: ['admin', 'dhis2', 'conflicts'],
    queryFn: listDHIS2Conflicts,
    retry: false,
  });

  const retryMut = useMutation({
    mutationFn: retryConflict,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'dhis2', 'conflicts'] }),
  });

  const pending  = conflicts.filter((c) => !c.resolved);
  const resolved = conflicts.filter((c) =>  c.resolved);

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full">

      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >{t('dhis2Integration')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('rwandaHmisETracker')}</p>
      </div>

      {/* Connection status */}
      <div
        className="rounded-2xl border p-5 flex flex-col gap-4"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        <div className="flex items-center gap-2">
          <Activity size={15} style={{ color: 'var(--text-muted)' }} />
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>{t('connectionStatus')}</p>
        </div>

        {statusLoading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 rounded" />)}
          </div>
        ) : !status ? (
          <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ backgroundColor: '#fef3c7' }}
          >
            <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
            <span className="text-sm font-medium" style={{ color: '#b45309' }}>{t('statusEndpointUnreachableCheck')}</span>
          </div>
        ) : (
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('status')}</span>
              <div className="flex items-center gap-2">
                {status.configured ? (
                  <><CheckCircle size={15} style={{ color: '#10b981' }} />
                  <span className="text-sm font-medium" style={{ color: '#10b981' }}>{t('configured')}</span></>
                ) : (
                  <><XCircle size={15} style={{ color: '#ef4444' }} />
                  <span className="text-sm font-medium" style={{ color: '#ef4444' }}>{t('notConfigured')}</span></>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('dhis2Url')}</span>
              <span className="text-sm font-mono truncate" style={{ color: 'var(--ink)' }}>
                {status.dhis2_url ?? '—'}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('lastBatchSync')}</span>
              <span className="text-sm" style={{ color: 'var(--ink)' }}>
                {status.last_sync
                  ? new Date(status.last_sync.synced_at).toLocaleString()
                  : t('never')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Last sync summary */}
      {status?.last_sync && (
        <SyncSummaryCard summary={status.last_sync} title={t('lastBatchSyncSummary')} />
      )}

      {/* Manual trigger */}
      <ManualSyncPanel configured={status?.configured ?? false} />

      {/* Conflict queue */}
      <section aria-labelledby="conflicts-heading">
        <div className="flex items-center gap-3 mb-4">
          <h3
            id="conflicts-heading"
            className="font-semibold flex items-center gap-2"
            style={{ color: 'var(--ink)' }}
          >
            <AlertTriangle size={15} style={{ color: pending.length > 0 ? '#ef4444' : 'var(--text-muted)' }} />{t('syncConflictQueue')}</h3>
          {pending.length > 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}
            >{t('pending', { length: pending.length })}</span>
          )}
        </div>

        {conflictsLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : conflicts.length === 0 ? (
          <div
            className="rounded-2xl border p-6 text-center"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
          >
            <CheckCircle size={24} className="mx-auto mb-2" style={{ color: '#10b981' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('noSyncConflictsAll')}</p>
          </div>
        ) : (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
          >
            {[...pending, ...resolved].map((c) => (
              <div
                key={c.id}
                className="flex items-start gap-4 px-5 py-4 border-b last:border-b-0"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant={c.resolved ? 'success' : 'danger'}>
                      {c.resolved ? t('resolved') : t('pending2')}
                    </Badge>
                    <span className="text-xs font-mono font-semibold" style={{ color: 'var(--ink)' }}>
                      {c.object_type}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {c.error_code}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                    {c.object_repr}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('retries', { error_detail: c.error_detail, retry_count: c.retry_count, value: new Date(c.created_at).toLocaleString() })}</p>
                </div>
                {!c.resolved && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={retryMut.isPending && retryMut.variables === c.id}
                    onClick={() => retryMut.mutate(c.id)}
                  >
                    <RefreshCw size={12} className="mr-1" aria-hidden="true" />{t('retry')}</Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Info note */}
      <div
        className="rounded-xl p-4"
        style={{ backgroundColor: 'var(--bg-sand)' }}
      >
        <p className="font-semibold text-sm mb-2" style={{ color: 'var(--ink)' }}>{t('howSyncWorks')}</p>
        <ul className="list-disc list-inside space-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <li><strong style={{ color: 'var(--ink)' }}>{t('dailyBatch')}</strong>{' '}{t('celeryBeatRunsBidirectional')}</li>
          <li><strong style={{ color: 'var(--ink)' }}>{t('realTimePush')}</strong>{' '}{t('eachNewChildRegistration')}</li>
          <li><strong style={{ color: 'var(--ink)' }}>{t('highRiskTrigger')}</strong>{' '}{t('mlHighRiskClassification')}</li>
          <li><strong style={{ color: 'var(--ink)' }}>{t('pull')}</strong>{' '}{t('recordsAddedDirectlyIn')}</li>
        </ul>
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>{t('requiredEnvVars')}{' '}
          {['DHIS2_URL', 'DHIS2_USERNAME', 'DHIS2_PASSWORD'].map((k) => (
            <code
              key={k}
              className="px-1 py-0.5 rounded mx-0.5"
              style={{ backgroundColor: 'var(--bg-elev)', color: 'var(--ink)' }}
            >
              {k}
            </code>
          ))}
        </p>
      </div>
    </div>
  );
}
