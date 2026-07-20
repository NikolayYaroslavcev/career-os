import { describe, it, expect, vi } from 'vitest';
import { Recommendation as RecommendationLabel } from '@careeros/ai';
import {
  Vacancy,
  Company,
  createVacancyId,
  createCompanyId,
  createUserId,
  Location,
  ExperienceLevel,
  VacancySource,
} from '@careeros/career';
import type { IntelligenceWorkflowResult } from '../intelligence-workflow-service.js';
import { MorningDigestService, type WorkflowRunner } from '../morning-digest-service.js';
import { DigestBuilder } from '../digest-builder.js';
import type { Recommendation } from '../recommendation-service.js';
import {
  InMemoryCompanyRepository,
  InMemoryNotificationHistoryRepository,
} from '../../testing/in-memory-repositories.js';

const USER_ID = 'user-1';

function buildVacancy(id: string, title: string, companyId: string): Vacancy {
  return Vacancy.create({
    id: createVacancyId(id),
    title,
    description: 'A great role',
    companyId: createCompanyId(companyId),
    location: Location.create({ workMode: 'remote' }),
    experienceLevel: ExperienceLevel.SENIOR,
    source: VacancySource.REMOTE_OK,
  });
}

function buildRecommendation(params: {
  matchResultId: string;
  score: number;
  label: RecommendationLabel;
  vacancy: Vacancy;
}): Recommendation {
  return {
    matchResultId: params.matchResultId,
    vacancy: params.vacancy,
    score: params.score,
    confidence: 0.8,
    recommendation: params.label,
    summary: 'fixture summary',
    strengths: ['typescript'],
    weaknesses: [],
    requiredSkills: ['typescript'],
    missingSkills: [],
    seniorityEstimation: 'Senior',
    remotePolicy: 'Remote',
    salaryObservations: null,
    reasoning: 'fixture',
    generatedAt: new Date(),
    matchingAlgorithmVersion: '1.0.0',
  };
}

function buildWorkflowRunner(recommendations: readonly Recommendation[]): WorkflowRunner {
  const result: IntelligenceWorkflowResult = {
    searchProfileId: 'search-profile-1',
    vacancies: recommendations.map((r) => r.vacancy),
    recommendations,
    pendingVacancyIds: [],
    skippedVacancyIds: [],
    aiEnabled: true,
    stats: {
      providerSearch: {
        providerIds: ['remote_ok'],
        fetched: recommendations.length,
        persisted: recommendations.length,
        reused: 0,
        durationMs: 5,
        fetchDurationMs: 3,
        persistDurationMs: 2,
        perProvider: [],
      },
      aiMatching: { evaluated: recommendations.length, reused: 0, computed: recommendations.length, failed: 0, skipped: 0, triageDurationMs: 1, aiDurationMs: 3, durationMs: 5 },
      recommendationCount: recommendations.length,
      totalDurationMs: 10,
    },
  };
  return { run: vi.fn().mockResolvedValue(result) };
}

interface Harness {
  readonly service: MorningDigestService;
  readonly notificationHistoryRepository: InMemoryNotificationHistoryRepository;
  readonly metrics: { incrementCounter: ReturnType<typeof vi.fn>; recordHistogram: ReturnType<typeof vi.fn>; setGauge: ReturnType<typeof vi.fn> };
}

async function buildHarness(recommendations: readonly Recommendation[]): Promise<Harness> {
  const companyRepository = new InMemoryCompanyRepository();
  for (const recommendation of recommendations) {
    await companyRepository.save(
      Company.create({ id: recommendation.vacancy.companyId, name: `Name of ${recommendation.vacancy.companyId}` }),
      { workspaceId: 'workspace-1' }
    );
  }

  const notificationHistoryRepository = new InMemoryNotificationHistoryRepository();
  const metrics = { incrementCounter: vi.fn(), recordHistogram: vi.fn(), setGauge: vi.fn() };

  const service = new MorningDigestService(
    buildWorkflowRunner(recommendations),
    notificationHistoryRepository,
    companyRepository,
    new DigestBuilder(),
    metrics
  );

  return { service, notificationHistoryRepository, metrics };
}

