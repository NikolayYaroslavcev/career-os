import type { Resume, Vacancy, CompanyRepository, CompanyId, ExperienceLevel, Location } from '@careeros/career';
import type {
  MatchingEngine,
  MatchResult,
  MatchResultRepository,
  AIMetricsCollector,
  AILogger,
  AIErrorType,
} from '@careeros/ai';
import { AIError, NoopAILogger, computeVacancyAnalysisInputHash, analyzeVacancyForSearchProfile } from '@careeros/ai';
import { mapWithConcurrency } from './concurrency.js';
import { TriageMatchingService, type TriageOutcome } from './triage-matching-service.js';

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_MAX_AI_CANDIDATES = 15;

export interface AiMatchingStats {
  readonly evaluated: number;
  readonly reused: number;
  readonly computed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly triageDurationMs: number;
  readonly aiDurationMs: number;
  readonly durationMs: number;
}

export interface AiMatchingOutcome {
  readonly matchResults: readonly MatchResult[];
  readonly triage: TriageOutcome;
  readonly stats: AiMatchingStats;
  readonly aiError?: AIErrorType;
}

export interface AiMatchAllParams {
  readonly resume: Resume;
  readonly vacancies: readonly Vacancy[];
  readonly userId: string;
  readonly searchProfileId: string;
  readonly searchProfileUpdatedAt: Date;
  readonly searchProfileTechnologies?: readonly string[];
  readonly resumeText?: string;
  readonly desiredPositions?: readonly string[];
  readonly experienceLevel?: ExperienceLevel;
  readonly isRemoteOnly?: boolean;
  readonly desiredLocations?: readonly Location[];
}

export interface AiSelectionOutcome {
  /** Already have a fresh cached MatchResult — no AI call needed. */
  readonly reused: readonly MatchResult[];
  /** Triage-passed, capped at maxAiCandidates — worth an AI call. */
  readonly toAnalyze: readonly Vacancy[];
  /** Triage-rejected — will never get an AI call for this input snapshot. */
  readonly skipped: readonly Vacancy[];
  readonly triage: TriageOutcome;
}

export class AiMatchingService {
  private readonly triageService: TriageMatchingService;

  constructor(
    private readonly matchingEngine: MatchingEngine,
    private readonly matchResultRepository: MatchResultRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly metrics: AIMetricsCollector,
    private readonly concurrency: number = DEFAULT_CONCURRENCY,
    private readonly maxAiCandidates: number = DEFAULT_MAX_AI_CANDIDATES,
    private readonly logger: AILogger = new NoopAILogger()
  ) {
    this.triageService = new TriageMatchingService({ topN: maxAiCandidates });
  }

  /**
   * AI-free selection step: resolves cached MatchResults (Level 0) and runs
   * local triage (Level 1) to rank/cap which vacancies are worth an AI call.
   * Shared by matchAll() (synchronous, waits for AI) and callers that only
   * want to know *what would be analyzed* without spending an AI call
   * in-request (e.g. the /intelligence/search HTTP path, which enqueues
   * `toAnalyze` to the background queue instead of calling AI itself).
   */
  async selectForAnalysis(params: AiMatchAllParams): Promise<AiSelectionOutcome> {
    // Cached matches are free (no AI call) and must never be dropped by the
    // triage layer below, so resolve them before ranking candidates. A cached
    // row only counts as reused if its inputHash still matches — otherwise the
    // vacancy or search profile changed since it was generated and it must be
    // routed through triage/AI again like any uncomputed vacancy.
    const reuseChecks = await Promise.all(
      params.vacancies.map(async (vacancy) => {
        const existing = await this.matchResultRepository.findBySearchProfileIdAndVacancyId(
          params.searchProfileId,
          vacancy.id
        );
        const currentHash = computeVacancyAnalysisInputHash({
          vacancyId: vacancy.id,
          vacancyUpdatedAt: vacancy.updatedAt,
          searchProfileId: params.searchProfileId,
          searchProfileUpdatedAt: params.searchProfileUpdatedAt,
          resumeId: params.resume.id,
          resumeUpdatedAt: params.resume.updatedAt,
        });
        return { vacancy, existing: existing && existing.inputHash === currentHash ? existing : null };
      })
    );

    const reusedResults: MatchResult[] = [];
    const needsMatching: Vacancy[] = [];
    for (const { vacancy, existing } of reuseChecks) {
      if (existing) {
        reusedResults.push(existing);
        this.metrics.incrementCounter('careeros.ai_matching.reused');
      } else {
        needsMatching.push(vacancy);
      }
    }

    // Level 1: Triage (no AI, local scoring)
    const triageOutcome = this.triageService.triage({
      resume: params.resume,
      vacancies: needsMatching,
      searchProfileTechnologies: params.searchProfileTechnologies,
      resumeText: params.resumeText,
      desiredPositions: params.desiredPositions,
      experienceLevel: params.experienceLevel,
      isRemoteOnly: params.isRemoteOnly,
      desiredLocations: params.desiredLocations,
    });

    this.metrics.incrementCounter('careeros.ai_matching.triage_total', triageOutcome.stats.total);
    this.metrics.incrementCounter('careeros.ai_matching.triage_passed', triageOutcome.stats.passed);
    this.metrics.incrementCounter('careeros.ai_matching.triage_rejected', triageOutcome.stats.rejected);

    if (triageOutcome.rejected.length > 0) {
      this.metrics.incrementCounter('careeros.ai_matching.skipped_by_triage', triageOutcome.rejected.length);
    }

    return {
      reused: reusedResults,
      toAnalyze: triageOutcome.passed,
      skipped: triageOutcome.rejected,
      triage: triageOutcome,
    };
  }

