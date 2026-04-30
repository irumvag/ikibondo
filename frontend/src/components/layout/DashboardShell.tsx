'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
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
