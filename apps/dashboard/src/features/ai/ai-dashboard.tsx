'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getDashboardData, getCacheStats, getAIMode, setAIMode } from '@/api/ai';
import type { DashboardData, AICacheStats } from '@/api/ai';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { formatDate as formatLocaleDate } from '@/lib/format';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DASHBOARD_REFRESH_INTERVAL_MS = 30_000;

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

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

export function AIDashboard(): React.JSX.Element | null {
  const { t, locale } = useTranslation();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [cacheStats, setCacheStats] = useState<AICacheStats | null>(null);
  const [aiMode, setAiModeState] = useState<string>('manual');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchData(isInitialLoad = false): Promise<void> {
      if (isInitialLoad) {
        setIsLoading(true);
      }

      try {
        const [dashboardData, cache, mode] = await Promise.all([
          getDashboardData(),
          getCacheStats(),
          getAIMode(),
        ]);

        if (!isMounted) {
          return;
        }

        setDashboard(dashboardData);
        setCacheStats(cache);
        setAiModeState(mode.mode);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch AI data:', err);
        if (isMounted) {
          setError(t('ai.loadFailed'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void fetchData(true);
    const intervalId = setInterval(() => {
      void fetchData(false);
    }, DASHBOARD_REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const handleModeChange = async (newMode: 'manual' | 'smart' | 'automatic'): Promise<void> => {
    try {
      await setAIMode(newMode);
      setAiModeState(newMode);
    } catch (err) {
      console.error('Failed to set mode:', err);
    }
  };

  if (isLoading) return <Loading text={t('ai.loading')} />;
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>;
  if (!dashboard) return null;

  const { today, week, month } = dashboard;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('ai.dashboard')}</h1>
          <p className="text-muted-foreground">{t('ai.dashboardDescription')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('ai.mode')}:</span>
          <Select value={aiMode} onValueChange={(v) => { if (v) handleModeChange(v as 'manual' | 'smart' | 'automatic'); }}>
            <SelectTrigger className="h-8 w-auto" size="sm">
              <SelectValue>
                {(value: string) => t(`ai.mode${value.charAt(0).toUpperCase()}${value.slice(1)}`)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">{t('ai.modeManual')}</SelectItem>
              <SelectItem value="smart">{t('ai.modeSmart')}</SelectItem>
              <SelectItem value="automatic">{t('ai.modeAutomatic')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Usage Overview Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ai.todayTokens')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatNumber(today.totalTokens)}</div>
            <p className="text-xs text-muted-foreground">{today.totalRequests} {t('ai.requests')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ai.weeklyTokens')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatNumber(week.totalTokens)}</div>
            <p className="text-xs text-muted-foreground">{week.totalRequests} {t('ai.requests')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ai.monthlyCost')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCost(dashboard.monthlyCost)}</div>
            <p className="text-xs text-muted-foreground">{t('ai.thisMonth')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ai.savedTokens')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatNumber(dashboard.savedTokens)}</div>
            <p className="text-xs text-muted-foreground">{t('ai.throughCache')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Cache & Performance */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('ai.cachePerformance')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{t('ai.hitRate')}</span>
              <span className="text-sm font-medium">
                {month.cacheHits + month.cacheMisses > 0
                  ? `${((month.cacheHits / (month.cacheHits + month.cacheMisses)) * 100).toFixed(1)}%`
                  : '0%'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{t('ai.cacheEntries')}</span>
              <span className="text-sm font-medium">{cacheStats?.totalEntries ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{t('ai.avgLatency')}</span>
              <span className="text-sm font-medium">{month.avgLatencyMs}ms</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('ai.topFeatures')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{t('ai.mostExpensive')}</span>
              <Badge variant="outline">{dashboard.mostExpensiveFeature.replace(/_/g, ' ')}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{t('ai.mostFrequent')}</span>
              <Badge variant="outline">{dashboard.mostFrequentFeature.replace(/_/g, ' ')}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Provider Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>{t('ai.requestsByProvider')}</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.entries(month.byProvider).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('ai.noData')}</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(month.byProvider)
                .sort(([, a], [, b]) => b.requests - a.requests)
                .map(([provider, stats]) => (
                  <div key={provider} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{provider}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {stats.requests} {t('ai.requests')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">{formatNumber(stats.tokens)} tokens</span>
                      <span className="text-xs text-muted-foreground ml-2">{formatCost(stats.cost)}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>{t('ai.recentJobs')}</CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard.recentJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('ai.noJobs')}</p>
          ) : (
            <div className="space-y-2">
              {dashboard.recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={getStatusColor(job.status)}>{job.status}</Badge>
                    <span className="text-sm font-medium">{job.feature.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {job.provider && <span>{job.provider}</span>}
                    <span>{formatNumber(job.totalTokens)} tokens</span>
                    <span>{formatCost(job.estimatedCost)}</span>
                    <span>{formatLocaleDate(job.createdAt, locale)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
