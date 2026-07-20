'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  runSearch,
  pollMatchStatus,
  type Recommendation,
  type SearchResponse,
  type SearchVacancyResult,
  type SearchError,
} from '@/api/intelligence';
import { listSearchProfiles, type SearchProfile } from '@/api/search-profiles';
import { createApplication } from '@/api/applications';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { Search, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/i18n-provider';

const POLL_INTERVAL_MS = 4000;
// ~2 minutes of polling per search — a backstop against a permanently-stuck
// spinner if the worker/queue is down, not an expected steady state.
const MAX_POLL_ATTEMPTS = 30;

export function SearchButton() {
  const router = useRouter();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [searchProfileId, setSearchProfileId] = useState<string | null>(null);
  const [searchToken, setSearchToken] = useState(0);
  const [results, setResults] = useState<SearchVacancyResult[] | null>(null);
  const [stats, setStats] = useState<SearchResponse['stats'] | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [activeProfile, setActiveProfile] = useState<SearchProfile | null>(null);
  const [profileCheckDone, setProfileCheckDone] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('score-desc');

  const resultsRef = useRef<SearchVacancyResult[] | null>(null);
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  useEffect(() => {
    const checkProfile = async () => {
      try {
        const data = await listSearchProfiles();
        const active = data.searchProfiles.find((p) => p.isActive);
        setActiveProfile(active ?? null);
      } catch {
        setActiveProfile(null);
      } finally {
        setProfileCheckDone(true);
      }
    };
    checkProfile();
  }, []);

  // Polls /intelligence/status for vacancies still 'pending' after a search —
  // AI matching happens in apps/worker, off this request entirely, so scores
  // arrive progressively rather than all at once. Never re-triggers a search.
  useEffect(() => {
    if (!searchProfileId) return;

    let attempts = 0;
    const intervalId = setInterval(async () => {
      const current = resultsRef.current;
      const pendingIds = (current ?? [])
        .filter((r) => r.status === 'pending')
        .map((r) => r.vacancy.id);

      if (pendingIds.length === 0 || attempts >= MAX_POLL_ATTEMPTS) {
        clearInterval(intervalId);
        return;
      }
      attempts += 1;

      try {
        const statusResponse = await pollMatchStatus(searchProfileId, pendingIds);
        const byId = new Map(statusResponse.vacancies.map((v) => [v.vacancyId, v]));
        setResults((prev) =>
          prev
            ? prev.map((r) => {
                const update = byId.get(r.vacancy.id);
                if (!update || update.status === 'pending') return r;
                return { ...r, status: update.status, recommendation: update.recommendation };
              })
            : prev
        );
      } catch {
        // Transient poll failure — try again next tick.
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [searchProfileId, searchToken]);

  const handleSearch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await runSearch();
      setSearchProfileId(response.searchProfileId);
      setSearchToken((token) => token + 1);
      setResults(response.vacancies);
      setStats(response.stats);
      setAiEnabled(response.aiEnabled);
    } catch (err) {
      // Check if this is an AI error response with structured error info
      if (err instanceof Response) {
        try {
          const errorBody = await err.json() as SearchError;
          if (errorBody.error?.code && errorBody.error?.message) {
            setError(errorBody.error.message);
            return;
          }
        } catch {
          // Fall through to default error handling
        }
      }

      // Check if error has structured AI error info
      if (err && typeof err === 'object' && 'error' in err) {
        const aiError = err as SearchError;
        if (aiError.error?.message) {
          setError(aiError.error.message);
          return;
        }
      }

      const message = err instanceof Error ? err.message : t('intelligence.searchFailed');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = async (result: SearchVacancyResult) => {
    try {
      await createApplication({
        vacancyId: result.vacancy.id,
        matchResultId: result.recommendation?.matchResultId,
      });
      setAppliedIds((prev) => new Set(prev).add(result.vacancy.id));
    } catch (err) {
      console.error('Failed to create application:', err);
    }
  };

  if (!profileCheckDone) {
    return <Loading text={t('intelligence.checkingProfile')} />;
  }

  if (!activeProfile) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">{t('intelligence.title')}</h2>
          <p className="text-sm text-gray-500">{t('intelligence.subtitle')}</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-500" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">
              {t('intelligence.noProfileTitle')}
            </h3>
            <p className="mb-6 text-sm text-gray-500">{t('intelligence.noProfileSubtitle')}</p>
            <Button onClick={() => router.push('/app/search-profiles')}>
              <Search className="mr-2 h-4 w-4" />
              {t('intelligence.createProfileCta')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('intelligence.title')}</h2>
          <p className="text-sm text-gray-500">{t('intelligence.subtitle')}</p>
        </div>
        <Button onClick={handleSearch} disabled={isLoading}>
          {isLoading ? (
            <Loading size="sm" text={t('intelligence.searching')} />
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              {t('intelligence.search')}
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-600">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{t('intelligence.aiErrorTitle')}</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {results && stats && (
        <div className="space-y-4">
          {!aiEnabled && (
            <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
              {t('intelligence.aiDisabledNotice')}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold">{stats.totalVacancies}</p>
                <p className="text-sm text-gray-500">{t('intelligence.totalVacancies')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold">{stats.matchedVacancies}</p>
                <p className="text-sm text-gray-500">{t('intelligence.matched')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold">{stats.pendingVacancies}</p>
                <p className="text-sm text-gray-500">{t('intelligence.pending')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold">
                  {Math.round(stats.averageScore * 100)}%
                </p>
                <p className="text-sm text-gray-500">{t('intelligence.avgScore')}</p>
              </CardContent>
            </Card>
          </div>

          <VacancyResultList
            results={results}
            appliedIds={appliedIds}
            onApply={handleApply}
            sortBy={sortBy}
            onSortByChange={setSortBy}
          />
        </div>
      )}
    </div>
  );
}

type SortOption = 'score-desc' | 'score-asc' | 'date-desc';

function sortResults(results: readonly SearchVacancyResult[], sortBy: SortOption): SearchVacancyResult[] {
  const matched = results.filter((r) => r.status === 'matched' && r.recommendation);
  const rest = results.filter((r) => !(r.status === 'matched' && r.recommendation));

  const sortedMatched = [...matched].sort((a, b) => {
    const scoreA = a.recommendation!.score;
    const scoreB = b.recommendation!.score;
    switch (sortBy) {
      case 'score-asc':
        return scoreA - scoreB;
      case 'date-desc':
        return new Date(b.recommendation!.generatedAt).getTime() - new Date(a.recommendation!.generatedAt).getTime();
      case 'score-desc':
      default:
        return scoreB - scoreA;
    }
  });

  return [...sortedMatched, ...rest];
}

interface VacancyResultListProps {
  results: SearchVacancyResult[];
  appliedIds: Set<string>;
  onApply: (result: SearchVacancyResult) => void;
  sortBy: SortOption;
  onSortByChange: (sortBy: SortOption) => void;
}

function VacancyResultList({ results, appliedIds, onApply, sortBy, onSortByChange }: VacancyResultListProps) {
  const { t } = useTranslation();

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          {t('intelligence.empty')}
        </CardContent>
      </Card>
    );
  }

  const sorted = sortResults(results, sortBy);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <label htmlFor="recommendation-sort" className="text-sm text-gray-500">
          {t('intelligence.sortLabel')}
        </label>
        <select
          id="recommendation-sort"
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value as SortOption)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="score-desc">{t('intelligence.sortByScoreDesc')}</option>
          <option value="score-asc">{t('intelligence.sortByScoreAsc')}</option>
          <option value="date-desc">{t('intelligence.sortByDate')}</option>
        </select>
      </div>
      {sorted.map((result) => (
        <VacancyResultCard
          key={result.vacancy.id}
          result={result}
          isApplied={appliedIds.has(result.vacancy.id)}
          onApply={() => onApply(result)}
        />
      ))}
    </div>
  );
}

interface VacancyResultCardProps {
  result: SearchVacancyResult;
  isApplied: boolean;
  onApply: () => void;
}

function VacancyResultCard({ result, isApplied, onApply }: VacancyResultCardProps) {
  const { t } = useTranslation();

  if (result.status === 'matched' && result.recommendation) {
    return <RecommendationCard recommendation={result.recommendation} isApplied={isApplied} onApply={onApply} />;
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{result.vacancy.title}</h3>
              {result.status === 'pending' ? (
                <Badge variant="secondary">
                  <Clock className="mr-1 h-3 w-3" />
                  {t('intelligence.aiPending')}
                </Badge>
              ) : (
                <Badge variant="outline">{t('intelligence.aiSkipped')}</Badge>
              )}
            </div>

            <p className="text-sm text-gray-500">
              {result.vacancy.source}
              {result.vacancy.sourceUrl && (
                <>
                  {' '}
                  &middot;{' '}
                  <a
                    href={result.vacancy.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {t('intelligence.view')}
                  </a>
                </>
              )}
            </p>
          </div>

          <div className="ml-4">
            {isApplied ? (
              <Badge variant="success">
                <CheckCircle className="mr-1 h-3 w-3" />
                {t('intelligence.applied')}
              </Badge>
            ) : (
              <Button size="sm" onClick={onApply}>
                {t('intelligence.apply')}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  isApplied: boolean;
  onApply: () => void;
}

const knownRecommendations = ['strong_match', 'good_match', 'partial_match'] as const;

function RecommendationCard({
  recommendation,
  isApplied,
  onApply,
}: RecommendationCardProps) {
  const { t } = useTranslation();
  const scorePercent = Math.round(recommendation.score * 100);

  const getScoreVariant = (score: number) => {
    if (score >= 0.8) return 'success';
    if (score >= 0.6) return 'warning';
    return 'secondary';
  };

  const getRecommendationVariant = (rec: string) => {
    switch (rec) {
      case 'strong_match':
        return 'success';
      case 'good_match':
        return 'warning';
      case 'partial_match':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatRecommendation = (rec: string): string => {
    if ((knownRecommendations as readonly string[]).includes(rec)) {
      return t(`intelligence.recommendations.${rec}`);
    }
    return rec.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{recommendation.vacancy.title}</h3>
              <Badge variant={getScoreVariant(recommendation.score)}>
                {t('intelligence.matchScore', { percent: scorePercent })}
              </Badge>
              <Badge variant={getRecommendationVariant(recommendation.recommendation)}>
                {formatRecommendation(recommendation.recommendation)}
              </Badge>
            </div>

            <p className="text-sm text-gray-500">
              {recommendation.vacancy.source}
              {recommendation.vacancy.sourceUrl && (
                <>
                  {' '}
                  &middot;{' '}
                  <a
                    href={recommendation.vacancy.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {t('intelligence.view')}
                  </a>
                </>
              )}
            </p>

            {recommendation.summary && (
              <p className="text-sm font-medium text-gray-700">{recommendation.summary}</p>
            )}

            {recommendation.strengths.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500">{t('intelligence.strengths')}</p>
                <div className="flex flex-wrap gap-1">
                  {recommendation.strengths.map((s) => (
                    <Badge key={s} variant="success" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {recommendation.weaknesses.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500">{t('intelligence.warnings')}</p>
                <div className="flex flex-wrap gap-1">
                  {recommendation.weaknesses.map((w) => (
                    <Badge key={w} variant="warning" className="text-xs">
                      {w}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {recommendation.missingSkills.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500">
                  {t('intelligence.missingSkills')}
                </p>
                <div className="flex flex-wrap gap-1">
                  {recommendation.missingSkills.map((s) => (
                    <Badge key={s} variant="destructive" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {recommendation.reasoning && (
              <p className="text-sm text-gray-600">{recommendation.reasoning}</p>
            )}
          </div>

          <div className="ml-4">
            {isApplied ? (
              <Badge variant="success">
                <CheckCircle className="mr-1 h-3 w-3" />
                {t('intelligence.applied')}
              </Badge>
            ) : (
              <Button size="sm" onClick={onApply}>
                {t('intelligence.apply')}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
