'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { isAuthenticated } from '@/api/auth';

export default function RootPage(): React.JSX.Element | null {
  const router = useRouter();
  const { loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
    if (isAuthenticated()) {
      router.replace('/app');
    } else {
      router.replace('/login');
    }
  }, [loadUser, router]);

  return null;
}
