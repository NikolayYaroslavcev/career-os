import { describe, it, expect } from 'vitest';
import { createMatchResult, InMemoryAIMetricsCollector, Recommendation as RecommendationLabel } from '@careeros/ai';
import type { MatchResult } from '@careeros/ai';
import { Vacancy, createVacancyId, createCompanyId, Location, ExperienceLevel } from '@careeros/career';
import { RecommendationService, type Recommendation } from '../recommendation-service.js';
import { DigestBuilder } from '../digest-builder.js';

function buildVacancy(id: string, title: string, companyId: string): Vacancy {
  return Vacancy.create({
    id: createVacancyId(id),
    title,
    description: 'A great role',
    companyId: createCompanyId(companyId),
    location: Location.create({ workMode: 'remote' }),
    experienceLevel: ExperienceLevel.SENIOR,
  });
}

function buildMatchResult(params: {
  vacancyId: string;
  overallScore: number;
  recommendation: RecommendationLabel;
  strengths?: string[];
  missingSkills?: string[];
}): MatchResult {
  return createMatchResult({
    searchProfileId: 'profile-1',
    resumeId: 'resume-1',
    vacancyId: params.vacancyId,
    userId: 'user-1',
    overallScore: params.overallScore,
    confidence: 0.8,
    recommendation: params.recommendation,
    summary: 'Good fit overall',
    strengths: params.strengths ?? [],
    weaknesses: [],
    requiredSkills: params.missingSkills ?? [],
    missingSkills: params.missingSkills ?? [],
    seniorityEstimation: 'Senior',
    remotePolicy: 'Remote',
    salaryObservations: null,
    salaryFit: { score: 70, confidence: 0.6, reasoning: 'ok' },
    locationFit: { score: 90, confidence: 0.9, reasoning: 'remote' },
    experienceFit: { score: params.overallScore, confidence: 0.7, reasoning: 'match' },
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

function buildRecommendations(): readonly Recommendation[] {
  const service = new RecommendationService(new InMemoryAIMetricsCollector());

  const strongApplyVacancy = buildVacancy('vacancy-a', 'Staff Engineer', 'company-a');
  const applyVacancy = buildVacancy('vacancy-b', 'Backend Engineer', 'company-b');

  const vacancies = new Map([
    [strongApplyVacancy.id, strongApplyVacancy],
    [applyVacancy.id, applyVacancy],
  ]);

  const matchResults = [
    buildMatchResult({
      vacancyId: strongApplyVacancy.id,
      overallScore: 94,
      recommendation: RecommendationLabel.STRONG_APPLY,
      strengths: ['typescript', 'system design'],
      missingSkills: ['kubernetes'],
    }),
    buildMatchResult({
      vacancyId: applyVacancy.id,
      overallScore: 65,
      recommendation: RecommendationLabel.APPLY,
      strengths: ['typescript'],
      missingSkills: ['aws'],
    }),
  ];

  return service.build(matchResults, vacancies);
}

describe('DigestBuilder', () => {
  it('builds a title, summary, ranked items, and per-label groups', () => {
    const builder = new DigestBuilder();
    const recommendations = buildRecommendations();
    const companyNames = new Map([
      ['company-a', 'Acme Corp'],
      ['company-b', 'Widgets Inc'],
    ]);

    const digest = builder.build({
      generatedAt: new Date('2026-07-15T06:00:00Z'),
      newVacancyCount: 18,
      recommendations,
      companyNames,
    });

    expect(digest.title).toBe('CareerOS Morning Digest');
    expect(digest.newVacancyCount).toBe(18);
    expect(digest.summary).toContain('18 new vacancies');
    expect(digest.summary).toContain('2 recommended');

    expect(digest.topRecommendations).toHaveLength(2);
    expect(digest.topRecommendations[0]).toMatchObject({
      rank: 1,
      vacancyTitle: 'Staff Engineer',
      companyName: 'Acme Corp',
      score: 94,
      recommendation: RecommendationLabel.STRONG_APPLY,
      vacancyUrl: undefined,
    });
    expect(digest.topRecommendations[1]).toMatchObject({ rank: 2, companyName: 'Widgets Inc' });
  });

  it('falls back to "Unknown Company" when a companyId has no resolved name', () => {
    const builder = new DigestBuilder();
    const recommendations = buildRecommendations();

    const digest = builder.build({
      generatedAt: new Date(),
      newVacancyCount: 1,
      recommendations,
      companyNames: new Map(),
    });

    expect(digest.topRecommendations.every((item) => item.companyName === 'Unknown Company')).toBe(true);
  });

  it('groups recommendations by label, including empty groups for absent labels', () => {
    const builder = new DigestBuilder();
    const recommendations = buildRecommendations();

    const digest = builder.build({
      generatedAt: new Date(),
      newVacancyCount: 2,
      recommendations,
      companyNames: new Map(),
    });

    expect(digest.groups[RecommendationLabel.STRONG_APPLY]).toHaveLength(1);
    expect(digest.groups[RecommendationLabel.APPLY]).toHaveLength(1);
    expect(digest.groups[RecommendationLabel.MAYBE]).toHaveLength(0);
    expect(digest.groups[RecommendationLabel.SKIP]).toHaveLength(0);
  });

  it('aggregates unique strengths and missing skills across recommendations', () => {
    const builder = new DigestBuilder();
    const recommendations = buildRecommendations();

    const digest = builder.build({
      generatedAt: new Date(),
      newVacancyCount: 2,
      recommendations,
      companyNames: new Map(),
    });

    expect(digest.strengths).toEqual(['typescript', 'system design']);
    expect(digest.missingSkills).toEqual(['kubernetes', 'aws']);
  });

  it('produces an empty digest when there are no recommendations', () => {
    const builder = new DigestBuilder();

    const digest = builder.build({
      generatedAt: new Date(),
      newVacancyCount: 0,
      recommendations: [],
      companyNames: new Map(),
    });

    expect(digest.topRecommendations).toEqual([]);
    expect(digest.strengths).toEqual([]);
    expect(digest.missingSkills).toEqual([]);
    expect(digest.groups[RecommendationLabel.STRONG_APPLY]).toEqual([]);
  });
});
