import type { AIProvider } from '@careeros/ai';
import {
  MatchingEngine,
  VacancyAnalysisPromptBuilder,
  analyzeVacancyForSearchProfile,
  type AICache,
  type CostTracker,
  type AILogger,
  type AIMetricsCollector,
  type AITracer,
  type MatchResultRepository,
} from '@careeros/ai';
import type { JobHandler, JobHandlerResult } from '../../orchestrator-config.js';

export interface AnalyzeVacancyInput {
  readonly vacancyId: string;
  readonly vacancyUpdatedAt: Date;
  readonly vacancyTitle: string;
  readonly vacancyDescription: string;
  readonly companyName: string;
  readonly technologies: string[];
  readonly experienceLevel?: string;
  readonly salaryRange?: string;
  readonly location: string;
  readonly userId: string;
  readonly searchProfileId: string;
  readonly searchProfileUpdatedAt: Date;
  readonly desiredPositions: string[];
  readonly desiredTechnologies: string[];
  readonly desiredExperienceLevel: string;
  readonly isRemoteOnly: boolean;
  readonly desiredLocations: string[];
  readonly resume?: {
    readonly resumeId: string;
    readonly resumeUpdatedAt: Date;
    readonly summary: string;
    readonly skills: string[];
    readonly technologies: string[];
    readonly yearsOfExperience: number;
    readonly rawText: string;
  };
}

export interface AnalyzeVacancyResult {
  readonly overallScore: number;
  readonly confidence: number;
  readonly recommendation: string;
  readonly summary: string;
  readonly strengths: string[];
  readonly weaknesses: string[];
  readonly requiredSkills: string[];
  readonly missingSkills: string[];
  readonly reasoning: string;
}

export interface AnalyzeVacancyHandlerDeps {
  readonly matchResultRepository: MatchResultRepository;
  readonly cache: AICache;
  readonly costTracker: CostTracker;
  readonly logger: AILogger;
  readonly metrics: AIMetricsCollector;
  readonly tracer: AITracer;
}

const ZERO_USAGE = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

/**
 * Delegates to `analyzeVacancyForSearchProfile` — the same reuse-checked
 * entry point the bulk `/intelligence/search` matching path
 * (`AiMatchingService`) and the post-import worker pass already use — instead
 * of building the identical `VacancyAnalysisPromptBuilder` prompt and calling
 * `provider.complete()` a second, independent time. Before this, clicking
 * "Analyze" on an application for a vacancy that had already been scored by
 * bulk matching triggered a brand-new LLM call every time, because this
 * handler never checked `MatchResultRepository` — `analyzeVacancyForSearchProfile`'s
 * own doc comment exists specifically to prevent that ("not two parallel
 * implementations"). A reused result costs zero tokens (see ZERO_USAGE
 * below), which is also what AIOrchestrator's job/usage records now show for
 * it — accurate, not a workaround.
 */
export class AnalyzeVacancyHandler implements JobHandler<AnalyzeVacancyInput, AnalyzeVacancyResult> {
  readonly feature = 'analyze_vacancy' as const;
  private readonly promptBuilder = new VacancyAnalysisPromptBuilder();

  constructor(private readonly deps: AnalyzeVacancyHandlerDeps) {}

  async execute(input: AnalyzeVacancyInput, provider: AIProvider): Promise<JobHandlerResult<AnalyzeVacancyResult>> {
    // MatchingEngine binds its provider at construction, but AIOrchestrator
    // resolves a provider per call (ProviderRouter, possibly per-user/-feature
    // routing) — so this engine is built fresh per call, reusing this
    // handler's own cache/costTracker/logger instances across calls the same
    // way apps/backend's container wires MatchingEngine for the bulk path.
    const matchingEngine = new MatchingEngine({
      provider,
      promptBuilder: this.promptBuilder,
      cache: this.deps.cache,
      costTracker: this.deps.costTracker,
      logger: this.deps.logger,
      metrics: this.deps.metrics,
      tracer: this.deps.tracer,
    });

    const outcome = await analyzeVacancyForSearchProfile(
      { matchingEngine, matchResultRepository: this.deps.matchResultRepository, logger: this.deps.logger },
      {
        vacancyId: input.vacancyId,
        vacancyUpdatedAt: input.vacancyUpdatedAt,
        vacancyTitle: input.vacancyTitle,
        vacancyDescription: input.vacancyDescription,
        companyName: input.companyName,
        technologies: input.technologies,
        experienceLevel: input.experienceLevel,
        salaryRange: input.salaryRange,
        location: input.location,
      },
      {
        searchProfileId: input.searchProfileId,
        searchProfileUpdatedAt: input.searchProfileUpdatedAt,
        userId: input.userId,
        desiredPositions: input.desiredPositions,
        desiredTechnologies: input.desiredTechnologies,
        desiredExperienceLevel: input.desiredExperienceLevel,
        isRemoteOnly: input.isRemoteOnly,
        desiredLocations: input.desiredLocations,
      },
      input.resume
        ? {
            resumeId: input.resume.resumeId,
            resumeUpdatedAt: input.resume.resumeUpdatedAt,
            summary: input.resume.summary,
            skills: input.resume.skills,
            technologies: input.resume.technologies,
            yearsOfExperience: input.resume.yearsOfExperience,
            rawText: input.resume.rawText,
          }
        : undefined
    );

    const { matchResult, reused } = outcome;

    return {
      result: {
        overallScore: matchResult.overallScore,
        confidence: matchResult.confidence,
        recommendation: matchResult.recommendation,
        summary: matchResult.summary,
        strengths: [...matchResult.strengths],
        weaknesses: [...matchResult.weaknesses],
        requiredSkills: [...matchResult.requiredSkills],
        missingSkills: [...matchResult.missingSkills],
        reasoning: matchResult.reasoning,
      },
      usage: reused ? ZERO_USAGE : matchResult.tokenUsage,
    };
  }
}
