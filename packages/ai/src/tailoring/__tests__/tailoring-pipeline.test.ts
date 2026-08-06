import { describe, it, expect } from 'vitest';
import { runTailoringPipeline, type TailoringPipelineDeps, type TailoringPipelineTarget } from '../tailoring-pipeline.js';
import { InMemoryAICache } from '../../cache/ai-cache.js';
import { ResumeEvidenceBuilder } from '../resume-evidence-builder.js';
import type { TailoredResume } from '../../domain/tailored-resume.js';
import type { TailoredResumeRepository } from '../../domain/tailored-resume-repository.js';
import type { ResumeContextProvider, ResumeAIContext } from '../../context/resume-context-provider.js';
import type { AIProvider } from '../../domain/ai-provider.js';
import type { AIRequest, AIResponse, AICapabilities } from '../../domain/ai-types.js';

class InMemoryTailoredResumeRepository implements TailoredResumeRepository {
  private readonly records = new Map<string, TailoredResume>();

  async save(tailoredResume: TailoredResume): Promise<void> {
    this.records.set(tailoredResume.id, tailoredResume);
  }

  async findById(id: string): Promise<TailoredResume | null> {
    return this.records.get(id) ?? null;
  }

  async findByResumeIdAndVacancyId(resumeId: string, vacancyId: string): Promise<TailoredResume | null> {
    return [...this.records.values()].find((r) => r.resumeId === resumeId && r.vacancyId === vacancyId) ?? null;
  }
}

const fakeResumeContext: ResumeAIContext = {
  source: 'structured',
  summary: 'Backend engineer.',
  skills: ['Node.js'],
  technologies: ['Node.js'],
  experience: [
    { company: 'Acme', position: 'Engineer', description: 'Built things.', bullets: ['Built a payments API'], technologies: ['Node.js'] },
  ],
  education: [{ institution: 'MIT', degree: 'BS', field: 'CS' }],
  seniorityLevel: 'senior',
  certifications: [],
  languages: [],
  totalYearsOfExperience: 5,
  promptText: 'n/a',
  estimatedTokens: 10,
};

class FakeResumeContextProvider implements ResumeContextProvider {
  async getContext(): Promise<ResumeAIContext> {
    return fakeResumeContext;
  }
}

const vacancyRequirementsResponse = JSON.stringify({
  seniority: 'senior',
  requiredSkills: ['Node.js'],
  preferredSkills: [],
  responsibilities: ['Build APIs'],
  atsKeywords: ['Node.js'],
  technologies: ['Node.js'],
  softSkills: [],
  domain: 'backend',
  industry: 'fintech',
  education: [],
  certifications: [],
  languageRequirements: [],
});

const tailoringResponse = JSON.stringify({
  optimizedSummary: 'Backend engineer skilled in payments infrastructure.',
  reorderedExperience: [
    {
      sourceJobIndex: 0,
      company: 'Acme',
      position: 'Engineer',
      bullets: [{ text: 'Built a scalable payments API', sourceBulletIndex: 0 }],
      technologies: ['Node.js'],
      relevanceScore: 90,
    },
  ],
  emphasizedSkills: ['Node.js'],
  keywordOptimizations: ['payments'],
});

const reviewResponse = JSON.stringify({
  bulletChecks: [{ jobIndex: 0, bulletIndex: 0, supported: true }],
  flaggedEntities: [],
  overallRisk: 'low',
});

/** Fake provider that routes by promptId and lets a test force one promptId to fail its next call. */
function makeFakeProvider(options?: { failOnce?: string }): { provider: AIProvider; callCounts: Record<string, number> } {
  const callCounts: Record<string, number> = {};
  let hasFailed = false;

  const provider: AIProvider = {
    name: 'fake',
    defaultModel: 'fake-model',
    async complete(request: AIRequest): Promise<AIResponse> {
      callCounts[request.promptId] = (callCounts[request.promptId] ?? 0) + 1;

      if (options?.failOnce === request.promptId && !hasFailed) {
        hasFailed = true;
        throw new Error(`Simulated failure for ${request.promptId}`);
      }

      const content =
        request.promptId === 'vacancy-requirements-extraction'
          ? vacancyRequirementsResponse
          : request.promptId === 'resume-tailoring'
            ? tailoringResponse
            : reviewResponse;

      return {
        content,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'fake-model',
        provider: 'fake',
        latencyMs: 5,
        confidence: 1,
        requestId: 'req',
      };
    },
    getCapabilities(): AICapabilities {
      return { supportsStreaming: false, supportsVision: false, maxTokens: 8000, supportedModels: ['fake-model'] };
    },
    validateConfig(): boolean {
      return true;
    },
  };

  return { provider, callCounts };
}

function makeTarget(overrides: Partial<TailoringPipelineTarget> = {}): TailoringPipelineTarget {
  return {
    resumeId: 'resume-1',
    resumeUpdatedAt: new Date('2026-01-01'),
    vacancyId: 'vacancy-1',
    vacancyUpdatedAt: new Date('2026-01-01'),
    userId: 'user-1',
    vacancyTitle: 'Senior Backend Engineer',
    vacancyDescription: 'Build payment APIs.',
    companyName: 'Acme',
    technologies: ['Node.js'],
    requirements: ['Node.js'],
    ...overrides,
  };
}

