/**
 * Local (browser-side) notification store.
 * Used to surface immediate feedback for actions the parent takes themselves
 * (submit visit request, withdraw, etc.) — these don't generate server
 * Notification rows so they'd otherwise be invisible in the notifications page.
 *
 * Stored in localStorage under 'ikibondo.local_notifs'.
 */

export type LocalNotifType =
  | 'VISIT_REQUESTED'
  | 'VISIT_WITHDRAWN'
  | 'PROFILE_UPDATED'
  | 'CONSENT_GRANTED'
  | 'CONSENT_WITHDRAWN';

export interface LocalNotif {
  id: string;
  type: LocalNotifType;
  title: string;
  message: string;
  child_name?: string;
  is_read: boolean;
  created_at: string; // ISO
}

const STORAGE_KEY = 'ikibondo.local_notifs';
const MAX_ITEMS = 50;

export const LOCAL_NOTIF_ICON: Record<LocalNotifType, string> = {
  VISIT_REQUESTED:  '🏠',
  VISIT_WITHDRAWN:  '↩️',
  PROFILE_UPDATED:  '👤',
  CONSENT_GRANTED:  '✅',
  CONSENT_WITHDRAWN:'⛔',
};

function load(): LocalNotif[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function save(items: LocalNotif[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
}

export function addLocalNotif(
  type: LocalNotifType,
  title: string,
  message: string,
  child_name?: string,
): LocalNotif {
  const notif: LocalNotif = {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    title,
    message,
    child_name,
    is_read: false,
    created_at: new Date().toISOString(),
  };
  save([notif, ...load()]);
  // Dispatch a storage event so other tabs / the notifications page can react
  window.dispatchEvent(new Event('ikibondo:local_notif'));
  return notif;
}

export function getLocalNotifs(): LocalNotif[] {
  return load();
}

export function markLocalNotifRead(id: string) {
  save(load().map((n) => (n.id === id ? { ...n, is_read: true } : n)));
}

export function markAllLocalNotifsRead() {
  save(load().map((n) => ({ ...n, is_read: true })));
}

export function countUnreadLocalNotifs(): number {
  return load().filter((n) => !n.is_read).length;
}
