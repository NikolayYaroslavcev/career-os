'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { formatDateTime, formatNumber } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';
import { getVacancyStats, type VacancyStats } from '@/api/sync';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Briefcase, Search, Calendar, Building2, Activity } from 'lucide-react';
import { OnboardingChecklist } from '@/features/dashboard/onboarding-checklist';
import { ResumeStatusWidget } from '@/features/dashboard/resume-status-widget';
import { SearchProfileWidget } from '@/features/dashboard/search-profile-widget';
import { CompanyWatchWidget } from '@/features/dashboard/company-watch-widget';
import { RecentAIActivityWidget } from '@/features/dashboard/recent-ai-activity-widget';
import { RecentApplicationsWidget } from '@/features/dashboard/recent-applications-widget';
import { AIActionCards } from '@/features/dashboard/ai-action-cards';

function StatsCardsSkeleton(): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map(i => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-4 rounded" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

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
    void fetchStats();
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

      <OnboardingChecklist />

      {isLoading ? (
        <StatsCardsSkeleton />
      ) : stats ? (
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
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ResumeStatusWidget />
        <SearchProfileWidget />
        <CompanyWatchWidget />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentApplicationsWidget />
        <RecentAIActivityWidget />
      </div>

      <AIActionCards />
    </div>
  );
}