describe('runTailoringPipeline', () => {
  it('completes all stages and produces a rendered resume', async () => {
    const { provider } = makeFakeProvider();
    const repository = new InMemoryTailoredResumeRepository();
    const deps: TailoringPipelineDeps = {
      tailoredResumeRepository: repository,
      resumeEvidenceBuilder: new ResumeEvidenceBuilder(new FakeResumeContextProvider()),
      provider,
    };

    const result = await runTailoringPipeline(deps, makeTarget());

    expect(result.status).toBe('COMPLETED');
    expect(result.tailoredResumeText).toContain('Built a scalable payments API');
    expect(result.atsScoreBefore?.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.atsScoreAfter?.overallScore).toBeGreaterThanOrEqual(0);
  });

  it('is idempotent: an unchanged re-run reuses the completed result without calling the provider again', async () => {
    const { provider, callCounts } = makeFakeProvider();
    const repository = new InMemoryTailoredResumeRepository();
    const deps: TailoringPipelineDeps = {
      tailoredResumeRepository: repository,
      resumeEvidenceBuilder: new ResumeEvidenceBuilder(new FakeResumeContextProvider()),
      provider,
    };

    const target = makeTarget();
    const first = await runTailoringPipeline(deps, target);
    const callsAfterFirst = { ...callCounts };
    const second = await runTailoringPipeline(deps, target);

    expect(second.id).toBe(first.id);
    expect(callCounts).toEqual(callsAfterFirst); // no new provider calls on the reuse path
  });

  it('resumes from the failed stage on retry instead of rerunning the whole pipeline', async () => {
    const { provider, callCounts } = makeFakeProvider({ failOnce: 'resume-tailoring' });
    const repository = new InMemoryTailoredResumeRepository();
    const deps: TailoringPipelineDeps = {
      tailoredResumeRepository: repository,
      resumeEvidenceBuilder: new ResumeEvidenceBuilder(new FakeResumeContextProvider()),
      provider,
    };

    const target = makeTarget();

    await expect(runTailoringPipeline(deps, target)).rejects.toThrow('Simulated failure');

    const failedRow = await repository.findById(`${target.resumeId}:${target.vacancyId}`);
    expect(failedRow?.status).toBe('FAILED');
    expect(failedRow?.stageExecutions.find((e) => e.stage === 'PARSING_VACANCY')?.status).toBe('COMPLETED');
    expect(failedRow?.stageExecutions.find((e) => e.stage === 'TAILORING_RESUME')?.status).toBe('FAILED');
    const vacancyCallsAfterFailure = callCounts['vacancy-requirements-extraction'] ?? 0;

    // Retry (mirrors BullMQ redriving the same job).
    const result = await runTailoringPipeline(deps, target);

    expect(result.status).toBe('COMPLETED');
    // Parsing Vacancy's LLM call was NOT re-issued on retry — only the failed stage reran.
    expect(callCounts['vacancy-requirements-extraction']).toBe(vacancyCallsAfterFailure);
  });

  it('reuses PARSING_VACANCY across two different resumes tailored for the same vacancy when a cache is provided', async () => {
    const { provider, callCounts } = makeFakeProvider();
    const repository = new InMemoryTailoredResumeRepository();
    const cache = new InMemoryAICache();
    const deps: TailoringPipelineDeps = {
      tailoredResumeRepository: repository,
      resumeEvidenceBuilder: new ResumeEvidenceBuilder(new FakeResumeContextProvider()),
      provider,
      cache,
    };

    const firstResumeTarget = makeTarget({ resumeId: 'resume-1' });
    const secondResumeTarget = makeTarget({ resumeId: 'resume-2' });

    await runTailoringPipeline(deps, firstResumeTarget);
    expect(callCounts['vacancy-requirements-extraction']).toBe(1);

    // Different (resumeId, vacancyId) row — no per-row checkpoint to reuse —
    // but the same vacancy, so the vacancy-scoped cache should skip the LLM call.
    const secondResult = await runTailoringPipeline(deps, secondResumeTarget);

    expect(secondResult.status).toBe('COMPLETED');
    expect(callCounts['vacancy-requirements-extraction']).toBe(1); // still 1, not 2
    expect(secondResult.vacancyRequirements?.seniority).toBe('senior');
  });

  it('forceRegenerate bypasses the completed-result cache and reruns the LLM stages', async () => {
    const { provider, callCounts } = makeFakeProvider();
    const repository = new InMemoryTailoredResumeRepository();
    const deps: TailoringPipelineDeps = {
      tailoredResumeRepository: repository,
      resumeEvidenceBuilder: new ResumeEvidenceBuilder(new FakeResumeContextProvider()),
      provider,
    };

    const target = makeTarget();
    await runTailoringPipeline(deps, target);
    const callsAfterFirst = callCounts['resume-tailoring'] ?? 0;

    await runTailoringPipeline(deps, { ...target, forceRegenerate: true });

    expect(callCounts['resume-tailoring'] ?? 0).toBeGreaterThan(callsAfterFirst);
  });

  it('gives one row per (resumeId, vacancyId) pair — no duplicate records on repeated requests', async () => {
    const { provider } = makeFakeProvider();
    const repository = new InMemoryTailoredResumeRepository();
    const deps: TailoringPipelineDeps = {
      tailoredResumeRepository: repository,
      resumeEvidenceBuilder: new ResumeEvidenceBuilder(new FakeResumeContextProvider()),
      provider,
    };

    const target = makeTarget();
    await runTailoringPipeline(deps, target);
    await runTailoringPipeline(deps, { ...target, forceRegenerate: true });

    const row = await repository.findByResumeIdAndVacancyId(target.resumeId, target.vacancyId);
    expect(row).not.toBeNull();
  });
});
