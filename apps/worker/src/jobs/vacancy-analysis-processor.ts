import type { Job } from 'bullmq';
import type { VacancyAnalysisJob } from '@careeros/shared';
import {
  createVacancyId,
  createSearchProfileId,
  type VacancyRepository,
  type SearchProfileRepository,
  type ResumeRepository,
  type CompanyRepository,
} from '@careeros/career';
import {
  analyzeVacancyForSearchProfile,
  NoopAILogger,
  type AILogger,
  type MatchingEngine,
  type MatchResultRepository,
} from '@careeros/ai';

export interface VacancyAnalysisProcessorDeps {
  readonly vacancyRepository: VacancyRepository;
  readonly searchProfileRepository: SearchProfileRepository;
  readonly resumeRepository: ResumeRepository;
  readonly companyRepository: CompanyRepository;
  readonly matchResultRepository: MatchResultRepository;
  readonly matchingEngine: MatchingEngine;
  readonly logger?: AILogger;
}

export interface VacancyAnalysisJobResult {
  readonly status: 'computed' | 'reused' | 'skipped';
}

/**
 * Processes one (vacancy, searchProfile) AI Analysis job: loads the vacancy,
 * the search profile, and — if one exists yet — the profile owner's default
 * resume, then delegates to the same analyzeVacancyForSearchProfile used by
 * the on-demand /intelligence/search path. Skips cleanly (no-op) if either
 * the vacancy or the search profile was deleted before the job ran.
 */
export async function processVacancyAnalysisJob(
  deps: VacancyAnalysisProcessorDeps,
  data: VacancyAnalysisJob
): Promise<VacancyAnalysisJobResult> {
  const logger = deps.logger ?? new NoopAILogger();

  const [vacancy, profile] = await Promise.all([
    deps.vacancyRepository.findById(createVacancyId(data.vacancyId)),
    deps.searchProfileRepository.findById(createSearchProfileId(data.searchProfileId)),
  ]);

  if (!vacancy || !profile) {
    logger.info('Worker job skipped: vacancy or search profile no longer exists', {
      vacancyId: data.vacancyId,
      searchProfileId: data.searchProfileId,
    });
    return { status: 'skipped' };
  }

  const [resume, company] = await Promise.all([
    deps.resumeRepository.findDefaultByUserId(profile.userId),
    deps.companyRepository.findById(vacancy.companyId),
  ]);

  logger.info('AI started', { vacancyId: vacancy.id, searchProfileId: profile.id });

  const outcome = await analyzeVacancyForSearchProfile(
    {
      matchingEngine: deps.matchingEngine,
      matchResultRepository: deps.matchResultRepository,
      logger,
    },
    {
      vacancyId: vacancy.id,
      vacancyUpdatedAt: vacancy.updatedAt,
      vacancyTitle: vacancy.title,
      vacancyDescription: vacancy.description,
      companyName: company?.name ?? 'Unknown Company',
      technologies: vacancy.technologies.map((t) => t.name),
      experienceLevel: vacancy.experienceLevel,
      salaryRange: vacancy.salary?.toString(),
      location: vacancy.location.toString(),
    },
    {
      searchProfileId: profile.id,
      searchProfileUpdatedAt: profile.updatedAt,
      userId: profile.userId,
      desiredPositions: profile.desiredPositions,
      desiredTechnologies: profile.desiredTechnologies.map((t) => t.name),
      desiredExperienceLevel: profile.experienceLevel,
      isRemoteOnly: profile.isRemoteOnly,
      desiredLocations: profile.desiredLocations.map((location) => location.toString()),
    },
    resume
      ? {
          resumeId: resume.id,
          resumeUpdatedAt: resume.updatedAt,
          summary: resume.summary,
          skills: resume.skills.map((s) => s.name),
          technologies: resume.technologies.map((t) => t.name),
          yearsOfExperience: resume.totalYearsOfExperience,
          rawText: resume.rawText,
        }
      : undefined
  );

  return { status: outcome.reused ? 'reused' : 'computed' };
}

export function createVacancyAnalysisJobHandler(deps: VacancyAnalysisProcessorDeps) {
  return async (job: Job<VacancyAnalysisJob>): Promise<VacancyAnalysisJobResult> => processVacancyAnalysisJob(deps, job.data);
}
