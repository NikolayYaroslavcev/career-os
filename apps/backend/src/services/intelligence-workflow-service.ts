import type { Resume, ResumeRepository, UserRepository, Vacancy, VacancyRepository } from '@careeros/career';
import { createUserId, createVacancyId } from '@careeros/career';
import type { AIErrorType, AILogger } from '@careeros/ai';
import { NoopAILogger } from '@careeros/ai';
import type { ProviderSearchService, ProviderSearchStats } from './provider-search-service.js';
import type { AiMatchingService, AiMatchingStats, AiMatchAllParams } from './ai-matching-service.js';
import type { RecommendationService, Recommendation } from './recommendation-service.js';
import type { SearchProfile } from '@careeros/career';
import type { SearchProfileService } from './search-profile-service.js';
import type { VacancyAnalysisQueue } from '../queues/vacancy-analysis-queue.js';
import { NoopVacancyAnalysisQueue } from '../queues/vacancy-analysis-queue.js';
import type { AiBatchBacklog } from '@careeros/shared';
import { InMemoryAiBatchBacklog } from '@careeros/shared';
import type { SearchRunStage, VacancyExclusion, VacancyExclusionReason } from './search-run-trace.js';
import { SearchRunTraceRecorder } from './search-run-trace.js';

export class NoResumeFoundError extends Error {
  constructor(userId: string) {
    super(`User '${userId}' has no resume to match against`);
    this.name = 'NoResumeFoundError';
  }
}

export class NoActiveSearchProfileError extends Error {
  constructor(userId: string) {
    super(`User '${userId}' has no active search profile`);
    this.name = 'NoActiveSearchProfileError';
  }
}

export class NoWorkspaceFoundError extends Error {
  constructor(userId: string) {
    super(`User '${userId}' has no workspace`);
    this.name = 'NoWorkspaceFoundError';
  }
}

export interface IntelligenceWorkflowStats {
  readonly providerSearch: ProviderSearchStats;
  readonly aiMatching: AiMatchingStats;
  readonly recommendationCount: number;
  readonly totalDurationMs: number;
}

export interface IntelligenceWorkflowResult {
  readonly searchProfileId: string;
  readonly vacancies: readonly Vacancy[];
  readonly recommendations: readonly Recommendation[];
  /** Vacancy IDs queued for background AI analysis — not yet scored. */
  readonly pendingVacancyIds: readonly string[];
  /** Vacancy IDs that will never get an AI call for this snapshot (triage-rejected, or AI disabled). */
  readonly skippedVacancyIds: readonly string[];
  readonly stats: IntelligenceWorkflowStats;
  readonly aiEnabled: boolean;
  readonly aiError?: AIErrorType;
}

export interface MatchStatusResult {
  readonly recommendations: readonly Recommendation[];
  readonly pendingVacancyIds: readonly string[];
  readonly skippedVacancyIds: readonly string[];
}

export class IntelligenceWorkflowService {
  constructor(
    private readonly searchProfileService: SearchProfileService,
    private readonly providerSearchService: ProviderSearchService,
    private readonly aiMatchingService: AiMatchingService,
    private readonly recommendationService: RecommendationService,
    private readonly resumeRepository: ResumeRepository,
    private readonly userRepository: UserRepository,
    private readonly vacancyRepository: VacancyRepository,
    private readonly vacancyAnalysisQueue: VacancyAnalysisQueue = new NoopVacancyAnalysisQueue(),
    private readonly logger: AILogger = new NoopAILogger(),
    private readonly aiEnabled: boolean = true,
    private readonly aiBatchBacklog: AiBatchBacklog = new InMemoryAiBatchBacklog(),
    private readonly searchRunTraceRecorder: SearchRunTraceRecorder = new SearchRunTraceRecorder()
  ) {}

