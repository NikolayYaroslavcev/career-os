import { describe, it, expect } from 'vitest';
import {
  ProviderRegistry,
  FakeProvider,
  NoopLogger as ProviderNoopLogger,
  InMemoryMetricsCollector as ProviderInMemoryMetricsCollector,
} from '@careeros/providers';
import {
  MatchingEngine,
  VacancyAnalysisPromptBuilder,
  InMemoryAICache,
  InMemoryCostTracker,
  NoopAILogger,
  InMemoryAIMetricsCollector,
  InMemoryAITracer,
} from '@careeros/ai';
import { ProviderSearchService } from '../provider-search-service.js';
import { AiMatchingService } from '../ai-matching-service.js';
import { RecommendationService } from '../recommendation-service.js';
import { MockAIProvider } from '../../testing/mock-ai-provider.js';
import {
  InMemoryVacancyRepository,
  InMemoryVacancySourceRepository,
  InMemoryCompanyRepository,
  InMemoryMatchResultRepository,
} from '../../testing/in-memory-repositories.js';
import { buildFixtureResume, buildFixtureSearchProfile, FIXTURE_USER_ID } from '../../testing/fixtures.js';

describe('Provider -> AI matching -> Recommendation pipeline', () => {
  it('fetches vacancies from the provider, matches them against a resume, and produces sorted recommendations', async () => {
    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(new FakeProvider('hh',{ jobsToReturn: 3 }));

    const vacancyRepository = new InMemoryVacancyRepository();
    const vacancySourceRepository = new InMemoryVacancySourceRepository();
    const companyRepository = new InMemoryCompanyRepository();
    const matchResultRepository = new InMemoryMatchResultRepository();
    const aiMetrics = new InMemoryAIMetricsCollector();

    const providerSearchService = new ProviderSearchService(
      providerRegistry,
      vacancyRepository,
      vacancySourceRepository,
      companyRepository,
      new ProviderNoopLogger(),
      new ProviderInMemoryMetricsCollector()
    );

    const matchingEngine = new MatchingEngine({
      provider: new MockAIProvider(),
      promptBuilder: new VacancyAnalysisPromptBuilder(),
      cache: new InMemoryAICache(),
      costTracker: new InMemoryCostTracker(),
      logger: new NoopAILogger(),
      metrics: aiMetrics,
      tracer: new InMemoryAITracer(),
    });

    const aiMatchingService = new AiMatchingService(matchingEngine, matchResultRepository, companyRepository, aiMetrics);
    const recommendationService = new RecommendationService(aiMetrics);

    const profile = buildFixtureSearchProfile();
    const resume = buildFixtureResume();

    const providerSearch = await providerSearchService.searchAndPersist(profile, undefined, 'workspace-1');
    expect(providerSearch.vacancies).toHaveLength(3);
    expect(providerSearch.stats.fetched).toBe(3);
    // Technologies from the provider fixture must survive persistence (metadata round-trip).
    expect(providerSearch.vacancies[0]?.technologies.map((t) => t.name)).toContain('typescript');

    const aiMatching = await aiMatchingService.matchAll({
      resume,
      vacancies: providerSearch.vacancies,
      userId: FIXTURE_USER_ID,
      searchProfileId: profile.id,
      searchProfileUpdatedAt: profile.updatedAt,
    });
    expect(aiMatching.matchResults).toHaveLength(3);
    expect(aiMatching.stats.computed).toBe(3);
    expect(aiMatching.stats.reused).toBe(0);

    for (const matchResult of aiMatching.matchResults) {
      expect(matchResult.overallScore).toBeGreaterThan(0);
      expect(['StrongApply', 'Apply', 'Maybe', 'Skip']).toContain(matchResult.recommendation);
      // typescript overlaps with the fixture resume, react does not -> should be flagged missing.
      expect(matchResult.missingSkills).toContain('react');
    }

    const vacancyById = new Map(providerSearch.vacancies.map((v) => [v.id, v]));
    const recommendations = recommendationService.build(aiMatching.matchResults, vacancyById);

    expect(recommendations).toHaveLength(3);
    for (let i = 1; i < recommendations.length; i++) {
      const prev = recommendations[i - 1];
      const curr = recommendations[i];
      if (!prev || !curr) throw new Error('expected a recommendation');
      expect(prev.score).toBeGreaterThanOrEqual(curr.score);
    }
  });

  it('does not duplicate vacancies already persisted from a prior search (dedup by source + sourceId)', async () => {
    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(new FakeProvider('hh',{ jobsToReturn: 2 }));

    const vacancyRepository = new InMemoryVacancyRepository();
    const vacancySourceRepository = new InMemoryVacancySourceRepository();
    const companyRepository = new InMemoryCompanyRepository();

    const providerSearchService = new ProviderSearchService(
      providerRegistry,
      vacancyRepository,
      vacancySourceRepository,
      companyRepository,
      new ProviderNoopLogger(),
      new ProviderInMemoryMetricsCollector()
    );

    const profile = buildFixtureSearchProfile();

    const first = await providerSearchService.searchAndPersist(profile, undefined, 'workspace-1');
    expect(first.stats.reused).toBe(0);

    const second = await providerSearchService.searchAndPersist(profile, undefined, 'workspace-1');
    expect(second.stats.reused).toBe(2);
    expect(second.vacancies.map((v) => v.id)).toEqual(first.vacancies.map((v) => v.id));
  });
});
