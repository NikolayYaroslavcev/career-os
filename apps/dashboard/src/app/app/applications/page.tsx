'use client';

import { Suspense } from 'react';
import { ApplicationPipeline } from '@/features/applications/application-pipeline';
import { Loading } from '@/components/ui/loading';

export default function ApplicationsPage(): React.JSX.Element {
  return (
    <Suspense fallback={<Loading />}>
      <ApplicationPipeline />
    </Suspense>
  );
}
