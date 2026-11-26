'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { useSyncStore, type SyncResultEntry } from '@/store/syncStore';
import { flushQueue } from '@/lib/offline/queue';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

// Operation names: messages/en.json chw.sync.op.<op>

const STATUS_ICON = {
  ok:       <CheckCircle  size={16} style={{ color: 'var(--success)' }} aria-hidden="true" />,
  error:    <XCircle      size={16} style={{ color: 'var(--danger)'  }} aria-hidden="true" />,
  conflict: <AlertTriangle size={16} style={{ color: 'var(--warn)'   }} aria-hidden="true" />,
  forbidden: <XCircle     size={16} style={{ color: 'var(--danger)'  }} aria-hidden="true" />,
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
  const t = useTranslations('chw.sync');
  const userId          = useAuthStore((s) => s.user?.id);
  const allPending      = useSyncStore((s) => s.pending);
  // Only this account's work is shown and uploaded on a shared phone
  const pending         = allPending.filter((p) => !p.userId || p.userId === userId);
  const lastSyncAt      = useSyncStore((s) => s.lastSyncAt);
  const lastSyncResults = useSyncStore((s) => s.lastSyncResults);
  const removeOperation = useSyncStore((s) => s.removeOperation);

  const [syncing,  setSyncing]  = useState(false);
  const [error,    setError]    = useState('');
  const [results,  setResults]  = useState<SyncResultEntry[]>([]);

  const handleSync = async () => {
    if (pending.length === 0) return;
    setSyncing(true);
    setError('');
    setResults([]);
    try {
      setResults(await flushQueue());
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? t('syncFailedCheckYour'));
    } finally {
      setSyncing(false);
    }
  };

  const okCount      = results.filter((r) => r.status === 'ok').length;
  const errorCount   = results.filter((r) => r.status === 'error' || r.status === 'forbidden').length;
  const conflictCount = results.filter((r) => r.status === 'conflict').length;

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
          >{t('syncQueue')}</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {pending.length === 0
              ? t('allRecordsAreSynced')
              : t('recordsWaitingUpload', { count: pending.length })}
          </p>
        </div>
        {lastSyncAt && (
          <p className="text-xs shrink-0 mt-1" style={{ color: 'var(--text-muted)' }}>{t('lastSync', { fmtDate: fmtDate(lastSyncAt) })}</p>
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
        {syncing ? t('syncing') : t('syncNow')}
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
          <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('lastSyncResults')}</p>
          <div className="flex gap-4 text-sm">
            {okCount > 0 && (
              <span className="flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
                <CheckCircle size={14} aria-hidden="true" />{t('synced', { okCount: okCount })}</span>
            )}
            {errorCount > 0 && (
              <span className="flex items-center gap-1.5" style={{ color: 'var(--danger)' }}>
                <XCircle size={14} aria-hidden="true" />{t('failed', { errorCount: errorCount })}</span>
            )}
            {conflictCount > 0 && (
              <span className="flex items-center gap-1.5" style={{ color: 'var(--warn)' }}>
                <AlertTriangle size={14} aria-hidden="true" />{t('conflictCount', { count: conflictCount })}
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
          title={t('queueEmpty')}
          description={t('allRecordsHaveBeen')}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('pending', { length: pending.length })}</p>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t('confirmDiscard', { count: pending.length }))) {
                  pending.forEach((p) => removeOperation(p.id));
                }
              }}
              className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--danger)' }}
            >
              <Trash2 size={12} aria-hidden="true" />{t('discardAll')}</button>
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
                      {t(`op.${op.op}`)}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{t('saved', { label: op.label, fmtDate: fmtDate(op.createdAt) })}</p>
                    {op.lastError && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--danger)' }}>{t('notAccepted', { lastError: op.lastError })}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeOperation(op.id)}
                  className="shrink-0 ml-3 p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-sand)]"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label={t('removeOperation')}
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
          <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('previousSyncResults')}</p>
          <div className="flex gap-4 text-sm">
            {(() => {
              const ok  = lastSyncResults.filter((r) => r.status === 'ok').length;
              const err = lastSyncResults.filter((r) => r.status === 'error').length;
              const con = lastSyncResults.filter((r) => r.status === 'conflict').length;
              return (
                <>
                  {ok  > 0 && <span className="flex items-center gap-1.5" style={{ color: 'var(--success)' }}><CheckCircle  size={14} aria-hidden="true" />{t('synced2', { ok: ok })}</span>}
                  {err > 0 && <span className="flex items-center gap-1.5" style={{ color: 'var(--danger)'  }}><XCircle      size={14} aria-hidden="true" />{t('failed2', { err: err })}</span>}
                  {con > 0 && <span className="flex items-center gap-1.5" style={{ color: 'var(--warn)'   }}><AlertTriangle size={14} aria-hidden="true" />{t('conflicts', { con: con })}</span>}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
