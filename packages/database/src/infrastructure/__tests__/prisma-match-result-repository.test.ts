import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockPrismaClient, type MockPrismaClient } from '@careeros/test-utils';
import { createMatchResult } from '@careeros/ai';

const mockPrisma = createMockPrismaClient();

vi.mock('../../client.js', () => ({
  get prisma(): MockPrismaClient {
    return mockPrisma;
  },
}));

const { PrismaMatchResultRepository } = await import('../prisma-match-result-repository.js');
const { MatchResultMapper } = await import('../../mappers/match-result-mapper.js');

describe('PrismaMatchResultRepository', () => {
  let prisma: MockPrismaClient;
  let repository: InstanceType<typeof PrismaMatchResultRepository>;

  beforeEach(() => {
    prisma = mockPrisma;
    vi.clearAllMocks();
    repository = new PrismaMatchResultRepository();
  });

  const matchResult = createMatchResult({
    id: 'match-1',
    searchProfileId: 'profile-1',
    resumeId: 'resume-1',
    vacancyId: 'vacancy-1',
    userId: 'user-1',
    overallScore: 75,
    confidence: 0.8,
    recommendation: 'Apply',
    summary: 'Solid backend match.',
    strengths: ['typescript'],
    weaknesses: [],
    requiredSkills: ['typescript', 'go'],
    missingSkills: ['go'],
    seniorityEstimation: 'Middle',
    remotePolicy: 'Remote',
    salaryObservations: null,
    salaryFit: { score: 60, confidence: 0.5, reasoning: 'ok' },
    locationFit: { score: 90, confidence: 0.9, reasoning: 'remote' },
    experienceFit: { score: 70, confidence: 0.6, reasoning: 'match' },
    careerGrowthFit: { score: 55, confidence: 0.4, reasoning: 'some growth' },
    reasoning: 'Solid match',
    model: 'mock-model',
    provider: 'mock',
    promptVersion: '1.0.0',
    promptId: 'vacancy-analysis',
    matchingAlgorithmVersion: '1.0.0',
    inputHash: 'hash-1',
    tokenUsage: { promptTokens: 100, completionTokens: 100, totalTokens: 200 },
    latencyMs: 500,
    estimatedCostUsd: 0,
  });

  it('saves a MatchResult via upsert keyed on (searchProfileId, vacancyId)', async () => {
    (prisma.matchResult.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await repository.save(matchResult);

    expect(prisma.matchResult.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { searchProfileId_vacancyId: { searchProfileId: 'profile-1', vacancyId: 'vacancy-1' } },
        create: expect.objectContaining({ resumeId: 'resume-1', overallScore: 75 }),
        update: expect.objectContaining({ resumeId: 'resume-1', overallScore: 75 }),
      })
    );
  });

  it('finds a MatchResult by (searchProfileId, vacancyId) using the composite unique key', async () => {
    const persisted = MatchResultMapper.toPersistence(matchResult);
    (prisma.matchResult.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(persisted);

    const found = await repository.findBySearchProfileIdAndVacancyId('profile-1', 'vacancy-1');

    expect(prisma.matchResult.findUnique).toHaveBeenCalledWith({
      where: { searchProfileId_vacancyId: { searchProfileId: 'profile-1', vacancyId: 'vacancy-1' } },
    });
    expect(found?.overallScore).toBe(75);
  });

  it('returns null when no MatchResult exists', async () => {
    (prisma.matchResult.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const found = await repository.findById('missing');
    expect(found).toBeNull();
  });

  it('lists MatchResults for a search profile ordered by score', async () => {
    const persisted = MatchResultMapper.toPersistence(matchResult);
    (prisma.matchResult.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([persisted]);

    const found = await repository.findBySearchProfileId('profile-1');

    expect(prisma.matchResult.findMany).toHaveBeenCalledWith({
      where: { searchProfileId: 'profile-1' },
      orderBy: { overallScore: 'desc' },
    });
    expect(found).toHaveLength(1);
  });
});
