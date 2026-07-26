'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ApiError } from '@/api/client';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import {
  listResumeVersions,
  getAllResumeVersionsPerformance,
  getResumeVersionPerformance,
  type ResumeVersionDTO,
  type ResumeVersionPerformance,
} from '@/api/resume-version-intelligence';
import type { Insights } from '@/api/career-intelligence';
import { ResumeRankingTable } from './components/resume-ranking-table';
import { ResumePerformanceCards } from './components/resume-performance-cards';
import { ResumeComparisonPanel } from './components/resume-comparison-panel';
import { ResumeInsightsList } from './components/resume-insights-list';
import { ResumeRecommendationPanel } from './components/resume-recommendation-panel';

interface DashboardData {
  readonly versions: ResumeVersionDTO[];
  readonly performance: ResumeVersionPerformance[];
}

export function ResumeIntelligenceDashboard(): React.JSX.Element | null {
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [selectedPerformance, setSelectedPerformance] = useState<ResumeVersionPerformance | null>(null);
  const [selectedInsights, setSelectedInsights] = useState<Insights | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const [{ versions }, { performance }] = await Promise.all([
        listResumeVersions(),
        getAllResumeVersionsPerformance(),
      ]);
      setData({ versions, performance });
      const best = [...performance].sort((a, b) => b.interviewRate - a.interviewRate)[0];
      setSelectedResumeId(best?.resumeId ?? versions[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('resumeIntelligencePage.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedResumeId) return;
    let cancelled = false;
    setIsLoadingDetail(true);
    getResumeVersionPerformance(selectedResumeId)
      .then(({ performance, insights }) => {
        if (!cancelled) {
          setSelectedPerformance(performance);
          setSelectedInsights(insights);
        }
      })
      .catch(() => {
        // Detail load failure isn't fatal — the ranking table and other panels stay usable.
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetail(false);
      });
    return (): void => {
      cancelled = true;
    };
  }, [selectedResumeId]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loading size="lg" text={t('resumeIntelligencePage.loading')} />
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

  if (data.versions.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <header>
          <h1 className="text-2xl font-semibold">{t('resumeIntelligencePage.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('resumeIntelligencePage.subtitle')}</p>
        </header>
        <p className="text-sm text-muted-foreground">{t('resumeIntelligencePage.noVersions')}</p>
      </div>
    );
  }

  const selectedVersion = data.versions.find((v) => v.id === selectedResumeId);

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">{t('resumeIntelligencePage.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('resumeIntelligencePage.subtitle')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t('resumeIntelligencePage.rankingTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResumeRankingTable
            versions={data.versions}
            performance={data.performance}
            selectedResumeId={selectedResumeId}
            onSelect={setSelectedResumeId}
          />
        </CardContent>
      </Card>

      {selectedVersion && (
        <>
          <h2 className="text-lg font-semibold">{selectedVersion.title}</h2>
          {isLoadingDetail && <Loading size="sm" text={t('resumeIntelligencePage.loading')} />}
          {selectedPerformance && <ResumePerformanceCards performance={selectedPerformance} />}
          {selectedInsights && <ResumeInsightsList insights={selectedInsights} />}
        </>
      )}

      <ResumeComparisonPanel versions={data.versions} />

      <ResumeRecommendationPanel versions={data.versions} />
    </div>
  );
}
