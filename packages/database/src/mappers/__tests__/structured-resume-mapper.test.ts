import { describe, it, expect } from 'vitest';
import {
  StructuredResume,
  createStructuredResumeId,
  createResumeId,
} from '@careeros/career';
import { StructuredResumeMapper } from '../structured-resume-mapper.js';

describe('StructuredResumeMapper', () => {
  const resumeId = createResumeId('resume-1');
  const srId = createStructuredResumeId('sr-1');

  function makeEntity(status: 'pending' | 'completed' | 'failed' = 'completed'): StructuredResume {
    return StructuredResume.reconstitute(srId, {
      resumeId,
      sourceHash: 'abc123',
      extractionVersion: 'v1',
      extractionModel: 'gpt-4o',
      extractionStatus: status,
      summary: 'Full-stack dev',
      seniorityLevel: 'senior',
      totalYearsOfExperience: 8,
      skills: ['TypeScript', 'React'],
      technologies: ['Node.js', 'PostgreSQL'],
      experience: [
        {
          company: 'Acme',
          position: 'Engineer',
          startDate: new Date('2020-01-01'),
          endDate: new Date('2024-01-01'),
          description: 'Built things',
          technologies: ['TypeScript', 'React'],
        },
      ],
      education: [
        {
          institution: 'MIT',
          degree: 'BS',
          field: 'CS',
          startDate: new Date('2012-09-01'),
          endDate: new Date('2016-06-01'),
        },
      ],
      extractedAt: new Date('2026-01-01'),
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    });
  }

  describe('toPersistence', () => {
    it('serializes all fields for Prisma', () => {
      const entity = makeEntity();
      const data = StructuredResumeMapper.toPersistence(entity);

      expect(data.id).toBe('sr-1');
      expect(data.resumeId).toBe('resume-1');
      expect(data.sourceHash).toBe('abc123');
      expect(data.extractionVersion).toBe('v1');
      expect(data.extractionModel).toBe('gpt-4o');
      expect(data.extractionStatus).toBe('completed');
      expect(data.summary).toBe('Full-stack dev');
      expect(data.skills).toEqual(['TypeScript', 'React']);
      expect(data.experience).toHaveLength(1);
      expect(data.education).toHaveLength(1);
    });

    it('converts null optionals to null', () => {
      const entity = StructuredResume.reconstitute(srId, {
        resumeId,
        sourceHash: 'abc',
        extractionVersion: 'v1',
        extractionStatus: 'pending',
        skills: [],
        technologies: [],
        experience: [],
        education: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const data = StructuredResumeMapper.toPersistence(entity);

      expect(data.extractionModel).toBeNull();
      expect(data.failureReason).toBeNull();
      expect(data.extractedAt).toBeNull();
      expect(data.summary).toBeNull();
      expect(data.seniorityLevel).toBeNull();
      expect(data.totalYearsOfExperience).toBeNull();
    });
  });

  describe('toDomain', () => {
    it('restores a full entity from Prisma record', () => {
      const now = new Date();
      const record = {
        id: 'sr-1',
        resumeId: 'resume-1',
        sourceHash: 'abc123',
        extractionVersion: 'v1',
        extractionModel: 'gpt-4o',
        extractionStatus: 'completed',
        failureReason: null,
        extractedAt: now,
        summary: 'Full-stack dev',
        seniorityLevel: 'senior',
        totalYearsOfExperience: 8,
        skills: ['TypeScript', 'React'],
        technologies: ['Node.js'],
        experience: [
          {
            company: 'Acme',
            position: 'Engineer',
            startDate: '2020-01-01T00:00:00.000Z',
            endDate: '2024-01-01T00:00:00.000Z',
            description: 'Built things',
            technologies: ['TypeScript'],
          },
        ],
        education: [
          {
            institution: 'MIT',
            degree: 'BS',
            field: 'CS',
            startDate: '2012-09-01T00:00:00.000Z',
            endDate: '2016-06-01T00:00:00.000Z',
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      const entity = StructuredResumeMapper.toDomain(record);

      expect(entity.id).toBe('sr-1');
      expect(entity.resumeId).toBe('resume-1');
      expect(entity.extractionStatus).toBe('completed');
      expect(entity.summary).toBe('Full-stack dev');
      expect(entity.seniorityLevel).toBe('senior');
      expect(entity.totalYearsOfExperience).toBe(8);
      expect(entity.skills).toEqual(['TypeScript', 'React']);
      expect(entity.experience).toHaveLength(1);
      expect(entity.experience[0]?.startDate).toBeInstanceOf(Date);
      expect(entity.education).toHaveLength(1);
      expect(entity.education[0]?.startDate).toBeInstanceOf(Date);
    });

    it('handles null/empty JSON fields gracefully', () => {
      const record = {
        id: 'sr-1',
        resumeId: 'resume-1',
        sourceHash: 'abc',
        extractionVersion: 'v1',
        extractionModel: null,
        extractionStatus: 'pending',
        failureReason: null,
        extractedAt: null,
        summary: null,
        seniorityLevel: null,
        totalYearsOfExperience: null,
        skills: null,
        technologies: null,
        experience: null,
        education: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const entity = StructuredResumeMapper.toDomain(record);

      expect(entity.skills).toEqual([]);
      expect(entity.technologies).toEqual([]);
      expect(entity.experience).toEqual([]);
      expect(entity.education).toEqual([]);
      expect(entity.summary).toBeUndefined();
    });
  });

  describe('round-trip', () => {
    it('toPersistence then toDomain preserves data', () => {
      const original = makeEntity();
      const persisted = StructuredResumeMapper.toPersistence(original);
      const restored = StructuredResumeMapper.toDomain(persisted);

      expect(restored.id).toBe(original.id);
      expect(restored.resumeId).toBe(original.resumeId);
      expect(restored.sourceHash).toBe(original.sourceHash);
      expect(restored.extractionVersion).toBe(original.extractionVersion);
      expect(restored.extractionStatus).toBe(original.extractionStatus);
      expect(restored.summary).toBe(original.summary);
      expect(restored.skills).toEqual([...original.skills]);
      expect(restored.technologies).toEqual([...original.technologies]);
      expect(restored.experience).toHaveLength(original.experience.length);
      expect(restored.education).toHaveLength(original.education.length);
    });
  });
});
