import { describe, it, expect, beforeEach } from 'vitest';
import {
  Vacancy,
  SearchProfile,
  Company,
  Resume,
  Location,
  ExperienceLevel,
  Technology,
  createVacancyId,
  createCompanyId,
  createSearchProfileId,
  createUserId,
  createResumeId,
  type VacancyRepository,
  type SearchProfileRepository,
  type ResumeRepository,
  type CompanyRepository,
} from '@careeros/career';
import {
  MatchingEngine,
  VacancyAnalysisPromptBuilder,
  InMemoryAICache,
  InMemoryCostTracker,
  NoopAILogger,
  InMemoryAIMetricsCollector,
  InMemoryAITracer,
  BaseAIProvider,
} from '@careeros/ai';
import type { AIRequest, AIResponse, AICapabilities, AIProviderConfig, MatchResult, MatchResultRepository } from '@careeros/ai';
import { processVacancyAnalysisJob, type VacancyAnalysisProcessorDeps } from '../vacancy-analysis-processor.js';

class InMemoryVacancyRepositoryFake implements Pick<VacancyRepository, 'findById'> {
  constructor(private readonly vacancy: Vacancy | null) {}
  async findById(): Promise<Vacancy | null> {
    return this.vacancy;
  }
}

class InMemorySearchProfileRepositoryFake implements Pick<SearchProfileRepository, 'findById'> {
  constructor(private readonly profile: SearchProfile | null) {}
  async findById(): Promise<SearchProfile | null> {
    return this.profile;
  }
}

class InMemoryResumeRepositoryFake implements Pick<ResumeRepository, 'findDefaultByUserId'> {
  constructor(private readonly resume: Resume | null) {}
  async findDefaultByUserId(): Promise<Resume | null> {
    return this.resume;
  }
}

class InMemoryCompanyRepositoryFake implements Pick<CompanyRepository, 'findById'> {
  constructor(private readonly company: Company | null) {}
  async findById(): Promise<Company | null> {
    return this.company;
  }
}

class InMemoryMatchResultRepositoryFake implements MatchResultRepository {
  private readonly records = new Map<string, MatchResult>();

  async save(matchResult: MatchResult): Promise<void> {
    this.records.set(`${matchResult.searchProfileId}:${matchResult.vacancyId}`, matchResult);
  }
  async findById(id: string): Promise<MatchResult | null> {
    return [...this.records.values()].find((m) => m.id === id) ?? null;
  }
  async findBySearchProfileIdAndVacancyId(searchProfileId: string, vacancyId: string): Promise<MatchResult | null> {
    return this.records.get(`${searchProfileId}:${vacancyId}`) ?? null;
  }
  async findByUserId(userId: string): Promise<readonly MatchResult[]> {
    return [...this.records.values()].filter((m) => m.userId === userId);
  }
  async findBySearchProfileId(searchProfileId: string): Promise<readonly MatchResult[]> {
    return [...this.records.values()].filter((m) => m.searchProfileId === searchProfileId);
  }
  async findByVacancyIds(vacancyIds: readonly string[]): Promise<readonly MatchResult[]> {
    const set = new Set(vacancyIds);
    return [...this.records.values()].filter((m) => set.has(m.vacancyId));
  }
}

class CountingProvider extends BaseAIProvider {
  readonly name = 'mock';
  readonly defaultModel = 'mock-model';
  callCount = 0;

  constructor(config: AIProviderConfig) {
    super(config);
  }

  getCapabilities(): AICapabilities {
    return { supportsStreaming: false, supportsVision: false, maxTokens: 4096, supportedModels: ['mock-model'] };
  }

  protected async doComplete(_request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
    this.callCount += 1;
    return {
      content: JSON.stringify({
        overallScore: 72,
        confidence: 0.6,
        recommendation: 'Apply',
        summary: 'Decent backend role.',
        strengths: ['typescript'],
        weaknesses: [],
        requiredSkills: ['typescript'],
        missingSkills: [],
        seniorityEstimation: 'Middle',
        remotePolicy: 'Remote',
        salaryObservations: null,
        salaryFit: { score: 70, confidence: 0.6, reasoning: '' },
        locationFit: { score: 70, confidence: 0.6, reasoning: '' },
        experienceFit: { score: 70, confidence: 0.6, reasoning: '' },
        careerGrowthFit: { score: 70, confidence: 0.6, reasoning: '' },
        reasoning: 'Good overlap.',
      }),
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: 'mock-model',
      confidence: 0.6,
      requestId: crypto.randomUUID(),
    };
  }
}

const USER_ID = createUserId('11111111-1111-4111-8111-111111111111');

function buildVacancy(): Vacancy {
  return Vacancy.create({
    id: createVacancyId('22222222-2222-4222-8222-222222222222'),
    title: 'Backend Engineer',
    description: 'Looking for a backend engineer.',
    companyId: createCompanyId('33333333-3333-4333-8333-333333333333'),
    location: Location.create({ workMode: 'remote' }),
    experienceLevel: ExperienceLevel.MIDDLE,
    technologies: [Technology.create('typescript', 'language')],
  });
}

