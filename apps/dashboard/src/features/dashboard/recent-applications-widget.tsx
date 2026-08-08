'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { listApplications, type Application } from '@/api/applications';
import { getVacancyDetail, type VacancyDetail } from '@/api/sync';
import { formatDateTime } from '@/lib/format';
import { APPLICATION_STATUS_VARIANT } from '@/lib/application-status';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { KanbanSquare, Plus } from 'lucide-react';

export function RecentApplicationsWidget(): React.JSX.Element {
  const { t, locale } = useTranslation();
  const [applications, setApplications] = useState<Application[]>([]);
  const [vacanciesById, setVacanciesById] = useState<Record<string, VacancyDetail>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listApplications()
      .then(async (data) => {
        const recent = data.applications.slice(0, 5);
        if (cancelled) return;
        setApplications(recent);

        const uniqueVacancyIds = [...new Set(recent.map((app) => app.vacancyId))];
        const fetched = await Promise.all(
          uniqueVacancyIds.map(async (id) => {
            try {
              return await getVacancyDetail(id);
            } catch {
              return null;
            }
          })
        );
        if (cancelled) return;

        const next: Record<string, VacancyDetail> = {};
        fetched.forEach((vacancy, index) => {
          if (vacancy) {
            next[uniqueVacancyIds[index] as string] = vacancy;
          }
        });
        setVacanciesById(next);
      })
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
        <CardTitle className="text-sm font-medium">{t('dashboardHome.sections.recentApplications')}</CardTitle>
        <KanbanSquare className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {applications.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-2">
              {t('dashboardHome.applications.noApplications')}
            </p>
            <Link href="/app/search">
              <Button size="sm">
                <Plus className="mr-2 h-3 w-3" />
                {t('dashboardHome.applications.startCta')}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {applications.map(app => (
              <Link
                key={app.id}
                href={`/app/applications/${app.id}`}
                className="flex items-center justify-between rounded-lg border p-2.5 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant={APPLICATION_STATUS_VARIANT[app.status]} className="text-xs">
                    {t(`applications.statuses.${app.status}`)}
                  </Badge>
                  <span className="text-sm truncate text-foreground">
                    {vacanciesById[app.vacancyId]?.title ?? t('applications.unknownVacancy')}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                  {formatDateTime(app.createdAt, locale)}
                </span>
              </Link>
            ))}
            <Link href="/app/applications">
              <Button variant="ghost" size="sm" className="w-full mt-1">
                {t('dashboardHome.resume.viewAll')}
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
