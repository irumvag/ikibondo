/**
 * Offline write queue.
 *
 * Writes that fail because the device has no connection are kept in the
 * persisted sync store and replayed through POST /sync/batch/. Each operation
 * carries a client UUID, so a retry after a dropped response never duplicates
 * a record on the server.
 */
import { syncBatch } from '@/lib/api/chw';
import { useAuthStore } from '@/store/authStore';
import { useSyncStore, type PendingOp, type SyncResultEntry } from '@/store/syncStore';

/** True when a request failed for lack of connectivity rather than being rejected by the server. */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const e = err as { response?: unknown; code?: string; message?: string };
  // Axios sets `response` whenever the server answered; no response means the request never arrived
  return !e?.response && (e?.code === 'ERR_NETWORK' || e?.code === 'ECONNABORTED' || e?.message === 'Network Error');
}

export function enqueue(op: PendingOp['op'], payload: Record<string, unknown>, label: string) {
  const userId = useAuthStore.getState().user?.id;
  useSyncStore.getState().addOperation({ op, payload, label, userId });
}

let flushing: Promise<SyncResultEntry[]> | null = null;

/**
 * Upload the current user's queued operations. Items the server accepted (or had
 * already applied) leave the queue; rejected ones stay with their error so the
 * health worker can see and fix or discard them.
 */
export function flushQueue(): Promise<SyncResultEntry[]> {
  if (flushing) return flushing;
  flushing = (async () => {
    const userId = useAuthStore.getState().user?.id;
    const store = useSyncStore.getState();
    // Never upload one person's work under another person's session on a shared phone
    const mine = store.pending.filter((p) => !p.userId || p.userId === userId);
    if (!userId || mine.length === 0 || (typeof navigator !== 'undefined' && !navigator.onLine)) return [];

    const results = await syncBatch(mine.map(({ id, op, payload }) => ({ id, op, payload })));
    for (const r of results) {
      if (r.status === 'ok' || r.status === 'conflict') store.removeOperation(r.id);
      else store.markFailed(r.id, r.error ?? 'Rejected by the server.');
    }
    store.recordSync(results);
    return results;
  })().finally(() => { flushing = null; });
  return flushing;
}

/**
 * Flush whenever connectivity or attention returns, plus a slow heartbeat.
 * iOS Safari has no Background Sync API, so these triggers are what make the PWA work there.
 * Returns a cleanup function.
 */
export function startAutoSync(
  intervalMs = 60_000,
  onFlushed?: (results: SyncResultEntry[]) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const tryFlush = () => {
    if (useSyncStore.getState().pending.length > 0) {
      flushQueue()
        .then((results) => { if (results.length > 0) onFlushed?.(results); })
        .catch(() => { /* retried on next trigger */ });
    }
  };
  const onVisible = () => { if (document.visibilityState === 'visible') tryFlush(); };

  window.addEventListener('online', tryFlush);
  document.addEventListener('visibilitychange', onVisible);
  const timer = window.setInterval(tryFlush, intervalMs);
  tryFlush();

  return () => {
    window.removeEventListener('online', tryFlush);
    document.removeEventListener('visibilitychange', onVisible);
    window.clearInterval(timer);
  };
}
