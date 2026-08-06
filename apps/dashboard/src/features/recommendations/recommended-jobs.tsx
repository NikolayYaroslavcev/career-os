'use client';

import { useState, useEffect } from 'react';
import { getRecommendations, type Recommendation } from '@/api/recommendations';
import { RecommendationCard } from './recommendation-card';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Star } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { pluralize } from '@/lib/i18n/pluralize';

type SortOption = 'score' | 'newest' | 'salary';

export function RecommendedJobs(): React.JSX.Element {
  const { t, locale } = useTranslation();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('score');
  const [total, setTotal] = useState(0);

  const fetchRecommendations = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await getRecommendations({
        limit: 20,
        sortBy,
      });
      setRecommendations(response.recommendations);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('recommendedJobsPage.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={fetchRecommendations} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('recommendedJobsPage.retry')}
        </Button>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <EmptyState
        icon={Star}
        title={t('recommendedJobsPage.emptyTitle')}
        description={t('recommendedJobsPage.emptyDesc')}
        action={{ label: t('recommendedJobsPage.emptyCta'), href: '/app/search-profiles' }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t('recommendedJobsPage.title')}</h2>
          <p className="text-muted-foreground">
            {t('recommendedJobsPage.subtitle', {
              count: total,
              unit: pluralize(locale, total, {
                one: t('recommendedJobsPage.unit.one'),
                few: t('recommendedJobsPage.unit.few'),
                many: t('recommendedJobsPage.unit.many'),
              }),
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('recommendedJobsPage.sortByLabel')}</span>
          <div className="flex gap-1">
            {([
              { value: 'score', label: t('recommendedJobsPage.sortScore') },
              { value: 'newest', label: t('recommendedJobsPage.sortNewest') },
              { value: 'salary', label: t('recommendedJobsPage.sortSalary') },
            ] as const).map((option) => (
              <Button
                key={option.value}
                variant={sortBy === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {recommendations.map((rec) => (
          <RecommendationCard key={rec.vacancy.id} recommendation={rec} />
        ))}
      </div>
    </div>
  );
}
