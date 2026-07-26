'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { ApiError } from '@/api/client';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { getResumeRecommendation, type ResumeRecommendation, type ResumeVersionDTO } from '@/api/resume-version-intelligence';

interface ResumeRecommendationPanelProps {
  readonly versions: readonly ResumeVersionDTO[];
}

function confidenceVariant(confidence: string): 'success' | 'warning' | 'destructive' {
  if (confidence === 'high') return 'success';
  if (confidence === 'medium') return 'warning';
  return 'destructive';
}

export function ResumeRecommendationPanel({ versions }: ResumeRecommendationPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const [vacancyId, setVacancyId] = useState('');
  const [recommendation, setRecommendation] = useState<ResumeRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleFor = (id: string): string => versions.find((v) => v.id === id)?.title ?? id;

  const handleLookup = async (): Promise<void> => {
    if (!vacancyId.trim()) return;
    setIsLoading(true);
    setError(null);
    setRecommendation(null);
    try {
      const result = await getResumeRecommendation(vacancyId.trim());
      setRecommendation(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('resumeIntelligencePage.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('resumeIntelligencePage.recommendationTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={vacancyId}
            onChange={(e) => setVacancyId(e.target.value)}
            placeholder={t('resumeIntelligencePage.vacancyIdPlaceholder')}
          />
          <Button onClick={handleLookup} disabled={isLoading || !vacancyId.trim()}>
            {isLoading ? t('resumeIntelligencePage.loading') : t('resumeIntelligencePage.recommend')}
          </Button>
        </div>

        {isLoading && <Loading size="sm" text={t('resumeIntelligencePage.loading')} />}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {recommendation && recommendation.recommendedResumeId === null && (
          <p className="text-sm text-muted-foreground">{t('resumeIntelligencePage.noRecommendation')}</p>
        )}

        {recommendation && recommendation.recommendedResumeId !== null && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('resumeIntelligencePage.recommendedResume')}:</span>
              <Badge variant="success">{titleFor(recommendation.recommendedResumeId)}</Badge>
              <Badge variant={confidenceVariant(recommendation.confidence)}>
                {t(`resumeIntelligencePage.confidence${recommendation.confidence.charAt(0).toUpperCase()}${recommendation.confidence.slice(1)}`)}
              </Badge>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium">{t('resumeIntelligencePage.reasonsTitle')}</div>
              {recommendation.reasons.map((reason) => (
                <div key={reason.factor} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{reason.factor}</span>
                  <span>
                    {reason.resumeVersionValue}% {t('resumeIntelligencePage.vsAverage')} {reason.comparisonValue}%
                  </span>
                </div>
              ))}
            </div>

            {recommendation.alternatives.length > 0 && (
              <div className="space-y-1">
                <div className="text-sm font-medium">{t('resumeIntelligencePage.alternativesTitle')}</div>
                {recommendation.alternatives.map((alt) => (
                  <div key={alt.resumeId} className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{titleFor(alt.resumeId)}</span>
                    <span>{alt.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
