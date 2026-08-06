'use client';

import { AdminGuard } from '@/lib/access/admin-guard';

export default function ProviderSettingsLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <AdminGuard>{children}</AdminGuard>;
}
