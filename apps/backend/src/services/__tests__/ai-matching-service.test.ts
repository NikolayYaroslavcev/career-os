import { describe, it, expect } from 'vitest';
import {
  Vacancy,
  Location,
  ExperienceLevel,
  Technology,
  createVacancyId,
  createCompanyId,
} from '@careeros/career';
import type { AIRequest, AIResponse } from '@careeros/ai';
import {
  MatchingEngine,
  VacancyAnalysisPromptBuilder,
  InMemoryAICache,
  InMemoryCostTracker,
  NoopAILogger,
  InMemoryAIMetricsCollector,
  InMemoryAITracer,
  AIErrorType,
} from '@careeros/ai';
import type { BudgetEnforcer, BudgetCheckResult } from '@careeros/ai-orchestrator';
import { AiMatchingService } from '../ai-matching-service.js';
import { MockAIProvider } from '../../testing/mock-ai-provider.js';
import { InMemoryCompanyRepository, InMemoryMatchResultRepository } from '../../testing/in-memory-repositories.js';
import { buildFixtureResume, FIXTURE_USER_ID } from '../../testing/fixtures.js';

const FIXTURE_SEARCH_PROFILE_ID = 'search-profile-1';
const FIXTURE_SEARCH_PROFILE_UPDATED_AT = new Date('2026-01-01T00:00:00.000Z');

function buildVacancy(id: string, title: string, technologies: string[]): Vacancy {
  return Vacancy.create({
    id: createVacancyId(id),
    title,
    description: `Looking for an engineer to work on ${title}.`,
    companyId: createCompanyId(`company-${id}`),
    location: Location.create({ workMode: 'remote' }),
    experienceLevel: ExperienceLevel.SENIOR,
    technologies: technologies.map((name) => Technology.create(name, 'other')),
  });
}

function buildRelevantVacancies(count: number): Vacancy[] {
  return Array.from({ length: count }, (_, i) => buildVacancy(`relevant-${i}`, `Backend Engineer ${i}`, ['typescript', 'node.js', 'postgresql']));
}

function buildIrrelevantVacancies(count: number): Vacancy[] {
  return Array.from({ length: count }, (_, i) => buildVacancy(`irrelevant-${i}`, `iOS Developer ${i}`, ['swift', 'objective-c']));
}

class CountingAIProvider extends MockAIProvider {
  callCount = 0;

  protected async doComplete(request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
    this.callCount += 1;
    return super.doComplete(request);
  }
}

function buildService(options: { maxAiCandidates?: number; provider?: CountingAIProvider; budgetEnforcer?: BudgetEnforcer } = {}): {
  service: AiMatchingService;
  provider: CountingAIProvider;
  matchResultRepository: InMemoryMatchResultRepository;
} {
  const provider = options.provider ?? new CountingAIProvider();
  const matchResultRepository = new InMemoryMatchResultRepository();
  const companyRepository = new InMemoryCompanyRepository();
  const aiMetrics = new InMemoryAIMetricsCollector();

  // Cache disabled: these tests exercise AiMatchingService's own
  // (searchProfileId, vacancyId, inputHash) reuse logic specifically, and an
  // extra prompt-text-keyed cache underneath it would make provider.callCount
  // assertions depend on rendered-prompt equality instead of that logic.
  const matchingEngine = new MatchingEngine(
    {
      provider,
      promptBuilder: new VacancyAnalysisPromptBuilder(),
      cache: new InMemoryAICache(),
      costTracker: new InMemoryCostTracker(),
      logger: new NoopAILogger(),
      metrics: aiMetrics,
      tracer: new InMemoryAITracer(),
    },
    { enableCache: false }
  );

  const service = new AiMatchingService(
    matchingEngine,
    matchResultRepository,
    companyRepository,
    aiMetrics,
    5,
    options.maxAiCandidates ?? 15,
    new NoopAILogger(),
    undefined,
    options.budgetEnforcer
  );

  return { service, provider, matchResultRepository };
}

