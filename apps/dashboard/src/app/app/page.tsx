'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { formatDateTime, formatNumber } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';
import { getVacancyStats, type VacancyStats } from '@/api/sync';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { Briefcase, Search, Calendar, Building2, Activity } from 'lucide-react';

export default function DashboardPage(): React.JSX.Element {
  const { t, locale } = useTranslation();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<VacancyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats(): Promise<void> {
      try {
        const data = await getVacancyStats();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('nav.dashboard')}</h1>
          <p className="text-muted-foreground">{t('dashboardHome.welcome', { email: user?.email ?? '' })}</p>
        </div>
        <Link href="/app/search">
          <Button>
            <Search className="mr-2 h-4 w-4" />
            {t('dashboardHome.searchJobs')}
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <Loading />
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboardHome.totalJobs')}</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{formatNumber(stats.totalJobs, locale)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboardHome.newToday')}</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stats.newToday}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboardHome.providers')}</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stats.providers.length} / {stats.totalProviders}</div>
                <p className="text-xs text-muted-foreground">{t('dashboardHome.providersSubtitle', { total: stats.totalProviders })}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboardHome.lastSync')}</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-sm font-medium text-foreground">
                  {stats.lastSyncAt ? formatDateTime(stats.lastSyncAt, locale) : t('dashboardHome.never')}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('dashboardHome.providerSources')}</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.providers.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('dashboardHome.noJobsSynced')}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {stats.providers.map((p) => (
                    <Badge key={p.source} variant="secondary">
                      {p.source}: {p.count}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>{t('dashboardHome.failedToLoad')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
