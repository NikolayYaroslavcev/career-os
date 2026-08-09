'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress, ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import { ApiError } from '@/api/client';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import {
  getOverview,
  getFunnel,
  getCareerHealth,
  getInsights,
  refreshInsights,
  type CareerMetrics,
  type ApplicationFunnel,
  type CareerHealthScore,
  type Insights,
} from '@/api/career-intelligence';

interface DashboardData {
  readonly overview: CareerMetrics;
  readonly funnel: ApplicationFunnel;
  readonly health: CareerHealthScore;
  readonly insights: Insights;
}

function priorityVariant(priority: string): 'destructive' | 'warning' | 'secondary' {
  if (priority === 'high') return 'destructive';
  if (priority === 'medium') return 'warning';
  return 'secondary';
}

function trendVariant(trend: string): 'success' | 'destructive' | 'secondary' {
  if (trend === 'improving') return 'success';
  if (trend === 'declining') return 'destructive';
  return 'secondary';
}

export function CareerIntelligenceDashboard(): React.JSX.Element | null {
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [overview, funnel, health, insights] = await Promise.all([
        getOverview(),
        getFunnel(),
        getCareerHealth(),
        getInsights(),
      ]);
      setData({ overview, funnel, health, insights });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('careerIntelligencePage.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      const insights = await refreshInsights();
      setData((prev) => (prev ? { ...prev, insights } : prev));
    } catch {
      // Refresh failure isn't fatal — the previously loaded insights stay visible.
    } finally {
      setIsRefreshing(false);
    }
  };

  // Recharts treats `data` identity as a change signal, so a fresh array on
  // every render (e.g. while isRefreshing toggles, unrelated to funnel data)
  // forced BarChart to redo its SVG layout even when the funnel itself hadn't
  // changed.
  const funnelChartData = useMemo(
    () => (data ? data.funnel.stages.map((s) => ({ name: s.name, count: s.count })) : []),
    [data]
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loading size="lg" text={t('careerIntelligencePage.loading')} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('careerIntelligencePage.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('careerIntelligencePage.subtitle')}</p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline">
          {isRefreshing ? t('careerIntelligencePage.refreshing') : t('careerIntelligencePage.refresh')}
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{t('careerIntelligencePage.healthScore')}</span>
              <Badge variant={trendVariant(data.health.trend)}>
                {t(`careerIntelligencePage.healthTrend${data.health.trend.charAt(0).toUpperCase()}${data.health.trend.slice(1)}`)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.overview.applicationsSent === 0 ? (
              <p className="text-sm text-muted-foreground">{t('careerIntelligencePage.notEnoughData')}</p>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{data.health.overall}</span>
                <span className="text-sm text-muted-foreground">/ 100</span>
                <Badge variant="secondary" className="ml-auto">
                  {t(`careerIntelligencePage.confidence${data.health.confidence.charAt(0).toUpperCase()}${data.health.confidence.slice(1)}`)}
                </Badge>
              </div>
            )}
            {data.overview.applicationsSent > 0 && data.health.components.map((component) => (
              <Progress key={component.name} value={component.score} className="gap-1">
                <div className="flex w-full justify-between">
                  <ProgressLabel>{component.name}</ProgressLabel>
                  <ProgressValue />
                </div>
                <ProgressTrack>
                  <ProgressIndicator />
                </ProgressTrack>
              </Progress>
            ))}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">{t('careerIntelligencePage.applicationsSent')}</div>
              <div className="text-2xl font-semibold">{data.overview.applicationsSent}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">{t('careerIntelligencePage.interviews')}</div>
              <div className="text-2xl font-semibold">
                {data.overview.hrInterviews + data.overview.technicalInterviews + data.overview.finalInterviews}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">{t('careerIntelligencePage.offers')}</div>
              <div className="text-2xl font-semibold">{data.overview.offers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">{t('careerIntelligencePage.avgMatchScore')}</div>
              <div className="text-2xl font-semibold">{data.overview.avgMatchScore}%</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('careerIntelligencePage.funnelTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--color-primary, #3b82f6)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('careerIntelligencePage.insightsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.insights.insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('careerIntelligencePage.noInsights')}</p>
          ) : (
            data.insights.insights.map((insight) => (
              <div key={insight.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div>
                  <div className="font-medium">{insight.title}</div>
                  <div className="text-sm text-muted-foreground">{insight.description}</div>
                </div>
                <Badge variant={priorityVariant(insight.priority)}>
                  {t(`careerIntelligencePage.priority${insight.priority.charAt(0).toUpperCase()}${insight.priority.slice(1)}`)}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
