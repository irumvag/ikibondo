import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PendingOp {
  id: string;
  op: 'register_child' | 'create_visit' | 'administer_vaccine';
  payload: Record<string, unknown>;
  createdAt: string;
  label: string;
}

export interface SyncResultEntry {
  id: string;
  status: 'ok' | 'error' | 'conflict';
  error?: string;
}

interface SyncState {
  pending:         PendingOp[];
  lastSyncAt:      string | null;
  lastSyncResults: SyncResultEntry[];

  addOperation:    (op: Omit<PendingOp, 'id' | 'createdAt'>) => void;
  removeOperation: (id: string) => void;
  clearPending:    () => void;
  recordSync:      (results: SyncResultEntry[]) => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      pending:         [],
      lastSyncAt:      null,
      lastSyncResults: [],

      addOperation: (op) =>
        set((s) => ({
          pending: [
            ...s.pending,
            {
              ...op,
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      removeOperation: (id) =>
        set((s) => ({ pending: s.pending.filter((p) => p.id !== id) })),

      clearPending: () => set({ pending: [] }),

      recordSync: (results) =>
        set({ lastSyncAt: new Date().toISOString(), lastSyncResults: results }),
    }),
    { name: 'ikibondo-sync-queue' },
  ),
);
