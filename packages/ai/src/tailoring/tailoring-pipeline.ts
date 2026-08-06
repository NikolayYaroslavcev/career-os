import { createResumeId } from '@careeros/career';
import type { AIProvider } from '../domain/ai-provider.js';
import type { AIRequest, TokenUsage } from '../domain/ai-types.js';
import type { AICache } from '../cache/ai-cache.js';
import { computePromptHash } from '../cache/prompt-hash.js';
import type { AILogger } from '../observability/ai-logger.js';
import { NoopAILogger } from '../observability/ai-logger.js';
import { estimateCost } from '../cost/cost-tracker.js';
import { getModelPricing } from '../cost/pricing.js';
import type { UsageRecorder } from '../cost/usage-recorder.js';
import { ResumeTailoringPromptBuilder } from '../prompts/resume-tailoring.js';
import { VacancyRequirementsPromptBuilder } from '../prompts/vacancy-requirements-extraction.js';
import { computeAtsScore, type AtsResumeEvidence } from '../ats/ats-scoring-engine.js';
import { DEFAULT_ATS_WEIGHTS, ATS_WEIGHTS_VERSION } from '../ats/ats-weights-config.js';
import { computeSkillMatrix } from './skill-matrix-engine.js';
import { ResumeEvidenceBuilder, toAtsResumeEvidence, type TailoringResumeEvidence } from './resume-evidence-builder.js';
import { renderTailoredResume } from './tailored-resume-renderer.js';
import { TailoringReviewer, type TailoringDraft, type TailoringOriginalEvidence } from './tailoring-reviewer.js';
import { computeTailoringInputHash } from './tailoring-hash.js';
import { extractJsonObject, vacancyRequirementsResultSchema, tailoringGenerationResultSchema } from './schemas.js';
import {
  createQueuedTailoredResume,
  type TailoredResume,
  type TailoringStage,
  type TailoringStageExecution,
  type TailoredContent,
} from '../domain/tailored-resume.js';
import type { TailoredResumeRepository } from '../domain/tailored-resume-repository.js';

export const CURRENT_TAILORING_ALGORITHM_VERSION = '1.0.0';

export interface TailoringPipelineTarget {
  readonly resumeId: string;
  readonly resumeUpdatedAt: Date;
  readonly vacancyId: string;
  readonly vacancyUpdatedAt: Date;
  readonly userId: string;
  readonly applicationId?: string;
  readonly vacancyTitle: string;
  readonly vacancyDescription: string;
  readonly companyName: string;
  readonly companyIndustry?: string;
  readonly technologies: readonly string[];
  readonly requirements: readonly string[];
  readonly experienceLevel?: string;
  readonly forceRegenerate?: boolean;
}

export interface TailoringPipelineDeps {
  readonly tailoredResumeRepository: TailoredResumeRepository;
  readonly resumeEvidenceBuilder: ResumeEvidenceBuilder;
  readonly provider: AIProvider;
  readonly logger?: AILogger;
  readonly resumeContextBudgetTokens?: number;
  /**
   * Persists usage to AIUsageRepository for this pipeline's 3 LLM-calling
   * stages (PARSING_VACANCY, TAILORING_RESUME, REVIEWER_VALIDATION), which
   * bypass AIOrchestrator.execute() entirely. Per-stage token counts are
   * already checkpointed onto TailoredResume.stageExecutions for pipeline
   * observability, but that's a different table from the one the AI usage
   * dashboard reads — without this, tailoring spend is invisible there.
   * Optional so existing tests/callers keep working.
   */
  readonly usageRecorder?: UsageRecorder;
  /**
   * PARSING_VACANCY's prompt depends only on the vacancy (title/description/
   * company/technologies/requirements/experienceLevel), never the resume —
   * so without a vacancy-scoped cache here, tailoring N different resumes
   * against the same vacancy calls the LLM N times for an identical result.
   * The per-row `TailoredResume.vacancyRequirements` checkpoint below only
   * dedupes retries of the *same* (resume, vacancy) pair, not this. Optional
   * so existing tests/callers keep working; omitting it just forgoes the
   * cross-row reuse (falls back to the checkpoint-only behavior).
   */
  readonly cache?: AICache;
}

