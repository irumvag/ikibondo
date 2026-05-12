/**
 * Dexie (IndexedDB) schema for offline-first CHW data.
 * Stores: caseload snapshots, child profiles, vaccination schedules, pending ops.
 */
import Dexie, { type EntityTable } from 'dexie';

export interface CachedChild {
  id: string;
  full_name: string;
  registration_number: string;
  date_of_birth: string;
  age_display: string;
  sex: 'M' | 'F';
  camp: string;
  camp_name: string;
  zone: string | null;
  zone_name: string | null;
  guardian: string;
  guardian_name: string;
  guardian_phone: string;
  cachedAt: number; // epoch ms
}

export interface PendingOp {
  id?: number; // auto-increment
  op: 'create_visit' | 'administer_vaccine' | 'create_visit_request_reply';
  payload: Record<string, unknown>;
  createdAt: number;
  retries: number;
}

class IkibondoDB extends Dexie {
  children!: EntityTable<CachedChild, 'id'>;
  pendingOps!: EntityTable<PendingOp, 'id'>;

  constructor() {
    super('ikibondo');
    this.version(1).stores({
      children: 'id, registration_number, guardian, cachedAt',
      pendingOps: '++id, op, createdAt',
    });
  }
}

export const db = new IkibondoDB();

export async function cacheChildren(children: CachedChild[]) {
  const now = Date.now();
  await db.children.bulkPut(children.map((c) => ({ ...c, cachedAt: now })));
}

export async function getCachedChildren(): Promise<CachedChild[]> {
  return db.children.toArray();
}

export async function addPendingOp(op: Omit<PendingOp, 'id' | 'createdAt' | 'retries'>): Promise<number> {
  return db.pendingOps.add({ ...op, createdAt: Date.now(), retries: 0 }) as Promise<number>;
}

export async function getPendingOps(): Promise<PendingOp[]> {
  return db.pendingOps.toArray();
}

export async function removePendingOp(id: number): Promise<void> {
  await db.pendingOps.delete(id);
}

export async function clearStaleCache(olderThanMs = 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - olderThanMs;
  await db.children.where('cachedAt').below(cutoff).delete();
}