describe('AiMatchingService pre-filter', () => {
  it('caps the number of AI calls at maxAiCandidates even when many vacancies are supplied', async () => {
    const { service, provider } = buildService({ maxAiCandidates: 10 });
    const resume = buildFixtureResume();
    const vacancies = [...buildRelevantVacancies(20), ...buildIrrelevantVacancies(20)];

    const outcome = await service.matchAll({ resume, vacancies, userId: FIXTURE_USER_ID, searchProfileId: FIXTURE_SEARCH_PROFILE_ID, searchProfileUpdatedAt: FIXTURE_SEARCH_PROFILE_UPDATED_AT });

    expect(provider.callCount).toBe(10);
    expect(outcome.stats.computed).toBe(10);
    expect(outcome.stats.skipped).toBe(30);
    expect(outcome.matchResults).toHaveLength(10);
  });

  it('prioritizes vacancies whose technologies overlap the resume over unrelated ones', async () => {
    const { service } = buildService({ maxAiCandidates: 5 });
    const resume = buildFixtureResume();
    const relevant = buildRelevantVacancies(5);
    const irrelevant = buildIrrelevantVacancies(15);

    const outcome = await service.matchAll({ resume, vacancies: [...irrelevant, ...relevant], userId: FIXTURE_USER_ID, searchProfileId: FIXTURE_SEARCH_PROFILE_ID, searchProfileUpdatedAt: FIXTURE_SEARCH_PROFILE_UPDATED_AT });

    const matchedVacancyIds = outcome.matchResults.map((m) => m.vacancyId).sort();
    expect(matchedVacancyIds).toEqual(relevant.map((v) => v.id).sort());
  });

  it('does not send vacancies to AI when everything already fits under the limit', async () => {
    const { service, provider } = buildService({ maxAiCandidates: 15 });
    const resume = buildFixtureResume();
    const vacancies = buildRelevantVacancies(5);

    const outcome = await service.matchAll({ resume, vacancies, userId: FIXTURE_USER_ID, searchProfileId: FIXTURE_SEARCH_PROFILE_ID, searchProfileUpdatedAt: FIXTURE_SEARCH_PROFILE_UPDATED_AT });

    expect(provider.callCount).toBe(5);
    expect(outcome.stats.skipped).toBe(0);
    expect(outcome.matchResults).toHaveLength(5);
  });

  it('never re-runs AI for vacancies with an existing cached match, and never spends leftover budget on vacancies below the relevance floor', async () => {
    const { service, provider, matchResultRepository } = buildService({ maxAiCandidates: 5 });
    const resume = buildFixtureResume();
    const relevant = buildRelevantVacancies(5);
    const irrelevant = buildIrrelevantVacancies(15);
    const allVacancies = [...relevant, ...irrelevant];

    // First run: computes matches for the 5 most relevant vacancies (the irrelevant ones are skipped).
    const first = await service.matchAll({ resume, vacancies: allVacancies, userId: FIXTURE_USER_ID, searchProfileId: FIXTURE_SEARCH_PROFILE_ID, searchProfileUpdatedAt: FIXTURE_SEARCH_PROFILE_UPDATED_AT });
    expect(first.stats.computed).toBe(5);
    expect(first.stats.skipped).toBe(15);
    const firstRunVacancyIds = new Set(first.matchResults.map((m) => m.vacancyId));
    expect(firstRunVacancyIds).toEqual(new Set(relevant.map((v) => v.id)));

    // Second run: the 5 relevant vacancies are now cached and reused for free (no new AI
    // call for any of them). The 15 not-yet-matched vacancies are all zero-overlap
    // "iOS Developer" postings against a backend/TypeScript resume, so they score 0 —
    // below AI_MIN_TRIAGE_SCORE (default 2) — and are rejected as low_relevance rather
    // than spending the leftover AI budget on them just because a slot is free.
    const callsBeforeSecondRun = provider.callCount;
    const second = await service.matchAll({ resume, vacancies: allVacancies, userId: FIXTURE_USER_ID, searchProfileId: FIXTURE_SEARCH_PROFILE_ID, searchProfileUpdatedAt: FIXTURE_SEARCH_PROFILE_UPDATED_AT });

    expect(second.stats.reused).toBe(5);
    expect(second.stats.computed).toBe(0);
    expect(second.stats.skipped).toBe(15);
    expect(provider.callCount).toBe(callsBeforeSecondRun);

    const reusedIds = second.matchResults.filter((m) => firstRunVacancyIds.has(m.vacancyId)).map((m) => m.vacancyId);
    expect(new Set(reusedIds)).toEqual(firstRunVacancyIds);
    const newlyComputedIds = second.matchResults.filter((m) => !firstRunVacancyIds.has(m.vacancyId));
    expect(newlyComputedIds).toHaveLength(0);

    expect((await matchResultRepository.findByUserId(FIXTURE_USER_ID)).length).toBe(5);
  });
});

