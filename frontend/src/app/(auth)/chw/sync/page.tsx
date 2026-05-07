'use client';

import { useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { useSyncStore, type PendingOp, type SyncResultEntry } from '@/store/syncStore';
import { syncBatch } from '@/lib/api/chw';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

const OP_LABEL: Record<PendingOp['op'], string> = {
  register_child:     'Register child',
  create_visit:       'Log visit',
  administer_vaccine: 'Administer vaccine',
};

const STATUS_ICON = {
  ok:       <CheckCircle  size={16} style={{ color: 'var(--success)' }} aria-hidden="true" />,
  error:    <XCircle      size={16} style={{ color: 'var(--danger)'  }} aria-hidden="true" />,
  conflict: <AlertTriangle size={16} style={{ color: 'var(--warn)'   }} aria-hidden="true" />,
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month:  'short',
      day:    'numeric',
      hour:   '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function SyncPage() {
  const pending         = useSyncStore((s) => s.pending);
  const lastSyncAt      = useSyncStore((s) => s.lastSyncAt);
  const lastSyncResults = useSyncStore((s) => s.lastSyncResults);
  const removeOperation = useSyncStore((s) => s.removeOperation);
  const clearPending    = useSyncStore((s) => s.clearPending);
  const recordSync      = useSyncStore((s) => s.recordSync);

  const [syncing,  setSyncing]  = useState(false);
  const [error,    setError]    = useState('');
  const [results,  setResults]  = useState<SyncResultEntry[]>([]);

  const handleSync = async () => {
    if (pending.length === 0) return;
    setSyncing(true);
    setError('');
    setResults([]);
    try {
      const ops = pending.map(({ id, op, payload }) => ({ id, op, payload }));
      const res = await syncBatch(ops);
      recordSync(res);
      setResults(res);
      // Remove successfully synced operations
      res.forEach((r) => { if (r.status === 'ok') removeOperation(r.id); });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Sync failed. Check your connection and try again.');
    } finally {
      setSyncing(false);
    }
  };

  const okCount      = results.filter((r) => r.status === 'ok').length;
  const errorCount   = results.filter((r) => r.status === 'error').length;
  const conflictCount = results.filter((r) => r.status === 'conflict').length;

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >
            Sync queue
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {pending.length === 0
              ? 'All records are synced.'
              : `${pending.length} record${pending.length !== 1 ? 's' : ''} waiting to upload`}
          </p>
        </div>
        {lastSyncAt && (
          <p className="text-xs shrink-0 mt-1" style={{ color: 'var(--text-muted)' }}>
            Last sync: {fmtDate(lastSyncAt)}
          </p>
        )}
      </div>

      {/* Sync button */}
      <Button
        variant="primary"
        onClick={handleSync}
        loading={syncing}
        disabled={pending.length === 0}
        className="self-start"
      >
        <RefreshCw size={15} className="mr-2" aria-hidden="true" />
        {syncing ? 'Syncing…' : 'Sync now'}
      </Button>

      {error && (
        <div
          className="rounded-xl p-4 text-sm"
          style={{ backgroundColor: '#fef2f2', color: 'var(--danger)', borderLeft: '3px solid var(--danger)' }}
        >
          {error}
        </div>
      )}

      {/* Sync results */}
      {results.length > 0 && (
        <div
          className="rounded-2xl border p-5 flex flex-col gap-3"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Last sync results
          </p>
          <div className="flex gap-4 text-sm">
            {okCount > 0 && (
              <span className="flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
                <CheckCircle size={14} aria-hidden="true" />
                {okCount} synced
              </span>
            )}
            {errorCount > 0 && (
              <span className="flex items-center gap-1.5" style={{ color: 'var(--danger)' }}>
                <XCircle size={14} aria-hidden="true" />
                {errorCount} failed
              </span>
            )}
            {conflictCount > 0 && (
              <span className="flex items-center gap-1.5" style={{ color: 'var(--warn)' }}>
                <AlertTriangle size={14} aria-hidden="true" />
                {conflictCount} conflict{conflictCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2 mt-1">
            {results.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between text-xs rounded-lg px-3 py-2"
                style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-2">
                  {STATUS_ICON[r.status]}
                  <span style={{ color: 'var(--text-muted)' }}>
                    {r.id.slice(0, 8)}…
                  </span>
                </div>
                {r.error && (
                  <span style={{ color: 'var(--danger)' }}>{r.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending operations list */}
      {pending.length === 0 ? (
        <EmptyState
          icon={<CheckCircle size={32} />}
          title="Queue empty"
          description="All records have been synced to the server."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              Pending ({pending.length})
            </p>
            <button
              type="button"
              onClick={clearPending}
              className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--danger)' }}
            >
              <Trash2 size={12} aria-hidden="true" />
              Clear all
            </button>
          </div>

          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {pending.map((op, i) => (
              <div
                key={op.id}
                className="flex items-center justify-between px-4 py-3.5 border-b last:border-b-0"
                style={{ borderColor: 'var(--border)', backgroundColor: i % 2 === 0 ? 'var(--bg)' : 'var(--bg-elev)' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'var(--bg-sand)' }}
                  >
                    <RefreshCw size={14} style={{ color: 'var(--ink)' }} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                      {OP_LABEL[op.op]}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {op.label} &middot; {fmtDate(op.createdAt)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeOperation(op.id)}
                  className="shrink-0 ml-3 p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-sand)]"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="Remove operation"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historical results from store */}
      {results.length === 0 && lastSyncResults.length > 0 && (
        <div
          className="rounded-2xl border p-5 flex flex-col gap-3"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Previous sync results
          </p>
          <div className="flex gap-4 text-sm">
            {(() => {
              const ok  = lastSyncResults.filter((r) => r.status === 'ok').length;
              const err = lastSyncResults.filter((r) => r.status === 'error').length;
              const con = lastSyncResults.filter((r) => r.status === 'conflict').length;
              return (
                <>
                  {ok  > 0 && <span className="flex items-center gap-1.5" style={{ color: 'var(--success)' }}><CheckCircle  size={14} aria-hidden="true" />{ok} synced</span>}
                  {err > 0 && <span className="flex items-center gap-1.5" style={{ color: 'var(--danger)'  }}><XCircle      size={14} aria-hidden="true" />{err} failed</span>}
                  {con > 0 && <span className="flex items-center gap-1.5" style={{ color: 'var(--warn)'   }}><AlertTriangle size={14} aria-hidden="true" />{con} conflicts</span>}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
