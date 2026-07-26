'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { LoadingOverlay } from '@/components/ui/loading';
import { isAuthenticated } from '@/api/auth';

export function AuthGuard({ children }: { children: React.ReactNode }): React.JSX.Element {
  const router = useRouter();
  const { user, loadUser, isLoading } = useAuthStore();
  const [isChecked, setIsChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    if (!user) {
      loadUser();
    }
    setIsChecked(true);
  }, [user, loadUser, router]);

  // `isAuthenticated()` reads localStorage, which the server can't see.
  // Rendering the same thing on the first client pass as on the server
  // (before this effect has run) avoids a hydration mismatch.
  if (!isChecked || isLoading || !user) {
    return <LoadingOverlay />;
  }

  return <>{children}</>;
}
