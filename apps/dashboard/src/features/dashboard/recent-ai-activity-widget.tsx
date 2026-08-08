'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { getAIJobs, type AIJob } from '@/api/ai';
import { formatDateTime } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';
import { isAdmin } from '@/lib/access/nav-visibility';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles } from 'lucide-react';

function getStatusColor(status: string): string {
  switch (status) {
    case 'COMPLETED': return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
    case 'FAILED': return 'bg-red-500/10 text-red-700 dark:text-red-400';
    case 'PROCESSING': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
    case 'PENDING':
    case 'QUEUED': return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
    default: return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
  }
}

export function RecentAIActivityWidget(): React.JSX.Element {
  const { t, locale } = useTranslation();
  const { user } = useAuthStore();
  // /app/ai is the admin AI cost/budget dashboard, not a per-user job history
  // page — regular users have nowhere to "view all", so the link is admin-only.
  const canViewAll = isAdmin(user);
  const [jobs, setJobs] = useState<AIJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAIJobs({ limit: 5 })
      .then(data => { if (!cancelled) setJobs(data.jobs); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{t('dashboardHome.sections.recentAiActivity')}</CardTitle>
        <Sparkles className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('dashboardHome.recentActivity.noActivity')}
          </p>
        ) : (
          <div className="space-y-2">
            {jobs.map(job => (
              <div
                key={job.id}
                className="flex items-center justify-between rounded-lg border p-2.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge className={getStatusColor(job.status)} variant="secondary">
                    {job.status}
                  </Badge>
                  <span className="text-sm font-medium truncate">
                    {job.feature.replace(/_/g, ' ')}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                  {formatDateTime(job.createdAt, locale)}
                </span>
              </div>
            ))}
            {canViewAll && (
              <Link href="/app/ai">
                <Button variant="ghost" size="sm" className="w-full mt-1">
                  {t('dashboardHome.resume.viewAll')}
                </Button>
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
