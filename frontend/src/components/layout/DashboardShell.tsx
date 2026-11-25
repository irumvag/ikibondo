'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { startAutoSync } from '@/lib/offline/queue';
import { AnnouncementBanner } from './AnnouncementBanner';
import { useToast } from '@/contexts/ToastContext';

const STORAGE_COLLAPSED = 'ikibondo.sidebar.collapsed';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Hydrate collapse state from localStorage
  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem(STORAGE_COLLAPSED) === 'true');
    } catch { /* ignore */ }
  }, []);

  const toggleCollapse = () => {
    setSidebarCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(STORAGE_COLLAPSED, String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Upload visits saved while offline as soon as the connection or the user returns,
  // and say what happened so the health worker knows their records arrived
  const toast = useToast();
  useEffect(() => startAutoSync(undefined, (results) => {
    const ok = results.filter((r) => r.status === 'ok' || r.status === 'conflict').length;
    const failed = results.length - ok;
    if (ok > 0) toast.success(`${ok} saved record${ok === 1 ? '' : 's'} uploaded`);
    if (failed > 0) toast.warn(`${failed} record${failed === 1 ? ' was' : 's were'} not accepted — open Sync to see why`);
    // toast is stable for the app's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // Save the field pages for offline use right away, not only once each has been visited
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.active?.postMessage({ type: 'WARM' }))
      .catch(() => { /* no service worker: nothing to warm */ });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '[') toggleCollapse();
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleCollapse}
      />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen((v) => !v)} />
        <AnnouncementBanner where="dashboard" />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-5 sm:p-6 lg:p-8"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
