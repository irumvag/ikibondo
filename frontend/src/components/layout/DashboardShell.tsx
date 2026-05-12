'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

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
