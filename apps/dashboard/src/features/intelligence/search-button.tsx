'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
import { recordVacancySave } from '@/api/sync';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { pluralize } from '@/lib/i18n/pluralize';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';

const RESULTS_PAGE_SIZE = 10;

const POLL_INTERVAL_MS = 4000;
// ~2 minutes of polling per search — a backstop against a permanently-stuck
// spinner if the worker/queue is down, not an expected steady state.
const MAX_POLL_ATTEMPTS = 30;

// Search results are re-fetched from a live provider call, not re-derivable
// from a URL param, so we cache the last run in sessionStorage. Without this,
// navigating away (e.g. to save a vacancy to the pipeline) and back loses the
// results and forces the user to re-run the search.
const SEARCH_CACHE_KEY = 'careeros:ai-search-cache';

interface CachedSearchState {
  searchProfileId: string | null;
  searchToken: number;
  results: SearchVacancyResult[];
  stats: SearchResponse['stats'];
  aiEnabled: boolean;
  sortBy: SortOption;
}

function loadCachedSearch(): CachedSearchState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SEARCH_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedSearchState) : null;
  } catch {
    return null;
  }
}

export function SearchButton(): React.JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();
  const [cached] = useState(loadCachedSearch);
  const [isLoading, setIsLoading] = useState(false);
  const [searchProfileId, setSearchProfileId] = useState<string | null>(cached?.searchProfileId ?? null);
  const [searchToken, setSearchToken] = useState(cached?.searchToken ?? 0);
  const [results, setResults] = useState<SearchVacancyResult[] | null>(cached?.results ?? null);
  const [stats, setStats] = useState<SearchResponse['stats'] | null>(cached?.stats ?? null);
  const [aiEnabled, setAiEnabled] = useState(cached?.aiEnabled ?? true);
  const [error, setError] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [activeProfile, setActiveProfile] = useState<SearchProfile | null>(null);
  const [profileCheckDone, setProfileCheckDone] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>(cached?.sortBy ?? 'score-desc');

  const resultsRef = useRef<SearchVacancyResult[] | null>(null);
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  useEffect(() => {
    if (typeof window === 'undefined' || !results || !stats) return;
    try {
      sessionStorage.setItem(
        SEARCH_CACHE_KEY,
        JSON.stringify({ searchProfileId, searchToken, results, stats, aiEnabled, sortBy }),
      );
    } catch {
      // sessionStorage unavailable/full — search state just won't persist across navigation.
    }
  }, [searchProfileId, searchToken, results, stats, aiEnabled, sortBy]);

  useEffect(() => {
    const checkProfile = async (): Promise<void> => {
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

    return (): void => clearInterval(intervalId);
  }, [searchProfileId, searchToken]);

  // stats.matchedVacancies/pendingVacancies/averageScore reflect the snapshot
  // at search time — AI matching resolves progressively via the poll effect
  // above, so once polling updates a result's status those counts go stale.
  // totalVacancies isn't affected (it's the fixed size of the searched set).
  const liveStats = useMemo(() => {
    if (!stats) return stats;
    if (!results) return stats;

    const matched = results.filter((r) => r.status === 'matched' && r.recommendation);
    const pending = results.filter((r) => r.status === 'pending').length;
    const averageScore =
      matched.length > 0
        ? matched.reduce((sum, r) => sum + (r.recommendation?.score ?? 0), 0) / matched.length
        : 0;

    return {
      ...stats,
      matchedVacancies: matched.length,
      pendingVacancies: pending,
      averageScore,
    };
  }, [stats, results]);

  const handleSearch = async (): Promise<void> => {
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

  const handleSaveToPipeline = async (result: SearchVacancyResult): Promise<void> => {
    try {
      await createApplication({
        vacancyId: result.vacancy.id,
        matchResultId: result.recommendation?.matchResultId,
      });
      setAppliedIds((prev) => new Set(prev).add(result.vacancy.id));
      recordVacancySave(result.vacancy.id).catch(() => {});
    } catch (err) {
      console.error('Failed to save to pipeline:', err);
    }
  };

  const handleOpenApplicationPage = (result: SearchVacancyResult): void => {
    const url = result.vacancy.applyUrl ?? result.vacancy.sourceUrl;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
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
          <p className="text-sm text-muted-foreground">{t('intelligence.subtitle')}</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-600 dark:text-amber-400" />
            <h3 className="mb-2 text-lg font-medium text-foreground">
              {t('intelligence.noProfileTitle')}
            </h3>
            <p className="mb-6 text-sm text-muted-foreground">{t('intelligence.noProfileSubtitle')}</p>
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
          <p className="text-sm text-muted-foreground">{t('intelligence.subtitle')}</p>
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
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <AlertDescription>
            <p className="font-medium">{t('intelligence.aiErrorTitle')}</p>
            <p className="mt-1">{error}</p>
          </AlertDescription>
        </Alert>
      )}

      {results && liveStats && (
        <div className="space-y-4">
          {!aiEnabled && (
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              {t('intelligence.aiDisabledNotice')}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold">{liveStats.totalVacancies}</p>
                <p className="text-sm text-muted-foreground">{t('intelligence.totalVacancies')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold">{liveStats.matchedVacancies}</p>
                <p className="text-sm text-muted-foreground">{t('intelligence.matched')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold">{liveStats.pendingVacancies}</p>
                <p className="text-sm text-muted-foreground">{t('intelligence.pending')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold">
                  {Math.round(liveStats.averageScore * 100)}%
                </p>
                <p className="text-sm text-muted-foreground">{t('intelligence.avgScore')}</p>
              </CardContent>
            </Card>
          </div>

          <VacancyResultList
            key={searchToken}
            results={results}
            appliedIds={appliedIds}
            onSaveToPipeline={handleSaveToPipeline}
            onOpenApplicationPage={handleOpenApplicationPage}
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
    const scoreA = a.recommendation?.score ?? 0;
    const scoreB = b.recommendation?.score ?? 0;
    switch (sortBy) {
      case 'score-asc':
        return scoreA - scoreB;
      case 'date-desc':
        return new Date(b.recommendation?.generatedAt ?? 0).getTime() - new Date(a.recommendation?.generatedAt ?? 0).getTime();
      case 'score-desc':
      default:
        return scoreB - scoreA;
    }
  });

  return [...sortedMatched, ...rest];
}

function sortOptionLabel(value: SortOption, t: (key: string) => string): string {
  switch (value) {
    case 'score-asc':
      return t('intelligence.sortByScoreAsc');
    case 'date-desc':
      return t('intelligence.sortByDate');
    case 'score-desc':
    default:
      return t('intelligence.sortByScoreDesc');
  }
}

interface VacancyResultListProps {
  results: SearchVacancyResult[];
  appliedIds: Set<string>;
  onSaveToPipeline: (result: SearchVacancyResult) => void;
  onOpenApplicationPage: (result: SearchVacancyResult) => void;
  sortBy: SortOption;
  onSortByChange: (sortBy: SortOption) => void;
}

function VacancyResultList({ results, appliedIds, onSaveToPipeline, onOpenApplicationPage, sortBy, onSortByChange }: VacancyResultListProps): React.JSX.Element {
  const { t, locale } = useTranslation();
  const [page, setPage] = useState(1);

  // 'skipped' vacancies never got (and never will get, for this snapshot) an
  // AI call — see VacancyMatchStatus in api/intelligence.ts. Showing them
  // here would just re-list the raw provider catalog (already browsable at
  // /app/search) underneath a page whose whole point is AI-scored results.
  const visible = results.filter((r) => r.status !== 'skipped');
  const hiddenCount = results.length - visible.length;

  if (visible.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {t('intelligence.empty')}
        </CardContent>
      </Card>
    );
  }

  const sorted = sortResults(visible, sortBy);
  const paged = sorted.slice((page - 1) * RESULTS_PAGE_SIZE, page * RESULTS_PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {hiddenCount > 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('intelligence.hiddenNotice', {
              count: hiddenCount,
              unit: pluralize(locale, hiddenCount, { one: t('intelligence.hiddenUnit.one'), few: t('intelligence.hiddenUnit.few'), many: t('intelligence.hiddenUnit.many') }),
            })}
          </p>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {t('intelligence.sortLabel')}
          </span>
          <Select value={sortBy} onValueChange={(v) => { if (v) onSortByChange(v as SortOption); }}>
            <SelectTrigger className="h-8 w-auto" size="sm">
              <SelectValue>
                {(value: SortOption) => sortOptionLabel(value, t)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score-desc">{t('intelligence.sortByScoreDesc')}</SelectItem>
              <SelectItem value="score-asc">{t('intelligence.sortByScoreAsc')}</SelectItem>
              <SelectItem value="date-desc">{t('intelligence.sortByDate')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {paged.map((result) => (
        <VacancyResultCard
          key={result.vacancy.id}
          result={result}
          isApplied={appliedIds.has(result.vacancy.id)}
          onSaveToPipeline={() => onSaveToPipeline(result)}
          onOpenApplicationPage={() => onOpenApplicationPage(result)}
        />
      ))}
      <Pagination
        page={page}
        pageSize={RESULTS_PAGE_SIZE}
        total={sorted.length}
        onPageChange={setPage}
        previousLabel={t('common.previous')}
        nextLabel={t('common.next')}
        rangeLabel={t('common.rangeOf', {
          from: Math.min((page - 1) * RESULTS_PAGE_SIZE + 1, sorted.length),
          to: Math.min(page * RESULTS_PAGE_SIZE, sorted.length),
          total: sorted.length,
        })}
      />
    </div>
  );
}

interface VacancyResultCardProps {
  result: SearchVacancyResult;
  isApplied: boolean;
  onSaveToPipeline: () => void;
  onOpenApplicationPage: () => void;
}

function VacancyResultCard({ result, isApplied, onSaveToPipeline, onOpenApplicationPage }: VacancyResultCardProps): React.JSX.Element {
  const { t } = useTranslation();

  if (result.status === 'matched' && result.recommendation) {
    return <RecommendationCard recommendation={result.recommendation} isApplied={isApplied} onSaveToPipeline={onSaveToPipeline} onOpenApplicationPage={onOpenApplicationPage} />;
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

            <p className="text-sm text-muted-foreground">
              {result.vacancy.source ?? ''}
              {result.vacancy.sourceUrl && (
                <>
                  {' '}
                  &middot;{' '}
                  <a
                    href={result.vacancy.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {t('intelligence.view')}
                  </a>
                </>
              )}
            </p>
          </div>

          <div className="ml-4 flex flex-col gap-2">
            {isApplied ? (
              <Badge variant="success">
                <CheckCircle className="mr-1 h-3 w-3" />
                {t('intelligence.savedToPipeline')}
              </Badge>
            ) : (
              <>
                <Button size="sm" onClick={onSaveToPipeline}>
                  {t('intelligence.saveToPipeline')}
                </Button>
                <Button size="sm" variant="outline" onClick={onOpenApplicationPage}>
                  {t('intelligence.openApplicationPage')}
                </Button>
              </>
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
  onSaveToPipeline: () => void;
  onOpenApplicationPage: () => void;
}

const knownRecommendations = ['strong_match', 'good_match', 'partial_match'] as const;

function RecommendationCard({
  recommendation,
  isApplied,
  onSaveToPipeline,
  onOpenApplicationPage,
}: RecommendationCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const scorePercent = Math.round(recommendation.score * 100);

  const getScoreVariant = (score: number): 'success' | 'warning' | 'secondary' => {
    if (score >= 0.8) return 'success';
    if (score >= 0.6) return 'warning';
    return 'secondary';
  };

  const getRecommendationVariant = (rec: string): 'success' | 'warning' | 'secondary' | 'outline' => {
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

            <p className="text-sm text-muted-foreground">
              {recommendation.vacancy.source ?? ''}
              {recommendation.vacancy.sourceUrl && (
                <>
                  {' '}
                  &middot;{' '}
                  <a
                    href={recommendation.vacancy.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {t('intelligence.view')}
                  </a>
                </>
              )}
            </p>

            {recommendation.summary && (
              <p className="text-sm font-medium text-foreground">{recommendation.summary}</p>
            )}

            {recommendation.strengths.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t('intelligence.strengths')}</p>
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
                <p className="text-xs font-medium text-muted-foreground">{t('intelligence.warnings')}</p>
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
                <p className="text-xs font-medium text-muted-foreground">
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
              <p className="text-sm text-muted-foreground">{recommendation.reasoning}</p>
            )}
          </div>

          <div className="ml-4 flex flex-col gap-2">
            {isApplied ? (
              <Badge variant="success">
                <CheckCircle className="mr-1 h-3 w-3" />
                {t('intelligence.savedToPipeline')}
              </Badge>
            ) : (
              <>
                <Button size="sm" onClick={onSaveToPipeline}>
                  {t('intelligence.saveToPipeline')}
                </Button>
                <Button size="sm" variant="outline" onClick={onOpenApplicationPage}>
                  {t('intelligence.openApplicationPage')}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
