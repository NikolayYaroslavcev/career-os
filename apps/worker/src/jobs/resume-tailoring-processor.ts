import type { Job } from 'bullmq';
import type { ResumeTailoringJob } from '@careeros/shared';
import type { VacancyRepository, ResumeRepository, CompanyRepository } from '@careeros/career';
import { createVacancyId, createResumeId } from '@careeros/career';
import { runTailoringPipeline, type TailoringPipelineDeps, type TailoredResume } from '@careeros/ai';

export interface ResumeTailoringProcessorDeps {
  readonly vacancyRepository: VacancyRepository;
  readonly resumeRepository: ResumeRepository;
  readonly companyRepository: CompanyRepository;
  readonly pipelineDeps: TailoringPipelineDeps;
}

export interface ResumeTailoringJobResult {
  readonly status: 'completed' | 'skipped';
  readonly tailoredResumeId?: string;
}

/**
 * BullMQ job handler for the resume-tailoring pipeline (ADR-031) — mirrors
 * apps/worker/src/jobs/vacancy-analysis-processor.ts. Resolves the vacancy/
 * resume/company entities the pipeline needs, then delegates entirely to
 * runTailoringPipeline (packages/ai), which owns all reuse/checkpoint logic.
 */
export async function processResumeTailoringJob(
  deps: ResumeTailoringProcessorDeps,
  data: ResumeTailoringJob,
): Promise<ResumeTailoringJobResult> {
  const [vacancy, resume] = await Promise.all([
    deps.vacancyRepository.findById(createVacancyId(data.vacancyId)),
    deps.resumeRepository.findById(createResumeId(data.resumeId)),
  ]);

  if (!vacancy || !resume) {
    return { status: 'skipped' };
  }

  const company = await deps.companyRepository.findById(vacancy.companyId);

  const result: TailoredResume = await runTailoringPipeline(deps.pipelineDeps, {
    resumeId: data.resumeId,
    resumeUpdatedAt: resume.updatedAt,
    vacancyId: data.vacancyId,
    vacancyUpdatedAt: vacancy.updatedAt,
    userId: data.userId,
    applicationId: data.applicationId,
    vacancyTitle: vacancy.title,
    vacancyDescription: vacancy.description,
    companyName: company?.name ?? 'Unknown',
    companyIndustry: company?.industry,
    technologies: vacancy.technologies.map((t) => t.name),
    requirements: vacancy.requirements,
    experienceLevel: vacancy.experienceLevel,
    forceRegenerate: data.forceRegenerate,
  });

  return { status: 'completed', tailoredResumeId: result.id };
}

export function createResumeTailoringJobHandler(
  deps: ResumeTailoringProcessorDeps,
): (job: Job<ResumeTailoringJob>) => Promise<ResumeTailoringJobResult> {
  return (job: Job<ResumeTailoringJob>) => processResumeTailoringJob(deps, job.data);
}
