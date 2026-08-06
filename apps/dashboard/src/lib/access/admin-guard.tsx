'use client';

import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { isAdmin } from '@/lib/access/nav-visibility';

export function AdminGuard({ children }: { children: React.ReactNode }): React.JSX.Element {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useTranslation();

  if (!isAdmin(user)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('access.forbidden.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('access.forbidden.description')}</p>
        </div>
        <Button onClick={() => router.push('/app')}>{t('access.forbidden.backToDashboard')}</Button>
      </div>
    );
  }

  return <>{children}</>;
}
