/**
 * Background sync: flushes PendingOps to /sync/batch/ when online.
 */
import { getPendingOps, removePendingOp } from './db';
import { syncBatch } from '@/lib/api/chw';

let isFlushing = false;

export async function flushPendingOps(): Promise<{ flushed: number; errors: number }> {
  if (isFlushing || !navigator.onLine) return { flushed: 0, errors: 0 };

  isFlushing = true;
  let flushed = 0;
  let errors = 0;

  try {
    const ops = await getPendingOps();
    if (ops.length === 0) return { flushed: 0, errors: 0 };

    const results = await syncBatch(
      ops.map((op) => ({ id: String(op.id), op: op.op as Parameters<typeof syncBatch>[0][0]['op'], payload: op.payload }))
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const op = ops[i];
      if ((result.status === 'ok' || result.status === 'conflict') && op.id !== undefined) {
        await removePendingOp(op.id as number);
        flushed++;
      } else {
        errors++;
      }
    }
  } catch {
    errors++;
  } finally {
    isFlushing = false;
  }

  return { flushed, errors };
}

export function registerOnlineListener() {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => {
    flushPendingOps().catch(console.error);
  });
}