describe('AiMatchingService budget enforcement', () => {
  function blockedBudgetEnforcer(): BudgetEnforcer {
    return {
      checkBudget: async (): Promise<BudgetCheckResult> => ({ allowed: false, reason: 'daily token limit reached' }),
    } as unknown as BudgetEnforcer;
  }

  it('skips every AI call for the batch when the budget check denies it, instead of spending on some and not others', async () => {
    const { service, provider } = buildService({ maxAiCandidates: 10, budgetEnforcer: blockedBudgetEnforcer() });
    const resume = buildFixtureResume();
    const vacancies = buildRelevantVacancies(5);

    const outcome = await service.matchAll({ resume, vacancies, userId: FIXTURE_USER_ID, searchProfileId: FIXTURE_SEARCH_PROFILE_ID, searchProfileUpdatedAt: FIXTURE_SEARCH_PROFILE_UPDATED_AT });

    expect(provider.callCount).toBe(0);
    expect(outcome.stats.computed).toBe(0);
    expect(outcome.stats.skipped).toBe(5);
    expect(outcome.matchResults).toHaveLength(0);
    expect(outcome.aiError).toBe(AIErrorType.QUOTA_EXCEEDED);
  });

  it('still serves already-cached matches for free when the budget is exhausted', async () => {
    const provider = new CountingAIProvider();
    const matchResultRepository = new InMemoryMatchResultRepository();
    const companyRepository = new InMemoryCompanyRepository();
    const aiMetrics = new InMemoryAIMetricsCollector();
    const matchingEngine = new MatchingEngine(
      {
        provider,
        promptBuilder: new VacancyAnalysisPromptBuilder(),
        cache: new InMemoryAICache(),
        costTracker: new InMemoryCostTracker(),
        logger: new NoopAILogger(),
        metrics: aiMetrics,
        tracer: new InMemoryAITracer(),
      },
      { enableCache: false }
    );
    const resume = buildFixtureResume();
    const vacancy = buildVacancy('v1', 'Backend Engineer', ['typescript', 'node.js']);

    // First run: no budget enforcer, computes and caches the match.
    const unblockedService = new AiMatchingService(matchingEngine, matchResultRepository, companyRepository, aiMetrics, 5, 15);
    const first = await unblockedService.matchAll({ resume, vacancies: [vacancy], userId: FIXTURE_USER_ID, searchProfileId: FIXTURE_SEARCH_PROFILE_ID, searchProfileUpdatedAt: FIXTURE_SEARCH_PROFILE_UPDATED_AT });
    expect(first.stats.computed).toBe(1);

    // Second run: budget now exhausted, but the same input hash is still cached.
    const blockedService = new AiMatchingService(matchingEngine, matchResultRepository, companyRepository, aiMetrics, 5, 15, new NoopAILogger(), undefined, blockedBudgetEnforcer());
    const second = await blockedService.matchAll({ resume, vacancies: [vacancy], userId: FIXTURE_USER_ID, searchProfileId: FIXTURE_SEARCH_PROFILE_ID, searchProfileUpdatedAt: FIXTURE_SEARCH_PROFILE_UPDATED_AT });

    expect(second.stats.reused).toBe(1);
    expect(second.stats.computed).toBe(0);
    expect(provider.callCount).toBe(1);
    expect(second.matchResults).toHaveLength(1);
  });
});

