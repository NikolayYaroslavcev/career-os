'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loading } from '@/components/ui/loading';
import { ApiError } from '@/api/client';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { compareResumeVersions, type ResumeVersionComparison, type ResumeVersionDTO } from '@/api/resume-version-intelligence';

interface ResumeComparisonPanelProps {
  readonly versions: readonly ResumeVersionDTO[];
}

function confidenceVariant(confidence: string): 'success' | 'warning' | 'destructive' {
  if (confidence === 'high') return 'success';
  if (confidence === 'medium') return 'warning';
  return 'destructive';
}

const METRIC_LABELS: Record<string, string> = {
  interviewRate: 'interviewRate',
  offerRate: 'offerRate',
  responseRate: 'responseRate',
  avgMatchScore: 'avgMatchScore',
};

export function ResumeComparisonPanel({ versions }: ResumeComparisonPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const [resumeIdA, setResumeIdA] = useState<string>(versions[0]?.id ?? '');
  const [resumeIdB, setResumeIdB] = useState<string>(versions[1]?.id ?? '');
  const [comparison, setComparison] = useState<ResumeVersionComparison | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resumeIdA || !resumeIdB || resumeIdA === resumeIdB) {
      setComparison(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    compareResumeVersions(resumeIdA, resumeIdB)
      .then((result) => {
        if (!cancelled) setComparison(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t('resumeIntelligencePage.loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return (): void => {
      cancelled = true;
    };
  }, [resumeIdA, resumeIdB, t]);

  const titleFor = (id: string): string => versions.find((v) => v.id === id)?.title ?? id;

  const chartData = comparison
    ? comparison.metricDeltas.map((delta) => ({
        metric: t(`resumeIntelligencePage.${METRIC_LABELS[delta.metric]}`),
        [titleFor(comparison.versionA.resumeId)]: comparison.versionA[delta.metric],
        [titleFor(comparison.versionB.resumeId)]: comparison.versionB[delta.metric],
      }))
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('resumeIntelligencePage.comparisonTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select value={resumeIdA} onValueChange={(value) => setResumeIdA(value ?? '')}>
            <SelectTrigger>
              <SelectValue placeholder={t('resumeIntelligencePage.selectVersionA')} />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={resumeIdB} onValueChange={(value) => setResumeIdB(value ?? '')}>
            <SelectTrigger>
              <SelectValue placeholder={t('resumeIntelligencePage.selectVersionB')} />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading && <Loading size="sm" text={t('resumeIntelligencePage.loading')} />}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {comparison && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('resumeIntelligencePage.winner')}:</span>
              <Badge variant={comparison.overallWinner === 'tie' ? 'secondary' : 'success'}>
                {comparison.overallWinner === 'tie'
                  ? t('resumeIntelligencePage.tie')
                  : titleFor(comparison.overallWinner === 'A' ? comparison.versionA.resumeId : comparison.versionB.resumeId)}
              </Badge>
              <Badge variant={confidenceVariant(comparison.confidence)}>
                {t(`resumeIntelligencePage.confidence${comparison.confidence.charAt(0).toUpperCase()}${comparison.confidence.slice(1)}`)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {t('resumeIntelligencePage.sampleSize')}: {Math.min(comparison.versionA.sampleSize, comparison.versionB.sampleSize)}
              </span>
            </div>

            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey={titleFor(comparison.versionA.resumeId)} fill="var(--color-primary, #3b82f6)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={titleFor(comparison.versionB.resumeId)} fill="var(--color-muted-foreground, #94a3b8)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
