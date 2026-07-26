'use client';

import { AuthGuard } from '@/middleware/auth-guard';
import { AppShell } from '@/components/layout/app-shell';

export default function AppLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
