import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createMatchResult, MatchCategory } from '@careeros/ai';
import type { CategoryScore, ActionableItem, MatchExplanation } from '@careeros/ai';
import { integrationTestsEnabled } from './db-guard.js';

const runIf = integrationTestsEnabled() ? describe : describe.skip;

runIf('MatchResult persistence (real Postgres)', () => {
  let prisma: import('@prisma/client').PrismaClient;
  let PrismaMatchResultRepository: typeof import('../infrastructure/prisma-match-result-repository.js').PrismaMatchResultRepository;
  let workspaceId: string;
  let userId: string;
  let vacancyId: string;
  let searchProfileId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../client.js'));
    ({ PrismaMatchResultRepository } = await import('../infrastructure/prisma-match-result-repository.js'));

    const workspace = await prisma.workspace.create({ data: { name: `integration-test-${crypto.randomUUID()}` } });
    workspaceId = workspace.id;

    const user = await prisma.user.create({
      data: { email: `integration-${crypto.randomUUID()}@example.test`, passwordHash: 'x' },
    });
    userId = user.id;

    const company = await prisma.company.create({ data: { name: 'Integration Test Co', workspaceId } });
    const vacancy = await prisma.vacancy.create({
      data: {
        title: 'Backend Engineer',
        description: 'desc',
        requirements: [],
        currency: 'USD',
        remote: 'REMOTE',
        workspaceId,
        companyId: company.id,
      },
    });
    vacancyId = vacancy.id;

    const searchProfile = await prisma.searchProfile.create({
      data: {
        name: 'Integration Test Profile',
        desiredPositions: ['Backend Engineer'],
        desiredTechnologies: [],
        experienceLevel: 'senior',
        workspaceId,
        userId,
      },
    });
    searchProfileId = searchProfile.id;
  });

  afterAll(async () => {
    // Cascades away Company + Vacancy (+ any surviving MatchResult) under this workspace.
    await prisma.workspace.delete({ where: { id: workspaceId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it('persists categoryScores, actionableItems, and explanation and reads them back unchanged', async () => {
    const repository = new PrismaMatchResultRepository();

    const categoryScores: CategoryScore[] = [
      {
        category: MatchCategory.TECHNICAL_SKILLS,
        label: 'Technical Skills',
        value: 80,
        weight: 0.4,
        confidence: 0.9,
        explanation: 'Strong overlap.',
      },
    ];
    const actionableItems: ActionableItem[] = [
      {
        type: 'add_skill',
        title: 'Learn Terraform',
        description: 'The role expects IaC experience.',
        impact: 6,
        category: MatchCategory.TECHNICAL_SKILLS,
        priority: 'medium',
      },
    ];
    const explanation: MatchExplanation = {
      overallPercent: 80,
      strengths: [{ label: 'TypeScript', detail: '6 years' }],
      weaknesses: [],
      missingKeywords: ['terraform'],
      categoryScores,
    };

    const matchResult = createMatchResult({
      searchProfileId,
      vacancyId,
      userId,
      overallScore: 80,
      confidence: 0.9,
      recommendation: 'Apply',
      summary: 'Good fit.',
      strengths: ['TypeScript'],
      weaknesses: [],
      requiredSkills: ['TypeScript'],
      missingSkills: [],
      seniorityEstimation: 'Senior',
      remotePolicy: 'Remote',
      salaryObservations: null,
      salaryFit: { score: 70, confidence: 0.6, reasoning: 'ok' },
      locationFit: { score: 90, confidence: 0.8, reasoning: 'remote' },
      experienceFit: { score: 85, confidence: 0.75, reasoning: 'match' },
      careerGrowthFit: { score: 60, confidence: 0.5, reasoning: 'growth' },
      reasoning: 'Solid technical match.',
      categoryScores,
      actionableItems,
      explanation,
      model: 'gpt-4o',
      provider: 'openai',
      promptVersion: '1.0.0',
      promptId: 'vacancy-analysis',
      matchingAlgorithmVersion: '1.0.0',
      inputHash: `hash-${crypto.randomUUID()}`,
      tokenUsage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
      latencyMs: 1000,
      estimatedCostUsd: 0.02,
    });

    await repository.save(matchResult);

    const found = await repository.findBySearchProfileIdAndVacancyId(searchProfileId, vacancyId);

    expect(found).not.toBeNull();
    expect(found?.categoryScores).toEqual(categoryScores);
    expect(found?.actionableItems).toEqual(actionableItems);
    expect(found?.explanation).toEqual(explanation);
    expect(found?.overallScore).toBe(80);

    await prisma.matchResult.delete({ where: { id: matchResult.id } });
  });
});