function recordTailoringUsage(
  deps: TailoringPipelineDeps,
  logger: AILogger,
  userId: string,
  provider: string,
  model: string,
  usage: TokenUsage,
  latencyMs: number,
): void {
  try {
    const pending = deps.usageRecorder?.record({
      userId,
      provider,
      model,
      feature: 'tailor_resume',
      tokensIn: usage.promptTokens,
      tokensOut: usage.completionTokens,
      totalTokens: usage.totalTokens,
      estimatedCost: estimateCost(usage, getModelPricing(provider, model)),
      latencyMs,
    });
    if (pending) {
      void Promise.resolve(pending).catch((error) => {
        logger.warn('Failed to record tailor_resume usage', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  } catch (error) {
    logger.warn('Failed to record tailor_resume usage', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function buildTailoredResumeId(resumeId: string, vacancyId: string): string {
  // Deterministic, not randomly generated: matches the DB row's natural key
  // (@@unique([resumeId, vacancyId])) so re-running the pipeline for the same
  // pair always targets the same id instead of relying on a prior DB read.
  return `${resumeId}:${vacancyId}`;
}

function upsertStageExecution(
  row: TailoredResume,
  execution: TailoringStageExecution,
): readonly TailoringStageExecution[] {
  const withoutStage = row.stageExecutions.filter((e) => e.stage !== execution.stage);
  return [...withoutStage, execution];
}

async function withStageTracking<T>(
  row: TailoredResume,
  repository: TailoredResumeRepository,
  stage: TailoringStage,
  fn: () => Promise<{ output: T; usage?: TokenUsage; model?: string; provider?: string }>,
): Promise<{ row: TailoredResume; output: T }> {
  const startedAt = new Date();
  const priorRetryCount = row.stageExecutions.find((e) => e.stage === stage)?.retryCount ?? 0;

  try {
    const { output, usage, model, provider } = await fn();
    const execution: TailoringStageExecution = {
      stage,
      status: 'COMPLETED',
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      model,
      provider,
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
      totalTokens: usage?.totalTokens,
      retryCount: priorRetryCount,
    };
    const nextRow: TailoredResume = {
      ...row,
      currentStage: stage,
      stageExecutions: upsertStageExecution(row, execution),
      updatedAt: new Date(),
    };
    await repository.save(nextRow);
    return { row: nextRow, output };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const execution: TailoringStageExecution = {
      stage,
      status: 'FAILED',
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      retryCount: priorRetryCount + 1,
      error: message,
    };
    const failedRow: TailoredResume = {
      ...row,
      status: 'FAILED',
      currentStage: stage,
      stageExecutions: upsertStageExecution(row, execution),
      error: message,
      retryCount: row.retryCount + 1,
      updatedAt: new Date(),
    };
    await repository.save(failedRow);
    throw error;
  }
}

function isStageCheckpointed(row: TailoredResume, stage: TailoringStage): boolean {
  return row.stageExecutions.some((e) => e.stage === stage && e.status === 'COMPLETED');
}

function educationEntriesOf(evidence: TailoringResumeEvidence): readonly string[] {
  return evidence.education.map((edu) => `${edu.degree} in ${edu.field} — ${edu.institution}`);
}

/**
 * The checkpointed resume-tailoring pipeline (ADR-031). One BullMQ job per
 * (resumeId, vacancyId) pair runs this function; on a retry after a stage
 * failure, the three LLM-calling stages (PARSING_VACANCY, TAILORING_RESUME,
 * REVIEWER_VALIDATION) are skipped if already checkpointed as COMPLETED on
 * the row — only the failed stage (and anything after it) actually
 * re-executes. The other stages (resume parsing, deterministic scoring,
 * rendering) are cheap and idempotent, so they simply re-run every attempt
 * rather than needing their own skip logic.
 */
export async function runTailoringPipeline(
  deps: TailoringPipelineDeps,
  target: TailoringPipelineTarget,
): Promise<TailoredResume> {
  const logger = deps.logger ?? new NoopAILogger();
  const budgetTokens = deps.resumeContextBudgetTokens ?? 3000;
  const inputHash = computeTailoringInputHash(target);
  const id = buildTailoredResumeId(target.resumeId, target.vacancyId);

  let row = await deps.tailoredResumeRepository.findById(id);

  if (row && row.status === 'COMPLETED' && row.inputHash === inputHash && !target.forceRegenerate) {
    logger.info('Tailoring reused (inputs unchanged)', { resumeId: target.resumeId, vacancyId: target.vacancyId });
    return row;
  }

  if (!row) {
    row = createQueuedTailoredResume({
      id,
      userId: target.userId,
      resumeId: target.resumeId,
      vacancyId: target.vacancyId,
      applicationId: target.applicationId,
      inputHash,
    });
  } else if (row.inputHash !== inputHash || target.forceRegenerate) {
    // Inputs changed (or the user asked to regenerate) — reset every
    // checkpoint so all stages actually rerun instead of reusing stale output.
    row = { ...row, stageExecutions: [], status: 'QUEUED', currentStage: 'QUEUED', inputHash, error: undefined };
  }

  row = { ...row, status: 'PROCESSING', startedAt: row.startedAt ?? new Date() };
  await deps.tailoredResumeRepository.save(row);

  // --- Stage 1: Parsing Resume (cheap, idempotent — always re-run) ---
  const parsingResume = await withStageTracking(row, deps.tailoredResumeRepository, 'PARSING_RESUME', async () => {
    const evidence = await deps.resumeEvidenceBuilder.build(createResumeId(target.resumeId), budgetTokens);
    return { output: evidence };
  });
  row = parsingResume.row;
  const resumeEvidence = parsingResume.output;

  // --- Stage 2: Parsing Vacancy (LLM call — checkpointed) ---
  const vacancyPromptBuilder = new VacancyRequirementsPromptBuilder();
  let vacancyRequirements = row.vacancyRequirements;
  if (!isStageCheckpointed(row, 'PARSING_VACANCY') || !vacancyRequirements) {
    const parsingVacancy = await withStageTracking(row, deps.tailoredResumeRepository, 'PARSING_VACANCY', async () => {
      const prompt = vacancyPromptBuilder.build({
        vacancyTitle: target.vacancyTitle,
        vacancyDescription: target.vacancyDescription,
        companyName: target.companyName,
        companyIndustry: target.companyIndustry,
        technologies: target.technologies,
        requirements: target.requirements,
        experienceLevel: target.experienceLevel,
      });
      const request: AIRequest = {
        prompt: prompt.user,
        systemPrompt: prompt.system,
        promptId: prompt.version.id,
        promptVersion: prompt.version.version,
        promptChecksum: prompt.version.checksum,
        model: deps.provider.defaultModel,
        temperature: 0.2,
      };

      // Vacancy-only key (the prompt above has no resume data in it), so this
      // is a hit for every resume tailored against the same vacancy after the
      // first — not per-row like the checkpoint above.
      const cacheKey = computePromptHash(request);
      const cached = await deps.cache?.get(cacheKey);
      const response = cached?.response ?? (await deps.provider.complete(request));

      const parsed = vacancyRequirementsResultSchema.parse(extractJsonObject(response.content));
      if (!cached) {
        await deps.cache?.set(cacheKey, response);
      }
      // Zeroed on a cache hit — accurately reflects that no LLM call happened
      // for this row, both in the usage-dashboard record and the per-stage
      // checkpoint's own token accounting.
      const usage: TokenUsage = cached ? { promptTokens: 0, completionTokens: 0, totalTokens: 0 } : response.usage;
      recordTailoringUsage(deps, logger, target.userId, response.provider, response.model, usage, response.latencyMs);
      return { output: parsed, usage, model: response.model, provider: response.provider };
    });
    row = {
      ...parsingVacancy.row,
      vacancyRequirements: parsingVacancy.output,
      promptVersions: { ...parsingVacancy.row.promptVersions, [vacancyPromptBuilder.promptId]: vacancyPromptBuilder.currentVersion },
    };
    await deps.tailoredResumeRepository.save(row);
    vacancyRequirements = parsingVacancy.output;
  }
  const vacancyReqs = vacancyRequirements!;

  // --- Stage 3: Building Evidence (deterministic — skill matrix + ATS-before) ---
  const buildingEvidence = await withStageTracking(row, deps.tailoredResumeRepository, 'BUILDING_EVIDENCE', async () => {
    const atsVacancy = {
      seniority: vacancyReqs.seniority,
      requiredSkills: vacancyReqs.requiredSkills,
      preferredSkills: vacancyReqs.preferredSkills,
      responsibilities: vacancyReqs.responsibilities,
      atsKeywords: vacancyReqs.atsKeywords,
      technologies: vacancyReqs.technologies,
      domain: vacancyReqs.domain,
      industry: vacancyReqs.industry,
      education: vacancyReqs.education,
      certifications: vacancyReqs.certifications,
      languageRequirements: vacancyReqs.languageRequirements,
    };
    const originalAtsEvidence = toAtsResumeEvidence(resumeEvidence);
    const skillMatrix = computeSkillMatrix(originalAtsEvidence, atsVacancy);
    const atsScoreBefore = computeAtsScore(originalAtsEvidence, atsVacancy, DEFAULT_ATS_WEIGHTS);
    return { output: { skillMatrix, atsScoreBefore, atsVacancy, originalAtsEvidence } };
  });
  row = { ...buildingEvidence.row, skillMatrix: buildingEvidence.output.skillMatrix, atsScoreBefore: buildingEvidence.output.atsScoreBefore, atsWeightsVersion: ATS_WEIGHTS_VERSION };
  await deps.tailoredResumeRepository.save(row);
  const { atsVacancy } = buildingEvidence.output;

  // --- Stage 4: Tailoring Resume (LLM call — checkpointed) ---
  const tailoringPromptBuilder = new ResumeTailoringPromptBuilder();
  let tailoredContent = row.tailoredContent;
  if (!isStageCheckpointed(row, 'TAILORING_RESUME') || !tailoredContent) {
    const tailoring = await withStageTracking(row, deps.tailoredResumeRepository, 'TAILORING_RESUME', async () => {
      const prompt = tailoringPromptBuilder.build({
        vacancyTitle: target.vacancyTitle,
        vacancyDescription: target.vacancyDescription,
        companyName: target.companyName,
        technologies: target.technologies,
        experienceLevel: target.experienceLevel,
        requirements: target.requirements,
        resumeSummary: resumeEvidence.summary,
        resumeExperience: resumeEvidence.experience.map((exp) => ({
          company: exp.company,
          position: exp.position,
          description: exp.description,
          bullets: exp.bullets,
          technologies: exp.technologies,
        })),
        resumeSkills: resumeEvidence.skills,
        resumeTechnologies: resumeEvidence.technologies,
        resumeEducation: resumeEvidence.education,
      });
      const request: AIRequest = {
        prompt: prompt.user,
        systemPrompt: prompt.system,
        promptId: prompt.version.id,
        promptVersion: prompt.version.version,
        promptChecksum: prompt.version.checksum,
        model: deps.provider.defaultModel,
        temperature: 0.5,
      };
      const response = await deps.provider.complete(request);
      const parsed = tailoringGenerationResultSchema.parse(extractJsonObject(response.content));
      const content: TailoredContent = {
        summary: parsed.optimizedSummary,
        experience: parsed.reorderedExperience.map((exp) => ({
          jobIndex: exp.sourceJobIndex,
          company: exp.company,
          position: exp.position,
          bullets: exp.bullets.map((b) => ({ text: b.text, sourceBulletIndex: b.sourceBulletIndex })),
          technologies: exp.technologies,
          relevanceScore: exp.relevanceScore,
        })),
        emphasizedSkills: parsed.emphasizedSkills,
        keywordOptimizations: parsed.keywordOptimizations,
      };
      recordTailoringUsage(deps, logger, target.userId, response.provider, response.model, response.usage, response.latencyMs);
      return { output: content, usage: response.usage, model: response.model, provider: response.provider };
    });
    row = {
      ...tailoring.row,
      tailoredContent: tailoring.output,
      promptVersions: { ...tailoring.row.promptVersions, [tailoringPromptBuilder.promptId]: tailoringPromptBuilder.currentVersion },
    };
    await deps.tailoredResumeRepository.save(row);
    tailoredContent = tailoring.output;
  }
  const content = tailoredContent!;

  // --- Stage 5: ATS Scoring (deterministic — scores the unreviewed draft; see class doc) ---
  const atsScoring = await withStageTracking(row, deps.tailoredResumeRepository, 'ATS_SCORING', async () => {
    const tailoredAtsEvidence: AtsResumeEvidence = {
      summary: content.summary,
      skills: content.emphasizedSkills.length > 0 ? content.emphasizedSkills : resumeEvidence.skills,
      technologies: [...new Set(content.experience.flatMap((e) => e.technologies))],
      seniorityLevel: resumeEvidence.seniorityLevel,
      totalYearsOfExperience: resumeEvidence.totalYearsOfExperience,
      educationEntries: educationEntriesOf(resumeEvidence),
      certifications: resumeEvidence.certifications,
      languages: resumeEvidence.languages,
      experienceBullets: content.experience.flatMap((e) => e.bullets.map((b) => b.text)),
      experienceJobCount: content.experience.length,
    };
    const atsScoreAfter = computeAtsScore(tailoredAtsEvidence, atsVacancy, DEFAULT_ATS_WEIGHTS);
    return { output: atsScoreAfter };
  });
  row = { ...atsScoring.row, atsScoreAfter: atsScoring.output };
  await deps.tailoredResumeRepository.save(row);

  // --- Stage 6: Reviewer Validation (LLM call — checkpointed) ---
  let reviewedContent = content;
  if (!isStageCheckpointed(row, 'REVIEWER_VALIDATION')) {
    const reviewer = new TailoringReviewer(deps.provider);
    const draft: TailoringDraft = {
      optimizedSummary: content.summary,
      experience: content.experience.map((exp) => ({
        jobIndex: exp.jobIndex,
        company: exp.company,
        position: exp.position,
        technologies: exp.technologies,
        relevanceScore: exp.relevanceScore,
        bullets: exp.bullets.map((b, bulletIndex) => ({ bulletIndex, text: b.text, sourceBulletIndex: b.sourceBulletIndex })),
      })),
      emphasizedSkills: content.emphasizedSkills,
      keywordOptimizations: content.keywordOptimizations,
    };
    const originalEvidence: TailoringOriginalEvidence = {
      summary: resumeEvidence.summary,
      experience: resumeEvidence.experience.map((exp) => ({
        jobIndex: exp.jobIndex,
        company: exp.company,
        position: exp.position,
        bullets: exp.bullets,
      })),
      skills: resumeEvidence.skills,
      technologies: resumeEvidence.technologies,
      education: educationEntriesOf(resumeEvidence),
      certifications: resumeEvidence.certifications,
    };

    const reviewStage = await withStageTracking(row, deps.tailoredResumeRepository, 'REVIEWER_VALIDATION', async () => {
      const outcome = await reviewer.review(draft, originalEvidence);
      recordTailoringUsage(deps, logger, target.userId, deps.provider.name, deps.provider.defaultModel, outcome.usage, outcome.latencyMs);
      return {
        output: outcome,
        usage: outcome.usage,
        model: deps.provider.defaultModel,
        provider: deps.provider.name,
      };
    });

    const outcome = reviewStage.output;
    reviewedContent = {
      ...content,
      experience: outcome.correctedExperience.map((exp) => ({
        jobIndex: exp.jobIndex,
        company: exp.company,
        position: exp.position,
        bullets: exp.bullets.map((b) => ({ text: b.text, sourceBulletIndex: b.sourceBulletIndex })),
        technologies: exp.technologies,
        relevanceScore: exp.relevanceScore,
      })),
    };
    row = {
      ...reviewStage.row,
      tailoredContent: reviewedContent,
      changesApplied: outcome.changesApplied,
      changesRejected: outcome.changesRejected,
      hallucinationCheck: outcome.hallucinationCheck,
      confidence: outcome.confidence,
      promptVersions: { ...reviewStage.row.promptVersions, 'resume-tailoring-review': '1.0.0' },
    };
    await deps.tailoredResumeRepository.save(row);
  }

  // --- Stage 7: Saving Results (deterministic render) ---
  const saving = await withStageTracking(row, deps.tailoredResumeRepository, 'SAVING_RESULTS', async () => {
    const text = renderTailoredResume({
      summary: reviewedContent.summary,
      experience: reviewedContent.experience.map((exp) => ({
        company: exp.company,
        position: exp.position,
        bullets: exp.bullets.map((b) => b.text),
        technologies: exp.technologies,
      })),
      skills: reviewedContent.emphasizedSkills.length > 0 ? reviewedContent.emphasizedSkills : resumeEvidence.skills,
      education: resumeEvidence.education,
    });
    return { output: text };
  });

  row = {
    ...saving.row,
    tailoredResumeText: saving.output,
    tailoringAlgorithmVersion: CURRENT_TAILORING_ALGORITHM_VERSION,
    status: 'COMPLETED',
    currentStage: 'COMPLETED',
    completedAt: new Date(),
  };
  await deps.tailoredResumeRepository.save(row);

  logger.info('Tailoring pipeline completed', { resumeId: target.resumeId, vacancyId: target.vacancyId, id: row.id });

  return row;
}
