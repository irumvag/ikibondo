'use client';

import { useTranslations } from 'next-intl';
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
  const tSync = useTranslations('common.sync');
  useEffect(() => startAutoSync(undefined, (results) => {
    const ok = results.filter((r) => r.status === 'ok' || r.status === 'conflict').length;
    const failed = results.length - ok;
    if (ok > 0) toast.success(tSync('uploaded', { count: ok }));
    if (failed > 0) toast.warn(tSync('notAccepted', { count: failed }));
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
    // print: only the page content (reports print as documents)
    <div className="flex h-screen overflow-hidden print:block print:h-auto print:overflow-visible" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="contents print:hidden">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleCollapse}
        />
      </div>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:block print:overflow-visible">
        <div className="contents print:hidden">
          <Topbar onMenuClick={() => setSidebarOpen((v) => !v)} />
          <AnnouncementBanner where="dashboard" />
        </div>
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-5 sm:p-6 lg:p-8 print:overflow-visible print:p-0"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