  async matchAll(params: AiMatchAllParams): Promise<AiMatchingOutcome> {
    const startedAt = Date.now();
    const companyNameCache = new Map<string, string>();
    let failed = 0;
    let firstAiError: AIErrorType | undefined;

    const triageStart = Date.now();
    const selection = await this.selectForAnalysis(params);
    const triageDurationMs = Date.now() - triageStart;
    const triageOutcome = selection.triage;
    const reusedResults = [...selection.reused];

    // Level 2: Full AI matching (only for triage survivors)
    const aiStart = Date.now();
    const computedResults = await mapWithConcurrency(selection.toAnalyze, this.concurrency, async (vacancy) => {
      try {
        return await this.matchVacancy(params, vacancy, companyNameCache);
      } catch (error) {
        failed += 1;
        this.metrics.incrementCounter('careeros.ai_matching.failed');
        const aiError = error instanceof AIError ? error : undefined;
        this.logger.error('AI matching failed for vacancy', error instanceof Error ? error : undefined, {
          vacancyId: vacancy.id,
          title: vacancy.title,
          errorType: aiError?.type ?? 'UNKNOWN_ERROR',
          provider: aiError?.provider,
          model: aiError?.model,
        });
        // Track the first AI error type for error propagation
        if (aiError && !firstAiError) {
          firstAiError = aiError.type;
        }
        return undefined;
      }
    });
    const aiDurationMs = Date.now() - aiStart;

    const matchResults = [
      ...reusedResults,
      ...computedResults.filter((result): result is MatchResult => result !== undefined),
    ];

    const durationMs = Date.now() - startedAt;
    this.metrics.recordHistogram('careeros.ai_matching.batch_duration_ms', durationMs);
    this.metrics.recordHistogram('careeros.ai_matching.triage_duration_ms', triageDurationMs);
    this.metrics.recordHistogram('careeros.ai_matching.ai_duration_ms', aiDurationMs);
    this.metrics.incrementCounter('careeros.ai_matching.evaluated', matchResults.length);

    return {
      matchResults,
      triage: triageOutcome,
      stats: {
        evaluated: matchResults.length,
        reused: reusedResults.length,
        computed: computedResults.filter((result) => result !== undefined).length,
        failed,
        skipped: triageOutcome.rejected.length,
        triageDurationMs,
        aiDurationMs,
        durationMs,
      },
      aiError: firstAiError,
    };
  }

  private async matchVacancy(
    params: AiMatchAllParams,
    vacancy: Vacancy,
    companyNameCache: Map<string, string>
  ): Promise<MatchResult> {
    const companyName = await this.resolveCompanyName(vacancy.companyId, companyNameCache);
    const resume = params.resume;

    const outcome = await analyzeVacancyForSearchProfile(
      {
        matchingEngine: this.matchingEngine,
        matchResultRepository: this.matchResultRepository,
        logger: this.logger,
      },
      {
        vacancyId: vacancy.id,
        vacancyUpdatedAt: vacancy.updatedAt,
        vacancyTitle: vacancy.title,
        vacancyDescription: vacancy.description,
        companyName,
        technologies: vacancy.technologies.map((t) => t.name),
        experienceLevel: vacancy.experienceLevel,
        salaryRange: vacancy.salary?.toString(),
        location: vacancy.location.toString(),
      },
      {
        searchProfileId: params.searchProfileId,
        searchProfileUpdatedAt: params.searchProfileUpdatedAt,
        userId: params.userId,
        desiredPositions: params.desiredPositions,
        desiredTechnologies: params.searchProfileTechnologies,
        desiredExperienceLevel: params.experienceLevel,
        isRemoteOnly: params.isRemoteOnly,
        desiredLocations: params.desiredLocations?.map((location) => location.toString()),
      },
      {
        resumeId: resume.id,
        resumeUpdatedAt: resume.updatedAt,
        summary: resume.summary,
        skills: resume.skills.map((s) => s.name),
        technologies: resume.technologies.map((t) => t.name),
        yearsOfExperience: resume.totalYearsOfExperience,
        rawText: resume.rawText,
      }
    );

    return outcome.matchResult;
  }

  private async resolveCompanyName(companyId: CompanyId, cache: Map<string, string>): Promise<string> {
    const cached = cache.get(companyId);
    if (cached) return cached;

    const company = await this.companyRepository.findById(companyId);
    const name = company?.name ?? 'Unknown Company';
    cache.set(companyId, name);
    return name;
  }
}