describe('MorningDigestService', () => {
  it('includes only Strong Apply and Apply recommendations by default', async () => {
    const recommendations = [
      buildRecommendation({ matchResultId: 'm-strong', score: 95, label: RecommendationLabel.STRONG_APPLY, vacancy: buildVacancy('v-1', 'A', 'c-1') }),
      buildRecommendation({ matchResultId: 'm-apply', score: 70, label: RecommendationLabel.APPLY, vacancy: buildVacancy('v-2', 'B', 'c-2') }),
      buildRecommendation({ matchResultId: 'm-maybe', score: 50, label: RecommendationLabel.MAYBE, vacancy: buildVacancy('v-3', 'C', 'c-3') }),
      buildRecommendation({ matchResultId: 'm-skip', score: 20, label: RecommendationLabel.SKIP, vacancy: buildVacancy('v-4', 'D', 'c-4') }),
    ];
    const { service } = await buildHarness(recommendations);

    const result = await service.generate({ userId: USER_ID });

    expect(result.recommendations.map((r) => r.matchResultId)).toEqual(['m-strong', 'm-apply']);
    expect(result.stats.eligibleRecommendations).toBe(2);
  });

  it('respects a custom visibleLabels override', async () => {
    const recommendations = [
      buildRecommendation({ matchResultId: 'm-maybe', score: 50, label: RecommendationLabel.MAYBE, vacancy: buildVacancy('v-1', 'A', 'c-1') }),
    ];
    const { service } = await buildHarness(recommendations);

    const result = await service.generate({ userId: USER_ID, visibleLabels: [RecommendationLabel.MAYBE] });

    expect(result.recommendations).toHaveLength(1);
  });

  it('defaults to the Top 5 recommendations, given already score-sorted input', async () => {
    // Mirrors IntelligenceWorkflowService, which always returns recommendations sorted by score descending.
    const recommendations = Array.from({ length: 8 }, (_, i) =>
      buildRecommendation({
        matchResultId: `m-${i}`,
        score: 67 - i,
        label: RecommendationLabel.APPLY,
        vacancy: buildVacancy(`v-${i}`, `Role ${i}`, `c-${i}`),
      })
    );
    const { service } = await buildHarness(recommendations);

    const result = await service.generate({ userId: USER_ID });

    expect(result.recommendations).toHaveLength(5);
    expect(result.recommendations.map((r) => r.matchResultId)).toEqual(['m-0', 'm-1', 'm-2', 'm-3', 'm-4']);
  });

  it('honors a configurable topN', async () => {
    const recommendations = Array.from({ length: 8 }, (_, i) =>
      buildRecommendation({
        matchResultId: `m-${i}`,
        score: 67 - i,
        label: RecommendationLabel.APPLY,
        vacancy: buildVacancy(`v-${i}`, `Role ${i}`, `c-${i}`),
      })
    );
    const { service } = await buildHarness(recommendations);

    const result = await service.generate({ userId: USER_ID, topN: 2 });

    expect(result.recommendations).toHaveLength(2);
  });

  it('excludes recommendations the user was already notified about on the channel', async () => {
    const recommendations = [
      buildRecommendation({ matchResultId: 'm-1', score: 90, label: RecommendationLabel.STRONG_APPLY, vacancy: buildVacancy('v-1', 'A', 'c-1') }),
      buildRecommendation({ matchResultId: 'm-2', score: 80, label: RecommendationLabel.STRONG_APPLY, vacancy: buildVacancy('v-2', 'B', 'c-2') }),
    ];
    const { service, notificationHistoryRepository } = await buildHarness(recommendations);
    await notificationHistoryRepository.recordNotified(createUserId(USER_ID), ['m-1'], 'telegram');

    const result = await service.generate({ userId: USER_ID });

    expect(result.recommendations.map((r) => r.matchResultId)).toEqual(['m-2']);
    expect(result.stats.newRecommendations).toBe(1);
  });

  it('does not filter duplicates that were only notified on a different channel', async () => {
    const recommendations = [
      buildRecommendation({ matchResultId: 'm-1', score: 90, label: RecommendationLabel.STRONG_APPLY, vacancy: buildVacancy('v-1', 'A', 'c-1') }),
    ];
    const { service, notificationHistoryRepository } = await buildHarness(recommendations);
    await notificationHistoryRepository.recordNotified(createUserId(USER_ID), ['m-1'], 'email');

    const result = await service.generate({ userId: USER_ID, channel: 'telegram' });

    expect(result.recommendations).toHaveLength(1);
  });

  it('emits workflow, generation and recommendation-count metrics', async () => {
    const recommendations = [
      buildRecommendation({ matchResultId: 'm-1', score: 90, label: RecommendationLabel.STRONG_APPLY, vacancy: buildVacancy('v-1', 'A', 'c-1') }),
    ];
    const { service, metrics } = await buildHarness(recommendations);

    await service.generate({ userId: USER_ID });

    expect(metrics.recordHistogram).toHaveBeenCalledWith('careeros.digest.workflow_duration_ms', 10);
    expect(metrics.recordHistogram).toHaveBeenCalledWith('careeros.digest.generation_duration_ms', expect.any(Number));
    expect(metrics.incrementCounter).toHaveBeenCalledWith('careeros.digest.recommendation_count', 1);
  });

  it('produces a digest whose company names are resolved via CompanyRepository', async () => {
    const recommendations = [
      buildRecommendation({ matchResultId: 'm-1', score: 90, label: RecommendationLabel.STRONG_APPLY, vacancy: buildVacancy('v-1', 'Staff Engineer', 'c-1') }),
    ];
    const { service } = await buildHarness(recommendations);

    const result = await service.generate({ userId: USER_ID });

    expect(result.digest.topRecommendations[0]?.companyName).toBe('Name of c-1');
  });
});
