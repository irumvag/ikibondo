import type { ReactNode } from 'react';
import { AuthInitializer } from '@/components/layout/AuthInitializer';
import { DashboardShell } from '@/components/layout/DashboardShell';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AuthInitializer>
      <DashboardShell>{children}</DashboardShell>
    </AuthInitializer>
  );
}