  /**
   * Runs Search Profile -> Provider Search -> Persistence, then either:
   *  - `awaitAiMatching: true` (MorningDigestService, demo scripts — background
   *    jobs, not a live browser request): computes AI matches synchronously and
   *    waits, same as the historical behavior.
   *  - `awaitAiMatching: false` (default; used by the /intelligence/search HTTP
   *    route): never calls AI in-request. Cached matches are returned
   *    immediately; everything else is enqueued to the background worker
   *    (apps/worker) and reported as pending. The request always returns fast —
   *    AI provider latency/rate-limits/outages cannot block it.
   * `aiEnabled: false` (AI_ENABLED env var) short-circuits both modes: no AI
   * calls, no queue, cached-only results.
   */
  async run(params: {
    userId: string;
    searchProfileId?: string;
    providerId?: string;
    resume?: Resume;
    awaitAiMatching?: boolean;
  }): Promise<IntelligenceWorkflowResult> {
    const startedAt = Date.now();
    const awaitAiMatching = params.awaitAiMatching ?? false;

    this.logger.info('SEARCH START', {
      userId: params.userId,
      searchProfileId: params.searchProfileId,
      awaitAiMatching,
      aiEnabled: this.aiEnabled,
    });

    const profile = params.searchProfileId
      ? await this.searchProfileService.getById(params.searchProfileId)
      : await this.searchProfileService.getActiveForUser(params.userId);

    if (!profile) {
      throw new NoActiveSearchProfileError(params.userId);
    }

    const resume = params.resume ?? (await this.resumeRepository.findDefaultByUserId(profile.userId));
    if (!resume) {
      throw new NoResumeFoundError(params.userId);
    }

    const user = await this.userRepository.findById(createUserId(params.userId));
    const workspaceId = user?.workspaceIds[0];
    if (!workspaceId) {
      throw new NoWorkspaceFoundError(params.userId);
    }

    this.logger.info('Provider search started', { workspaceId, searchProfileId: profile.id });
    const providerSearch = await this.providerSearchService.searchAndPersist(profile, params.providerId, workspaceId);
    this.logger.info('Provider search finished', {
      fetched: providerSearch.stats.fetched,
      persisted: providerSearch.stats.persisted,
      durationMs: providerSearch.stats.durationMs,
    });

    const matchParams = this.buildMatchParams(profile, resume, params.userId, providerSearch.vacancies);
    const vacancyById = new Map(providerSearch.vacancies.map((vacancy) => [vacancy.id, vacancy]));

    if (awaitAiMatching && this.aiEnabled) {
      const aiMatching = await this.aiMatchingService.matchAll(matchParams);
      const recommendations = this.recommendationService.build(aiMatching.matchResults, vacancyById);
      const matchedIds = new Set(aiMatching.matchResults.map((match) => match.vacancyId));
      const skippedVacancyIds = providerSearch.vacancies
        .filter((vacancy) => !matchedIds.has(vacancy.id))
        .map((vacancy) => vacancy.id);

      const { stages: providerStages, exclusions: providerExclusions } = this.buildProviderStagesAndExclusions(
        providerSearch.stats
      );
      // Reused (cache-hit) vacancies never enter triage's `results` — only
      // the ones that needed matching do — so the set difference against
      // everything persisted for this search recovers exactly the cache hits.
      const triagedIds = new Set(aiMatching.triage.results.map((r) => r.vacancy.id));
      const cacheHitIds = providerSearch.vacancies.filter((v) => !triagedIds.has(v.id)).map((v) => v.id);

      this.searchRunTraceRecorder.record({
        runId: crypto.randomUUID(),
        searchProfileId: profile.id,
        userId: params.userId,
        startedAt: new Date(startedAt),
        totalDurationMs: Date.now() - startedAt,
        aiEnabled: true,
        awaitedAiMatching: true,
        stages: [
          ...providerStages,
          { name: 'AI Selection', input: providerSearch.vacancies.length, output: aiMatching.triage.results.length, durationMs: aiMatching.stats.triageDurationMs, success: true },
          { name: 'Keyword Ranking', input: aiMatching.triage.results.length, output: aiMatching.triage.passed.length, durationMs: 0, success: true },
          { name: 'LLM', input: aiMatching.triage.passed.length, output: aiMatching.stats.computed, durationMs: aiMatching.stats.aiDurationMs, success: !aiMatching.aiError },
          { name: 'Persistence', input: aiMatching.stats.computed, output: recommendations.length, durationMs: 0, success: true },
        ],
        exclusions: [
          ...providerExclusions,
          ...cacheHitIds.map((vacancyId): VacancyExclusion => ({ vacancyId, reason: 'cache_hit', stage: 'AI Selection' })),
          ...aiMatching.triage.results
            .filter((r) => !r.passed)
            .map((r): VacancyExclusion => ({
              vacancyId: r.vacancy.id,
              reason: r.rejectionReason as VacancyExclusionReason,
              stage: 'Keyword Ranking',
            })),
          ...aiMatching.failedVacancyIds.map((vacancyId): VacancyExclusion => ({ vacancyId, reason: 'ai_failed', stage: 'LLM' })),
        ],
      });

      return {
        searchProfileId: profile.id,
        vacancies: providerSearch.vacancies,
        recommendations,
        pendingVacancyIds: [],
        skippedVacancyIds,
        stats: {
          providerSearch: providerSearch.stats,
          aiMatching: aiMatching.stats,
          recommendationCount: recommendations.length,
          totalDurationMs: Date.now() - startedAt,
        },
        aiError: aiMatching.aiError,
        aiEnabled: true,
      };
    }

    // Everything above this point is local (DB reuse-check + in-process
    // triage scoring, no AI provider calls). Everything below is either the
    // enqueue call (fire-and-forget from the caller's perspective — its
    // await is just the Redis round-trip to add jobs, not job completion) or
    // pure in-memory response building. Nothing here awaits AI matching,
    // queue *processing*, or MatchResult persistence — that all happens in
    // apps/worker, off this request entirely.
    const triageStart = Date.now();
    const selection = await this.aiMatchingService.selectForAnalysis(matchParams);
    const triageDurationMs = Date.now() - triageStart;

    let enqueueDurationMs = 0;
    let queueSucceeded = true;
    if (this.aiEnabled) {
      const enqueueStart = Date.now();
      try {
        await this.vacancyAnalysisQueue.enqueue(
          selection.toAnalyze.map((vacancy) => ({ vacancyId: vacancy.id, searchProfileId: profile.id }))
        );
        enqueueDurationMs = Date.now() - enqueueStart;
        this.logger.info('Jobs enqueued', {
          count: selection.toAnalyze.length,
          searchProfileId: profile.id,
          enqueueDurationMs,
        });

        // Continuous background processing (EPIC-17 Part 6): candidates that
        // scored above minScore but were ranked below this batch's topN cut
        // aren't discarded — they're queued in the backlog so the worker can
        // pull the next batch once this one finishes, continuing until every
        // candidate above minScore has been processed. Vacancies that scored
        // below minScore (or failed a hard remote-only mismatch) are true
        // dead ends and never enter the backlog.
        const backlogCandidateIds = selection.triage.results
          .filter((result) => result.rejectionReason === 'outside_top_n')
          .map((result) => result.vacancy.id);
        await this.aiBatchBacklog.push(profile.id, backlogCandidateIds);
      } catch (error) {
        enqueueDurationMs = Date.now() - enqueueStart;
        queueSucceeded = false;
        // Vacancies stay in "pending" state client-side until the queue
        // recovers — the search response itself must never fail because
        // Redis is unavailable. The frontend's polling timeout is the
        // backstop against a permanently-stuck spinner.
        this.logger.warn('Failed to enqueue vacancy analysis jobs', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      this.logger.info('AI disabled — skipping vacancy analysis queue', { searchProfileId: profile.id });
    }

    const recommendations = this.recommendationService.build([...selection.reused], vacancyById);
    const pendingVacancyIds = this.aiEnabled ? selection.toAnalyze.map((vacancy) => vacancy.id) : [];
    const skippedVacancyIds = this.aiEnabled
      ? selection.skipped.map((vacancy) => vacancy.id)
      : [...selection.toAnalyze, ...selection.skipped].map((vacancy) => vacancy.id);

    const totalDurationMs = Date.now() - startedAt;
    this.logger.info('Workflow finished (async — AI not awaited)', {
      searchProfileId: profile.id,
      fetchDurationMs: providerSearch.stats.fetchDurationMs,
      persistDurationMs: providerSearch.stats.persistDurationMs,
      triageDurationMs,
      enqueueDurationMs,
      totalDurationMs,
    });

    const { stages: providerStages, exclusions: providerExclusions } = this.buildProviderStagesAndExclusions(
      providerSearch.stats
    );

    this.searchRunTraceRecorder.record({
      runId: crypto.randomUUID(),
      searchProfileId: profile.id,
      userId: params.userId,
      startedAt: new Date(startedAt),
      totalDurationMs,
      aiEnabled: this.aiEnabled,
      awaitedAiMatching: false,
      stages: this.aiEnabled
        ? [
            ...providerStages,
            { name: 'AI Selection', input: providerSearch.vacancies.length, output: selection.triage.results.length, durationMs: triageDurationMs, success: true },
            { name: 'Keyword Ranking', input: selection.triage.results.length, output: selection.toAnalyze.length, durationMs: 0, success: true },
            { name: 'Queue', input: selection.toAnalyze.length, output: queueSucceeded ? selection.toAnalyze.length : 0, durationMs: enqueueDurationMs, success: queueSucceeded },
          ]
        : providerStages,
      exclusions: this.aiEnabled
        ? [
            ...providerExclusions,
            ...selection.reused.map((match): VacancyExclusion => ({ vacancyId: match.vacancyId, reason: 'cache_hit', stage: 'AI Selection' })),
            ...selection.triage.results
              .filter((r) => !r.passed)
              .map((r): VacancyExclusion => ({
                vacancyId: r.vacancy.id,
                reason: r.rejectionReason as VacancyExclusionReason,
                stage: 'Keyword Ranking',
              })),
          ]
        : providerExclusions,
    });

    return {
      searchProfileId: profile.id,
      vacancies: providerSearch.vacancies,
      recommendations,
      pendingVacancyIds,
      skippedVacancyIds,
      stats: {
        providerSearch: providerSearch.stats,
        aiMatching: {
          evaluated: selection.reused.length,
          reused: selection.reused.length,
          computed: 0,
          failed: 0,
          skipped: selection.skipped.length,
          triageDurationMs,
          aiDurationMs: 0,
          durationMs: triageDurationMs,
        },
        recommendationCount: recommendations.length,
        totalDurationMs,
      },
      aiEnabled: this.aiEnabled,
    };
  }

  /**
   * Polling endpoint backing the dashboard's "AI analysis in progress" UI:
   * given a set of vacancy IDs from a prior run(), reports which now have a
   * cached MatchResult (worker finished) vs are still pending/skipped. Never
   * calls AI itself — same cached-lookup + local triage as run()'s async path.
   */
  async getMatchStatus(params: {
    userId: string;
    searchProfileId: string;
    vacancyIds: readonly string[];
  }): Promise<MatchStatusResult> {
    const profile = await this.searchProfileService.getById(params.searchProfileId);
    if (!profile) {
      throw new NoActiveSearchProfileError(params.userId);
    }

    const resume = await this.resumeRepository.findDefaultByUserId(profile.userId);
    if (!resume) {
      throw new NoResumeFoundError(params.userId);
    }

    const vacancies = (
      await Promise.all(params.vacancyIds.map((id) => this.vacancyRepository.findById(createVacancyId(id))))
    ).filter((vacancy): vacancy is Vacancy => vacancy !== null);

    const matchParams = this.buildMatchParams(profile, resume, params.userId, vacancies);
    const selection = await this.aiMatchingService.selectForAnalysis(matchParams);

    const vacancyById = new Map(vacancies.map((vacancy) => [vacancy.id, vacancy]));
    const recommendations = this.recommendationService.build([...selection.reused], vacancyById);

    return {
      recommendations,
      pendingVacancyIds: selection.toAnalyze.map((vacancy) => vacancy.id),
      skippedVacancyIds: selection.skipped.map((vacancy) => vacancy.id),
    };
  }

  /**
   * The Provider Fetch -> Normalization -> Deduplication -> Rule Filtering
   * portion of the trace is identical for both the awaited and async paths
   * (it happens before either branches), so it's built once here.
   */
  private buildProviderStagesAndExclusions(stats: ProviderSearchStats): {
    stages: SearchRunStage[];
    exclusions: VacancyExclusion[];
  } {
    const rawTotal = stats.perProvider.reduce((sum, p) => sum + (p.rawFetchedCount ?? p.fetched), 0);
    const fetchOk = stats.perProvider.some((p) => p.ok);

    const stages: SearchRunStage[] = [
      { name: 'Provider Fetch', input: rawTotal, output: rawTotal, durationMs: stats.fetchDurationMs, success: fetchOk },
      { name: 'Normalization', input: rawTotal, output: stats.fetched, durationMs: 0, success: true },
      { name: 'Deduplication', input: stats.fetched, output: stats.deduplicatedCount, durationMs: 0, success: true },
      { name: 'Rule Filtering', input: stats.deduplicatedCount, output: stats.filteredCount, durationMs: 0, success: true },
    ];

    const exclusions: VacancyExclusion[] = [
      ...stats.duplicateVacancyIds.map((vacancyId): VacancyExclusion => ({ vacancyId, reason: 'duplicate', stage: 'Deduplication' })),
      ...stats.perProvider.flatMap((provider) =>
        (provider.parseFailures ?? []).map(
          (failure): VacancyExclusion => ({
            vacancyId: `${provider.providerId}:${failure.sourceId}`,
            reason: 'provider_parse_failure',
            stage: 'Normalization',
          })
        )
      ),
    ];

    return { stages, exclusions };
  }

  private buildMatchParams(
    profile: SearchProfile,
    resume: Resume,
    userId: string,
    vacancies: readonly Vacancy[]
  ): AiMatchAllParams {
    return {
      resume,
      vacancies,
      userId,
      searchProfileId: profile.id,
      searchProfileUpdatedAt: profile.updatedAt,
      searchProfileTechnologies: profile.desiredTechnologies.map((t) => t.name),
      resumeText: resume.rawText,
      desiredPositions: profile.desiredPositions,
      experienceLevel: profile.experienceLevel,
      isRemoteOnly: profile.isRemoteOnly,
      desiredLocations: [...profile.desiredLocations],
    };
  }
}
