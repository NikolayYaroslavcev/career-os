import { describe, it, expect } from 'vitest';
import { createMatchResult, InMemoryAIMetricsCollector } from '@careeros/ai';
import { Vacancy, createVacancyId, createCompanyId, Location, ExperienceLevel } from '@careeros/career';
import { RecommendationService } from '../recommendation-service.js';

function buildVacancy(id: string, title: string): Vacancy {
  return Vacancy.create({
    id: createVacancyId(id),
    title,
    description: 'A great role',
    companyId: createCompanyId('company-1'),
    location: Location.create({ workMode: 'remote' }),
    experienceLevel: ExperienceLevel.SENIOR,
  });
}

function buildMatchResult(vacancyId: string, overallScore: number): ReturnType<typeof createMatchResult> {
  return createMatchResult({
    searchProfileId: 'profile-1',
    resumeId: 'resume-1',
    vacancyId,
    userId: 'user-1',
    overallScore,
    confidence: 0.8,
    recommendation: overallScore >= 80 ? 'StrongApply' : 'Apply',
    summary: 'Good fit overall',
    strengths: ['typescript'],
    weaknesses: [],
    requiredSkills: ['typescript'],
    missingSkills: [],
    seniorityEstimation: 'Middle',
    remotePolicy: 'Remote',
    salaryObservations: null,
    salaryFit: { score: 70, confidence: 0.6, reasoning: 'ok' },
    locationFit: { score: 90, confidence: 0.9, reasoning: 'remote' },
    experienceFit: { score: overallScore, confidence: 0.7, reasoning: 'match' },
    careerGrowthFit: { score: 60, confidence: 0.5, reasoning: 'growth' },
    reasoning: 'Good fit overall',
    model: 'mock-model',
    provider: 'mock',
    promptVersion: '1.0.0',
    promptId: 'vacancy-analysis',
    matchingAlgorithmVersion: '1.0.0',
    inputHash: 'hash-1',
    tokenUsage: { promptTokens: 100, completionTokens: 100, totalTokens: 200 },
    latencyMs: 100,
    estimatedCostUsd: 0,
  });
}

describe('RecommendationService', () => {
  it('builds recommendations sorted by score descending', () => {
    const service = new RecommendationService(new InMemoryAIMetricsCollector());

    const vacancyA = buildVacancy('vacancy-a', 'Backend Engineer');
    const vacancyB = buildVacancy('vacancy-b', 'Staff Engineer');

    const vacancies = new Map([
      [vacancyA.id, vacancyA],
      [vacancyB.id, vacancyB],
    ]);

    const matchResults = [buildMatchResult(vacancyA.id, 60), buildMatchResult(vacancyB.id, 90)];

    const recommendations = service.build(matchResults, vacancies);

    expect(recommendations).toHaveLength(2);
    expect(recommendations[0]?.vacancy.title).toBe('Staff Engineer');
    expect(recommendations[0]?.score).toBe(90);
    expect(recommendations[1]?.score).toBe(60);
  });

  it('skips match results whose vacancy is not in the provided map', () => {
    const service = new RecommendationService(new InMemoryAIMetricsCollector());
    const vacancyA = buildVacancy('vacancy-a', 'Backend Engineer');

    const recommendations = service.build(
      [buildMatchResult('vacancy-a', 50), buildMatchResult('vacancy-orphan', 95)],
      new Map([[vacancyA.id, vacancyA]])
    );

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]?.vacancy.id).toBe(vacancyA.id);
  });

  it('sortByScore returns a new array sorted descending without mutating the input', () => {
    const service = new RecommendationService(new InMemoryAIMetricsCollector());
    const vacancyA = buildVacancy('vacancy-a', 'A');
    const recs = [
      { matchResultId: '1', vacancy: vacancyA, score: 10, confidence: 0.5, recommendation: 'Maybe' as const, summary: '', strengths: [], weaknesses: [], requiredSkills: [], missingSkills: [], seniorityEstimation: '', remotePolicy: '', salaryObservations: null, reasoning: '', generatedAt: new Date(), matchingAlgorithmVersion: '1.0.0' },
      { matchResultId: '2', vacancy: vacancyA, score: 99, confidence: 0.5, recommendation: 'StrongApply' as const, summary: '', strengths: [], weaknesses: [], requiredSkills: [], missingSkills: [], seniorityEstimation: '', remotePolicy: '', salaryObservations: null, reasoning: '', generatedAt: new Date(), matchingAlgorithmVersion: '1.0.0' },
    ];

    const sorted = service.sortByScore(recs);
    expect(sorted[0]?.score).toBe(99);
    expect(recs[0]?.score).toBe(10);
  });
});
