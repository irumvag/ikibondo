'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertTriangle, CheckCircle, RefreshCw, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface DHIS2Status {
  configured: boolean;
  base_url: string | null;
  last_sync: string | null;
  pending_conflicts: number;
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

async function getDHIS2Status(): Promise<DHIS2Status> {
  const { data } = await apiClient.get('/integrations/dhis2/status/');
  return data.data ?? data;
}

async function listDHIS2Conflicts(): Promise<DHIS2Conflict[]> {
  const { data } = await apiClient.get('/integrations/dhis2/conflicts/');
  const payload = data.data ?? data;
  return payload?.results ?? (Array.isArray(payload) ? payload : []);
}

async function retryDHIS2Conflict(id: string): Promise<void> {
  await apiClient.post(`/integrations/dhis2/conflicts/${id}/retry/`);
}

export default function DHIS2Page() {
  const qc = useQueryClient();

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['admin', 'dhis2', 'status'],
    queryFn: getDHIS2Status,
    retry: false,
  });

  const { data: conflicts = [], isLoading: conflictsLoading } = useQuery({
    queryKey: ['admin', 'dhis2', 'conflicts'],
    queryFn: listDHIS2Conflicts,
    retry: false,
  });

  const retryMutation = useMutation({
    mutationFn: retryDHIS2Conflict,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'dhis2'] }),
  });

  const pending = conflicts.filter((c) => !c.resolved);
  const resolved = conflicts.filter((c) => c.resolved);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          DHIS2 Integration
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Sync status and conflict resolution queue
        </p>
      </div>

      {/* Status card */}
      <div
        className="rounded-2xl border p-6 flex flex-col gap-5"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        <div className="flex items-center gap-2">
          <Activity size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>Connection status</p>
        </div>

        {statusLoading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 rounded" />)}
          </div>
        ) : !status ? (
          <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ backgroundColor: 'color-mix(in srgb, var(--warn) 10%, transparent)' }}
          >
            <AlertTriangle size={18} style={{ color: 'var(--warn)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--warn)' }}>
              DHIS2 integration endpoint not available. Configure DHIS2_BASE_URL and credentials in settings.
            </span>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Status
              </span>
              <div className="flex items-center gap-2">
                {status.configured
                  ? <><CheckCircle size={16} style={{ color: 'var(--success)' }} /><span className="text-sm font-medium" style={{ color: 'var(--success)' }}>Configured</span></>
                  : <><XCircle size={16} style={{ color: 'var(--danger)' }} /><span className="text-sm font-medium" style={{ color: 'var(--danger)' }}>Not configured</span></>}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Base URL
              </span>
              <span className="text-sm font-mono" style={{ color: 'var(--ink)' }}>
                {status.base_url ?? '—'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Last sync
              </span>
              <span className="text-sm" style={{ color: 'var(--ink)' }}>
                {status.last_sync ? new Date(status.last_sync).toLocaleString() : 'Never'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Pending conflicts
              </span>
              <span
                className="text-sm font-bold"
                style={{ color: (status.pending_conflicts ?? 0) > 0 ? 'var(--danger)' : 'var(--success)' }}
              >
                {status.pending_conflicts ?? 0}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Conflict queue */}
      <section aria-labelledby="conflicts-heading">
        <div className="flex items-center justify-between mb-4">
          <h3 id="conflicts-heading" className="font-semibold flex items-center gap-2" style={{ color: 'var(--ink)' }}>
            <AlertTriangle size={16} style={{ color: 'var(--danger)' }} aria-hidden="true" />
            Sync conflict queue
            {pending.length > 0 && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ backgroundColor: 'color-mix(in srgb, var(--danger) 15%, transparent)', color: 'var(--danger)' }}
              >
                {pending.length}
              </span>
            )}
          </h3>
        </div>

        {conflictsLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : conflicts.length === 0 ? (
          <div
            className="rounded-2xl border p-6 text-center"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
          >
            <CheckCircle size={24} className="mx-auto mb-2" style={{ color: 'var(--success)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No sync conflicts. All records are in sync with DHIS2.
            </p>
          </div>
        ) : (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
          >
            {[...pending, ...resolved].map((c) => (
              <div
                key={c.id}
                className="flex items-start gap-4 px-4 py-4 border-b last:border-b-0"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant={c.resolved ? 'success' : 'danger'}>
                      {c.resolved ? 'Resolved' : 'Pending'}
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
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {c.error_detail} · {c.retry_count} retries · {new Date(c.created_at).toLocaleString()}
                  </p>
                </div>
                {!c.resolved && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={retryMutation.isPending && retryMutation.variables === c.id}
                    onClick={() => retryMutation.mutate(c.id)}
                  >
                    <RefreshCw size={12} className="mr-1" aria-hidden="true" />
                    Retry
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--text-muted)' }}>
        <p>
          <strong style={{ color: 'var(--ink)' }}>Note:</strong>{' '}
          DHIS2 push is best-effort and non-blocking. Failed pushes land here for manual retry or
          resolution. Set <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-elev)' }}>DHIS2_BASE_URL</code>,{' '}
          <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-elev)' }}>DHIS2_USERNAME</code>, and{' '}
          <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-elev)' }}>DHIS2_PASSWORD</code> in environment to enable sync.
        </p>
      </div>
    </div>
  );
}
