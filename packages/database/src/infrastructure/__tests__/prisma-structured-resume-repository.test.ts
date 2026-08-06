import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockPrismaClient, type MockPrismaClient } from '@careeros/test-utils';
import {
  StructuredResume,
  createResumeId,
  createStructuredResumeId,
  type ExtractionStatus,
} from '@careeros/career';

const mockPrisma = createMockPrismaClient();

vi.mock('../../client.js', () => ({
  get prisma(): MockPrismaClient {
    return mockPrisma;
  },
}));

const { PrismaStructuredResumeRepository } = await import(
  '../prisma-structured-resume-repository.js'
);

describe('PrismaStructuredResumeRepository', () => {
  let prisma: MockPrismaClient;
  let repository: InstanceType<typeof PrismaStructuredResumeRepository>;

  beforeEach(() => {
    prisma = mockPrisma;
    vi.clearAllMocks();
    repository = new PrismaStructuredResumeRepository();
  });

  function makeStructuredResume(overrides?: {
    extractionStatus?: string;
    sourceHash?: string;
    extractionVersion?: string;
  }): StructuredResume {
    return StructuredResume.reconstitute(createStructuredResumeId('sr-1'), {
      resumeId: createResumeId('resume-1'),
      sourceHash: overrides?.sourceHash ?? 'abc123',
      extractionVersion: overrides?.extractionVersion ?? 'v1',
      extractionStatus: (overrides?.extractionStatus as ExtractionStatus | undefined) ?? 'completed',
      summary: 'Senior dev',
      skills: ['TypeScript'],
      technologies: ['Node.js'],
      experience: [],
      education: [],
      certifications: [],
      languages: [],
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    });
  }

  describe('findByResumeId', () => {
    it('returns null when no record exists', async () => {
      (prisma.structuredResume.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await repository.findByResumeId(createResumeId('resume-1'));

      expect(result).toBeNull();
      expect(prisma.structuredResume.findUnique).toHaveBeenCalledWith({
        where: { resumeId: 'resume-1' },
      });
    });

    it('maps a Prisma record to a domain entity', async () => {
      const now = new Date();
      (prisma.structuredResume.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'sr-1',
        resumeId: 'resume-1',
        sourceHash: 'abc123',
        extractionVersion: 'v1',
        extractionModel: 'gpt-4o',
        extractionStatus: 'completed',
        failureReason: null,
        extractedAt: now,
        summary: 'Senior dev',
        seniorityLevel: 'senior',
        totalYearsOfExperience: 8,
        skills: ['TypeScript'],
        technologies: ['Node.js'],
        experience: [],
        education: [],
        createdAt: now,
        updatedAt: now,
      });

      const result = await repository.findByResumeId(createResumeId('resume-1'));

      expect(result).not.toBeNull();
      expect(result?.id).toBe('sr-1');
      expect(result?.resumeId).toBe('resume-1');
      expect(result?.extractionStatus).toBe('completed');
      expect(result?.summary).toBe('Senior dev');
      expect(result?.skills).toEqual(['TypeScript']);
    });
  });

  describe('upsert', () => {
    it('calls upsert with mapped data', async () => {
      (prisma.structuredResume.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const sr = makeStructuredResume();
      await repository.upsert(sr);

      expect(prisma.structuredResume.upsert).toHaveBeenCalledWith({
        where: { resumeId: 'resume-1' },
        create: expect.objectContaining({
          id: 'sr-1',
          resumeId: 'resume-1',
          extractionStatus: 'completed',
        }),
        update: expect.objectContaining({
          id: 'sr-1',
          resumeId: 'resume-1',
          extractionStatus: 'completed',
        }),
      });
    });
  });
});
