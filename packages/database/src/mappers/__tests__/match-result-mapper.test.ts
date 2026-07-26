import { describe, it, expect } from 'vitest';
import { createMatchResult, MatchCategory } from '@careeros/ai';
import type { CategoryScore, ActionableItem, MatchExplanation } from '@careeros/ai';
import { MatchResultMapper } from '../match-result-mapper.js';

describe('MatchResultMapper', () => {
  it('round-trips a MatchResult through the flattened persistence shape', () => {
    const matchResult = createMatchResult({
      searchProfileId: 'profile-1',
      resumeId: 'resume-1',
      vacancyId: 'vacancy-1',
      userId: 'user-1',
      overallScore: 82,
      confidence: 0.91,
      recommendation: 'StrongApply',
      summary: 'Strong senior TypeScript role, fully remote.',
      strengths: ['TypeScript expertise'],
      weaknesses: ['No Go experience'],
      requiredSkills: ['TypeScript', 'Go'],
      missingSkills: ['go'],
      seniorityEstimation: 'Senior',
      remotePolicy: 'Fully remote',
      salaryObservations: 'Within market range.',
      salaryFit: { score: 70, confidence: 0.6, reasoning: 'Salary within range' },
      locationFit: { score: 90, confidence: 0.8, reasoning: 'Remote-friendly' },
      experienceFit: { score: 85, confidence: 0.75, reasoning: 'Seniority matches' },
      careerGrowthFit: { score: 60, confidence: 0.5, reasoning: 'Some growth potential' },
      reasoning: 'Strong overall match on core technologies.',
      model: 'gpt-4o',
      provider: 'openai',
      promptVersion: '1.0.0',
      promptId: 'vacancy-analysis',
      matchingAlgorithmVersion: '1.0.0',
      inputHash: 'hash-1',
      tokenUsage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
      latencyMs: 1200,
      estimatedCostUsd: 0.02,
    });

    const persisted = MatchResultMapper.toPersistence(matchResult);
    expect(persisted.overallScore).toBe(82);
    expect(persisted.salaryFitScore).toBe(70);
    expect(persisted.promptTokens).toBe(500);
    expect(persisted.completionTokens).toBe(300);
    expect(persisted.totalTokens).toBe(800);
    expect(persisted.resumeId).toBe('resume-1');
    expect(persisted.searchProfileId).toBe('profile-1');
    expect(persisted.requiredSkills).toEqual(['TypeScript', 'Go']);
    expect(persisted.salaryObservations).toBe('Within market range.');

    const roundTripped = MatchResultMapper.toDomain(persisted);
    expect(roundTripped).toEqual(matchResult);
  });

  it('round-trips a profile-only analysis (no resume) with a null salaryObservations', () => {
    const matchResult = createMatchResult({
      searchProfileId: 'profile-1',
      vacancyId: 'vacancy-1',
      userId: 'user-1',
      overallScore: 55,
      confidence: 0.4,
      recommendation: 'Maybe',
      summary: 'Coarse profile-only match, no resume yet.',
      strengths: [],
      weaknesses: [],
      requiredSkills: ['TypeScript'],
      missingSkills: [],
      seniorityEstimation: 'Middle',
      remotePolicy: 'Unclear',
      salaryObservations: null,
      salaryFit: { score: 50, confidence: 0.5, reasoning: 'No data' },
      locationFit: { score: 50, confidence: 0.5, reasoning: 'No data' },
      experienceFit: { score: 50, confidence: 0.5, reasoning: 'No data' },
      careerGrowthFit: { score: 50, confidence: 0.5, reasoning: 'No data' },
      reasoning: 'No resume available yet.',
      model: 'gpt-4o',
      provider: 'openai',
      promptVersion: '1.0.0',
      promptId: 'vacancy-analysis',
      matchingAlgorithmVersion: '1.0.0',
      inputHash: 'hash-2',
      tokenUsage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
      latencyMs: 400,
      estimatedCostUsd: 0.01,
    });

    const persisted = MatchResultMapper.toPersistence(matchResult);
    expect(persisted.resumeId).toBeNull();
    expect(persisted.salaryObservations).toBeNull();

    const roundTripped = MatchResultMapper.toDomain(persisted);
    expect(roundTripped.resumeId).toBeUndefined();
    expect(roundTripped).toEqual(matchResult);
  });

  it('persists and round-trips categoryScores, actionableItems, and explanation unchanged', () => {
    const categoryScores: CategoryScore[] = [
      {
        category: MatchCategory.TECHNICAL_SKILLS,
        label: 'Technical Skills',
        value: 82,
        weight: 0.4,
        confidence: 0.9,
        explanation: 'Strong TypeScript and Node.js overlap.',
      },
      {
        category: MatchCategory.SALARY,
        label: 'Salary',
        value: 55,
        weight: 0.15,
        confidence: 0.6,
        explanation: 'Slightly below the candidate expectation.',
      },
    ];
    const actionableItems: ActionableItem[] = [
      {
        type: 'add_skill',
        title: 'Learn Kubernetes',
        description: 'The role expects container orchestration experience.',
        impact: 8,
        category: MatchCategory.TECHNICAL_SKILLS,
        priority: 'high',
      },
      {
        type: 'adjust_expectation',
        title: 'Reconsider salary floor',
        description: 'This role pays below your stated minimum.',
        impact: 3,
        category: MatchCategory.SALARY,
        priority: 'low',
      },
    ];
    const explanation: MatchExplanation = {
      overallPercent: 78,
      strengths: [{ label: 'TypeScript', detail: '6 years of production experience' }],
      weaknesses: [{ label: 'Kubernetes', detail: 'No demonstrated experience' }],
      missingKeywords: ['kubernetes', 'terraform'],
      categoryScores,
    };

    const matchResult = createMatchResult({
      searchProfileId: 'profile-2',
      resumeId: 'resume-2',
      vacancyId: 'vacancy-2',
      userId: 'user-2',
      overallScore: 78,
      confidence: 0.85,
      recommendation: 'Apply',
      summary: 'Good overall fit with a skills gap on infra tooling.',
      strengths: ['TypeScript'],
      weaknesses: ['Kubernetes'],
      requiredSkills: ['TypeScript', 'Kubernetes'],
      missingSkills: ['Kubernetes'],
      seniorityEstimation: 'Senior',
      remotePolicy: 'Remote',
      salaryObservations: 'Below stated minimum.',
      salaryFit: { score: 55, confidence: 0.6, reasoning: 'Below range' },
      locationFit: { score: 90, confidence: 0.8, reasoning: 'Remote-friendly' },
      experienceFit: { score: 85, confidence: 0.75, reasoning: 'Seniority matches' },
      careerGrowthFit: { score: 60, confidence: 0.5, reasoning: 'Some growth potential' },
      reasoning: 'Strong technical match, salary and infra gaps noted.',
      categoryScores,
      actionableItems,
      explanation,
      model: 'gpt-4o',
      provider: 'openai',
      promptVersion: '1.0.0',
      promptId: 'vacancy-analysis',
      matchingAlgorithmVersion: '1.0.0',
      inputHash: 'hash-3',
      tokenUsage: { promptTokens: 600, completionTokens: 400, totalTokens: 1000 },
      latencyMs: 1500,
      estimatedCostUsd: 0.03,
    });

    const persisted = MatchResultMapper.toPersistence(matchResult);
    expect(persisted.categoryScores).toEqual(categoryScores);
    expect(persisted.actionableItems).toEqual(actionableItems);
    expect(persisted.explanation).toEqual(explanation);

    const roundTripped = MatchResultMapper.toDomain(persisted);
    expect(roundTripped.categoryScores).toEqual(categoryScores);
    expect(roundTripped.actionableItems).toEqual(actionableItems);
    expect(roundTripped.explanation).toEqual(explanation);
    expect(roundTripped).toEqual(matchResult);
  });

  it('reads back a null explanation and empty categoryScores/actionableItems arrays as their defaults', () => {
    const persisted = MatchResultMapper.toPersistence(
      createMatchResult({
        searchProfileId: 'profile-3',
        vacancyId: 'vacancy-3',
        userId: 'user-3',
        overallScore: 50,
        confidence: 0.5,
        recommendation: 'Maybe',
        summary: 'No category data yet.',
        strengths: [],
        weaknesses: [],
        requiredSkills: [],
        missingSkills: [],
        seniorityEstimation: 'Middle',
        remotePolicy: 'Unclear',
        salaryObservations: null,
        salaryFit: { score: 50, confidence: 0.5, reasoning: 'No data' },
        locationFit: { score: 50, confidence: 0.5, reasoning: 'No data' },
        experienceFit: { score: 50, confidence: 0.5, reasoning: 'No data' },
        careerGrowthFit: { score: 50, confidence: 0.5, reasoning: 'No data' },
        reasoning: 'No resume available yet.',
        model: 'gpt-4o',
        provider: 'openai',
        promptVersion: '1.0.0',
        promptId: 'vacancy-analysis',
        matchingAlgorithmVersion: '1.0.0',
        inputHash: 'hash-4',
        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        latencyMs: 300,
        estimatedCostUsd: 0.005,
      })
    );

    // Simulates a raw read where an unset Json? column comes back as `null`
    // from the database driver (Prisma.JsonNull is a write-only sentinel).
    const rawFromDb = { ...persisted, explanation: null };

    const roundTripped = MatchResultMapper.toDomain(rawFromDb);
    expect(roundTripped.categoryScores).toEqual([]);
    expect(roundTripped.actionableItems).toEqual([]);
    expect(roundTripped.explanation).toBeNull();
  });
});
