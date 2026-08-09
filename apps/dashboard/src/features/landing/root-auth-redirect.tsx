'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/api/auth';

export function RootAuthRedirect(): null {
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/app');
    }
  }, [router]);

  return null;
}
