'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { formatDateTime } from '@/lib/format';
import { getSyncStatuses, syncAllProviders, syncProvider, type SyncStatus, type SyncAllResult } from '@/api/sync';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { RefreshCw, CheckCircle2, XCircle, Clock, Zap, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const PROVIDER_NAMES: Record<string, string> = {
  hh: 'HeadHunter', adzuna: 'Adzuna', greenhouse: 'Greenhouse', lever: 'Lever',
  ashby: 'Ashby', workday: 'Workday', teamtailor: 'Teamtailor', remotive: 'Remotive',
  arbeitnow: 'Arbeitnow', jobicy: 'Jobicy',
  we_work_remotely: 'We Work Remotely', working_nomads: 'Working Nomads',
  nodesk: 'NoDesk', hn_hiring: 'HN Who Is Hiring',
  smartrecruiters: 'SmartRecruiters', recruitee: 'Recruitee', comeet: 'Comeet',
  habr_career: 'Habr Career', superjob: 'SuperJob', telegram: 'Telegram',
  personio: 'Personio', workable: 'Workable',
  pyjobs: 'PyJobs', django_jobs: 'Django Jobs', speedrun: 'a16z Speedrun',
  france_travail: 'France Travail',
};

const STATUS_STYLES = {
  success: { accent: 'before:bg-emerald-500', badge: 'success', icon: CheckCircle2, iconClass: 'text-emerald-600 dark:text-emerald-400' },
  failed: { accent: 'before:bg-destructive', badge: 'destructive', icon: XCircle, iconClass: 'text-destructive' },
  pending: { accent: 'before:bg-amber-500', badge: 'warning', icon: Clock, iconClass: 'text-amber-600 dark:text-amber-400' },
} as const;

function statusLabelKey(result: SyncStatus['lastSyncResult']): 'statusActive' | 'statusFailed' | 'statusUnavailable' {
  if (result === 'success') return 'statusActive';
  if (result === 'failed') return 'statusFailed';
  return 'statusUnavailable';
}

export default function SyncPage(): React.JSX.Element {
  const { t, locale } = useTranslation();
  const [statuses, setStatuses] = useState<SyncStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncAllResult | null>(null);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);

  useEffect(() => {
    fetchStatuses();
  }, []);

  async function fetchStatuses(): Promise<void> {
    setIsLoading(true);
    try {
      const data = await getSyncStatuses();
      setStatuses(data.statuses);
    } catch (error) {
      console.error('Failed to fetch statuses:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSyncAll(): Promise<void> {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncAllProviders();
      setSyncResult(result);
      await fetchStatuses();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleSyncProvider(providerId: string): Promise<void> {
    setSyncingProvider(providerId);
    try {
      await syncProvider(providerId);
      await fetchStatuses();
    } catch (error) {
      console.error('Provider sync failed:', error);
    } finally {
      setSyncingProvider(null);
    }
  }

  const successCount = syncResult?.results.filter((r) => r.status === 'success').length ?? 0;
  const failedCount = syncResult?.results.filter((r) => r.status === 'failed').length ?? 0;

  const totalSources = statuses.length;
  const activeSources = statuses.filter((s) => s.lastSyncResult === 'success').length;
  const failedSources = statuses.filter((s) => s.lastSyncResult === 'failed').length;
  const lastGlobalSync = statuses.reduce<string | null>((latest, s) => {
    if (!s.lastSyncAt) return latest;
    if (!latest || new Date(s.lastSyncAt) > new Date(latest)) return s.lastSyncAt;
    return latest;
  }, null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('syncPage.title')}</h1>
            <p className="text-muted-foreground">{t('syncPage.subtitle')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchStatuses} disabled={isLoading} aria-label={t('syncPage.refresh')}>
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
          <Button onClick={handleSyncAll} disabled={isSyncing}>
            <Zap className="mr-2 h-4 w-4" />
            {isSyncing ? t('syncPage.syncing') : t('syncPage.syncAll')}
          </Button>
        </div>
      </div>

      {!isLoading && statuses.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-2xl font-bold text-foreground">{totalSources}</div>
              <div className="text-sm text-muted-foreground">{t('syncPage.totalSources')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeSources}</div>
              <div className="text-sm text-muted-foreground">{t('syncPage.activeSources')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <div className={cn('text-2xl font-bold', failedSources > 0 ? 'text-destructive' : 'text-foreground')}>
                {failedSources}
              </div>
              <div className="text-sm text-muted-foreground">{t('syncPage.failedSources')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-sm font-semibold text-foreground">
                {lastGlobalSync ? formatDateTime(lastGlobalSync, locale) : t('syncPage.never')}
              </div>
              <div className="text-sm text-muted-foreground">{t('syncPage.lastGlobalSync')}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {syncResult && (
        <Card className="relative overflow-hidden before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary">
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-sm font-medium text-foreground">{t('syncPage.lastSyncResult')}</p>
              <p className="text-sm text-muted-foreground">
                {t('syncPage.completedIn', { seconds: (syncResult.totalDurationMs / 1000).toFixed(1) })}
                {' · '}
                <span className="text-emerald-600 dark:text-emerald-400">{successCount}</span>
                {' / '}
                {syncResult.results.length}
                {failedCount > 0 && <span className="text-destructive"> ({failedCount} failed)</span>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {syncResult.results.map((r) => (
                <Badge key={r.providerId} variant={r.status === 'success' ? 'success' : 'destructive'}>
                  {PROVIDER_NAMES[r.providerId] ?? r.providerId}: {r.jobsSynced} ({r.durationMs}ms)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Loading />
      ) : statuses.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('syncPage.empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {statuses.map((status) => {
            const style = STATUS_STYLES[status.lastSyncResult];
            const StatusIcon = style.icon;
            const isThisSyncing = syncingProvider === status.providerId;
            return (
              <Card
                key={status.providerId}
                className={cn(
                  'relative overflow-hidden transition-shadow before:absolute before:inset-y-0 before:left-0 before:w-1 hover:shadow-md',
                  style.accent
                )}
              >
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <StatusIcon className={cn('h-4 w-4 shrink-0', style.iconClass)} />
                      <h3 className="truncate font-medium text-foreground">
                        {PROVIDER_NAMES[status.providerId] ?? status.providerId}
                      </h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleSyncProvider(status.providerId)}
                      disabled={isThisSyncing}
                      aria-label={t('syncPage.syncProvider')}
                    >
                      <RefreshCw className={cn('h-3.5 w-3.5', isThisSyncing && 'animate-spin')} />
                    </Button>
                  </div>

                  <div>
                    {status.lastSyncResult === 'success' && status.totalJobsSynced === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('syncPage.upToDate')}</p>
                    ) : (
                      <p className="text-2xl font-bold text-foreground">
                        {status.totalJobsSynced}
                        <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                          {t('syncPage.newJobsLabel')}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {status.lastSyncAt
                        ? t('syncPage.lastSyncedAt', { date: formatDateTime(status.lastSyncAt, locale) })
                        : t('syncPage.never')}
                    </span>
                    <Badge variant={style.badge}>
                      {t(`syncPage.${statusLabelKey(status.lastSyncResult)}`)}
                    </Badge>
                  </div>

                  {status.lastError && (
                    <p className="line-clamp-2 text-xs text-destructive">{status.lastError}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
