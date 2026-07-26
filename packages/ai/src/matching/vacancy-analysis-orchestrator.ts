import type { MatchingEngine } from './matching-engine.js';
import type { MatchResult } from '../domain/match-result.js';
import type { MatchResultRepository } from '../domain/match-result-repository.js';
import type { AILogger } from '../observability/ai-logger.js';
import { NoopAILogger } from '../observability/ai-logger.js';
import { computeVacancyAnalysisInputHash } from './vacancy-analysis-hash.js';

export interface VacancyAnalysisTarget {
  readonly vacancyId: string;
  readonly vacancyUpdatedAt: Date;
  readonly vacancyTitle: string;
  readonly vacancyDescription: string;
  readonly companyName: string;
  readonly technologies: readonly string[];
  readonly experienceLevel?: string;
  readonly salaryRange?: string;
  readonly location?: string;
}

export interface VacancyAnalysisProfile {
  readonly searchProfileId: string;
  readonly searchProfileUpdatedAt: Date;
  readonly userId: string;
  readonly desiredPositions?: readonly string[];
  readonly desiredTechnologies?: readonly string[];
  readonly desiredExperienceLevel?: string;
  readonly isRemoteOnly?: boolean;
  readonly desiredLocations?: readonly string[];
}

export interface VacancyAnalysisResume {
  readonly resumeId: string;
  readonly resumeUpdatedAt: Date;
  readonly summary: string;
  readonly skills: readonly string[];
  readonly technologies: readonly string[];
  readonly yearsOfExperience: number;
  readonly rawText?: string;
}

export interface VacancyAnalysisDeps {
  readonly matchingEngine: MatchingEngine;
  readonly matchResultRepository: MatchResultRepository;
  readonly logger?: AILogger;
}

export interface VacancyAnalysisOutcome {
  readonly matchResult: MatchResult;
  /** True when a fresh cached result was returned without calling the AI provider. */
  readonly reused: boolean;
}

/**
 * The single entry point for turning a (vacancy, searchProfile[, resume]) triple
 * into a stored MatchResult. Both the on-demand /intelligence/search path
 * (apps/backend AiMatchingService) and the async post-import worker call this
 * same function, so there is exactly one reuse/staleness policy and one place
 * that talks to the AI provider — not two parallel implementations.
 */
export async function analyzeVacancyForSearchProfile(
  deps: VacancyAnalysisDeps,
  target: VacancyAnalysisTarget,
  profile: VacancyAnalysisProfile,
  resume?: VacancyAnalysisResume
): Promise<VacancyAnalysisOutcome> {
  const logger = deps.logger ?? new NoopAILogger();

  const inputHash = computeVacancyAnalysisInputHash({
    vacancyId: target.vacancyId,
    vacancyUpdatedAt: target.vacancyUpdatedAt,
    searchProfileId: profile.searchProfileId,
    searchProfileUpdatedAt: profile.searchProfileUpdatedAt,
    resumeId: resume?.resumeId,
    resumeUpdatedAt: resume?.resumeUpdatedAt,
  });

  const existing = await deps.matchResultRepository.findBySearchProfileIdAndVacancyId(
    profile.searchProfileId,
    target.vacancyId
  );

  if (existing && existing.inputHash === inputHash) {
    logger.info('Vacancy analysis reused (inputs unchanged)', {
      vacancyId: target.vacancyId,
      searchProfileId: profile.searchProfileId,
    });
    return { matchResult: existing, reused: true };
  }

  const matchResult = await deps.matchingEngine.match({
    searchProfileId: profile.searchProfileId,
    // Reuse the existing row's id (if any) so re-analysis updates the same
    // MatchResult in place rather than minting a new id that would orphan any
    // Application.matchResultId already pointing at it.
    existingId: existing?.id,
    resumeId: resume?.resumeId,
    vacancyId: target.vacancyId,
    userId: profile.userId,
    inputHash,
    vacancyTitle: target.vacancyTitle,
    vacancyDescription: target.vacancyDescription,
    companyName: target.companyName,
    technologies: target.technologies,
    experienceLevel: target.experienceLevel,
    salaryRange: target.salaryRange,
    location: target.location,
    desiredPositions: profile.desiredPositions,
    desiredTechnologies: profile.desiredTechnologies,
    desiredExperienceLevel: profile.desiredExperienceLevel,
    isRemoteOnly: profile.isRemoteOnly,
    desiredLocations: profile.desiredLocations,
    resumeSummary: resume?.summary,
    resumeSkills: resume?.skills,
    resumeTechnologies: resume?.technologies,
    yearsOfExperience: resume?.yearsOfExperience,
    resumeRawText: resume?.rawText,
  });

  await deps.matchResultRepository.save(matchResult);

  logger.info('Vacancy analysis computed', {
    vacancyId: target.vacancyId,
    searchProfileId: profile.searchProfileId,
    overallScore: matchResult.overallScore,
  });

  return { matchResult, reused: false };
}