function buildProfile(): SearchProfile {
  return SearchProfile.create({
    id: createSearchProfileId('44444444-4444-4444-8444-444444444444'),
    userId: USER_ID,
    name: 'Backend Roles',
    desiredPositions: ['Backend Engineer'],
    desiredTechnologies: [Technology.create('typescript', 'language')],
    experienceLevel: ExperienceLevel.MIDDLE,
  });
}

function buildCompany(): Company {
  return Company.create({ id: createCompanyId('33333333-3333-4333-8333-333333333333'), name: 'Acme Corp' });
}

describe('processVacancyAnalysisJob', () => {
  let provider: CountingProvider;
  let matchResultRepository: InMemoryMatchResultRepositoryFake;
  let deps: { -readonly [K in keyof VacancyAnalysisProcessorDeps]: VacancyAnalysisProcessorDeps[K] };
  let vacancy: Vacancy;
  let profile: SearchProfile;

  beforeEach(() => {
    provider = new CountingProvider({ apiKey: 'test' });
    matchResultRepository = new InMemoryMatchResultRepositoryFake();
    vacancy = buildVacancy();
    profile = buildProfile();

    deps = {
      vacancyRepository: new InMemoryVacancyRepositoryFake(vacancy) as unknown as VacancyAnalysisProcessorDeps['vacancyRepository'],
      searchProfileRepository: new InMemorySearchProfileRepositoryFake(
        profile
      ) as unknown as VacancyAnalysisProcessorDeps['searchProfileRepository'],
      resumeRepository: new InMemoryResumeRepositoryFake(null) as unknown as VacancyAnalysisProcessorDeps['resumeRepository'],
      companyRepository: new InMemoryCompanyRepositoryFake(
        buildCompany()
      ) as unknown as VacancyAnalysisProcessorDeps['companyRepository'],
      matchResultRepository,
      matchingEngine: new MatchingEngine(
        {
          provider,
          promptBuilder: new VacancyAnalysisPromptBuilder(),
          cache: new InMemoryAICache(),
          costTracker: new InMemoryCostTracker(),
          logger: new NoopAILogger(),
          metrics: new InMemoryAIMetricsCollector(),
          tracer: new InMemoryAITracer(),
        },
        { enableCache: false }
      ),
    };
  });

  it('computes and persists a profile-only analysis when no resume exists yet', async () => {
    const result = await processVacancyAnalysisJob(deps, { vacancyId: vacancy.id, searchProfileId: profile.id });

    expect(result.status).toBe('computed');
    expect(provider.callCount).toBe(1);

    const stored = await matchResultRepository.findBySearchProfileIdAndVacancyId(profile.id, vacancy.id);
    expect(stored?.resumeId).toBeUndefined();
    expect(stored?.overallScore).toBe(72);
  });

  it('reuses the cached analysis on a second run without calling the AI provider again', async () => {
    await processVacancyAnalysisJob(deps, { vacancyId: vacancy.id, searchProfileId: profile.id });
    const second = await processVacancyAnalysisJob(deps, { vacancyId: vacancy.id, searchProfileId: profile.id });

    expect(second.status).toBe('reused');
    expect(provider.callCount).toBe(1);
  });

  it('skips cleanly when the vacancy no longer exists', async () => {
    deps.vacancyRepository = new InMemoryVacancyRepositoryFake(
      null
    ) as unknown as VacancyAnalysisProcessorDeps['vacancyRepository'];

    const result = await processVacancyAnalysisJob(deps, { vacancyId: vacancy.id, searchProfileId: profile.id });

    expect(result.status).toBe('skipped');
    expect(provider.callCount).toBe(0);
  });

  it('skips cleanly when the search profile no longer exists', async () => {
    deps.searchProfileRepository = new InMemorySearchProfileRepositoryFake(
      null
    ) as unknown as VacancyAnalysisProcessorDeps['searchProfileRepository'];

    const result = await processVacancyAnalysisJob(deps, { vacancyId: vacancy.id, searchProfileId: profile.id });

    expect(result.status).toBe('skipped');
    expect(provider.callCount).toBe(0);
  });

  it('upgrades a profile-only analysis to a resume-aware one once a resume becomes available', async () => {
    await processVacancyAnalysisJob(deps, { vacancyId: vacancy.id, searchProfileId: profile.id });

    const resume = Resume.create({
      id: createResumeId('55555555-5555-4555-8555-555555555555'),
      userId: USER_ID,
      title: 'Resume',
      summary: 'Backend engineer',
    });
    deps.resumeRepository = new InMemoryResumeRepositoryFake(
      resume
    ) as unknown as VacancyAnalysisProcessorDeps['resumeRepository'];

    const second = await processVacancyAnalysisJob(deps, { vacancyId: vacancy.id, searchProfileId: profile.id });

    expect(second.status).toBe('computed');
    expect(provider.callCount).toBe(2);

    const stored = await matchResultRepository.findBySearchProfileIdAndVacancyId(profile.id, vacancy.id);
    expect(stored?.resumeId).toBe(resume.id);
  });
});