describe('AiMatchingService cache invalidation', () => {
  it('re-analyzes a vacancy once its content changes, instead of reusing the stale cached result', async () => {
    const { service, provider } = buildService({ maxAiCandidates: 5 });
    const resume = buildFixtureResume();
    const vacancy = buildVacancy('v1', 'Backend Engineer', ['typescript', 'node.js']);

    const first = await service.matchAll({
      resume,
      vacancies: [vacancy],
      userId: FIXTURE_USER_ID,
      searchProfileId: FIXTURE_SEARCH_PROFILE_ID,
      searchProfileUpdatedAt: FIXTURE_SEARCH_PROFILE_UPDATED_AT,
    });
    expect(first.stats.computed).toBe(1);
    expect(provider.callCount).toBe(1);

    // Vacancy content changes (e.g. the source posting was edited) -> updatedAt bumps.
    // The small delay guarantees a distinct millisecond timestamp from the initial one.
    await new Promise((resolve) => setTimeout(resolve, 5));
    vacancy.updateDescription('Completely rewritten job description with new requirements.');

    const second = await service.matchAll({
      resume,
      vacancies: [vacancy],
      userId: FIXTURE_USER_ID,
      searchProfileId: FIXTURE_SEARCH_PROFILE_ID,
      searchProfileUpdatedAt: FIXTURE_SEARCH_PROFILE_UPDATED_AT,
    });

    expect(second.stats.reused).toBe(0);
    expect(second.stats.computed).toBe(1);
    expect(provider.callCount).toBe(2);
    expect(second.matchResults[0]?.id).toBe(first.matchResults[0]?.id);
  });

  it('re-analyzes every vacancy once the search profile changes', async () => {
    const { service, provider } = buildService({ maxAiCandidates: 5 });
    const resume = buildFixtureResume();
    const vacancy = buildVacancy('v1', 'Backend Engineer', ['typescript', 'node.js']);

    await service.matchAll({
      resume,
      vacancies: [vacancy],
      userId: FIXTURE_USER_ID,
      searchProfileId: FIXTURE_SEARCH_PROFILE_ID,
      searchProfileUpdatedAt: FIXTURE_SEARCH_PROFILE_UPDATED_AT,
    });
    expect(provider.callCount).toBe(1);

    const second = await service.matchAll({
      resume,
      vacancies: [vacancy],
      userId: FIXTURE_USER_ID,
      searchProfileId: FIXTURE_SEARCH_PROFILE_ID,
      searchProfileUpdatedAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    expect(second.stats.reused).toBe(0);
    expect(second.stats.computed).toBe(1);
    expect(provider.callCount).toBe(2);
  });
});

describe('AiMatchingService prompt content', () => {
  it('passes the resume raw text into the AI prompt', async () => {
    const provider = new CountingAIProvider();
    const { service } = buildService({ provider });
    const resume = buildFixtureResume();
    const vacancies = buildRelevantVacancies(1);

    await service.matchAll({ resume, vacancies, userId: FIXTURE_USER_ID, searchProfileId: FIXTURE_SEARCH_PROFILE_ID, searchProfileUpdatedAt: FIXTURE_SEARCH_PROFILE_UPDATED_AT });

    expect(provider.lastRequest?.prompt).toContain(
      'FIXTURE_RAW_RESUME_TEXT: full PDF extraction including project history and side projects.'
    );
  });
});
