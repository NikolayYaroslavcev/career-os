import { describe, it, expect } from 'vitest';
import { StructuredResume } from './structured-resume.js';
import { createResumeId, createStructuredResumeId } from '../base/identifier.js';

describe('StructuredResume', () => {
  const resumeId = createResumeId('resume-1');
  const structuredId = createStructuredResumeId('sr-1');

  describe('create', () => {
    it('creates a pending extraction with empty collections', () => {
      const sr = StructuredResume.create({
        id: structuredId,
        resumeId,
        sourceHash: 'abc123',
        extractionVersion: 'v1',
      });

      expect(sr.id).toBe(structuredId);
      expect(sr.resumeId).toBe(resumeId);
      expect(sr.sourceHash).toBe('abc123');
      expect(sr.extractionVersion).toBe('v1');
      expect(sr.extractionStatus).toBe('pending');
      expect(sr.skills).toEqual([]);
      expect(sr.technologies).toEqual([]);
      expect(sr.experience).toEqual([]);
      expect(sr.education).toEqual([]);
      expect(sr.failureReason).toBeUndefined();
      expect(sr.extractedAt).toBeUndefined();
      expect(sr.summary).toBeUndefined();
    });

    it('stores optional extractionModel', () => {
      const sr = StructuredResume.create({
        id: structuredId,
        resumeId,
        sourceHash: 'abc123',
        extractionVersion: 'v1',
        extractionModel: 'gpt-4o',
      });

      expect(sr.extractionModel).toBe('gpt-4o');
    });
  });

  describe('reconstitute', () => {
    it('restores all props from persistence', () => {
      const now = new Date();
      const sr = StructuredResume.reconstitute(structuredId, {
        resumeId,
        sourceHash: 'abc123',
        extractionVersion: 'v1',
        extractionModel: 'gpt-4o',
        extractionStatus: 'completed',
        extractedAt: now,
        summary: 'Senior engineer',
        seniorityLevel: 'senior',
        totalYearsOfExperience: 8,
        skills: ['TypeScript', 'React'],
        technologies: ['Node.js', 'PostgreSQL'],
        experience: [
          {
            company: 'Acme',
            position: 'Engineer',
            startDate: new Date('2020-01-01'),
            description: 'Built stuff',
            bullets: ['Built stuff'],
            technologies: ['TypeScript'],
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
        certifications: ['AWS Certified'],
        languages: ['English — fluent'],
        createdAt: now,
        updatedAt: now,
      });

      expect(sr.extractionStatus).toBe('completed');
      expect(sr.summary).toBe('Senior engineer');
      expect(sr.seniorityLevel).toBe('senior');
      expect(sr.totalYearsOfExperience).toBe(8);
      expect(sr.skills).toEqual(['TypeScript', 'React']);
      expect(sr.technologies).toEqual(['Node.js', 'PostgreSQL']);
      expect(sr.experience).toHaveLength(1);
      expect(sr.experience[0]!.company).toBe('Acme');
      expect(sr.education).toHaveLength(1);
      expect(sr.education[0]!.institution).toBe('MIT');
    });
  });

  describe('isFreshFor', () => {
    function makeCompleted(hash: string, version: string) {
      return StructuredResume.reconstitute(structuredId, {
        resumeId,
        sourceHash: hash,
        extractionVersion: version,
        extractionStatus: 'completed',
        skills: [],
        technologies: [],
        experience: [],
        education: [],
        certifications: [],
        languages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    it('returns true when hash and version match and status is completed', () => {
      const sr = makeCompleted('abc', 'v1');
      expect(sr.isFreshFor('abc', 'v1')).toBe(true);
    });

    it('returns false when hash differs', () => {
      const sr = makeCompleted('abc', 'v1');
      expect(sr.isFreshFor('xyz', 'v1')).toBe(false);
    });

    it('returns false when version differs', () => {
      const sr = makeCompleted('abc', 'v1');
      expect(sr.isFreshFor('abc', 'v2')).toBe(false);
    });

    it('returns false when status is not completed', () => {
      const sr = StructuredResume.reconstitute(structuredId, {
        resumeId,
        sourceHash: 'abc',
        extractionVersion: 'v1',
        extractionStatus: 'pending',
        skills: [],
        technologies: [],
        experience: [],
        education: [],
        certifications: [],
        languages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(sr.isFreshFor('abc', 'v1')).toBe(false);
    });

    it('returns false when status is failed', () => {
      const sr = StructuredResume.reconstitute(structuredId, {
        resumeId,
        sourceHash: 'abc',
        extractionVersion: 'v1',
        extractionStatus: 'failed',
        failureReason: 'error',
        skills: [],
        technologies: [],
        experience: [],
        education: [],
        certifications: [],
        languages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(sr.isFreshFor('abc', 'v1')).toBe(false);
    });
  });

  describe('markCompleted', () => {
    it('transitions status and populates extracted fields', () => {
      const sr = StructuredResume.create({
        id: structuredId,
        resumeId,
        sourceHash: 'abc',
        extractionVersion: 'v1',
      });

      sr.markCompleted({
        summary: 'Full-stack dev',
        seniorityLevel: 'mid',
        totalYearsOfExperience: 5,
        skills: ['TypeScript'],
        technologies: ['React'],
        experience: [],
        education: [],
      });

      expect(sr.extractionStatus).toBe('completed');
      expect(sr.summary).toBe('Full-stack dev');
      expect(sr.seniorityLevel).toBe('mid');
      expect(sr.totalYearsOfExperience).toBe(5);
      expect(sr.extractedAt).toBeInstanceOf(Date);
      expect(sr.version).toBe(1);
    });

    it('optionally updates extractionModel', () => {
      const sr = StructuredResume.create({
        id: structuredId,
        resumeId,
        sourceHash: 'abc',
        extractionVersion: 'v1',
      });

      sr.markCompleted({
        summary: 'Dev',
        seniorityLevel: 'junior',
        totalYearsOfExperience: 2,
        skills: [],
        technologies: [],
        experience: [],
        education: [],
        extractionModel: 'claude-3',
      });

      expect(sr.extractionModel).toBe('claude-3');
    });
  });

  describe('markFailed', () => {
    it('transitions status and stores failure reason', () => {
      const sr = StructuredResume.create({
        id: structuredId,
        resumeId,
        sourceHash: 'abc',
        extractionVersion: 'v1',
      });

      sr.markFailed('AI provider timeout');

      expect(sr.extractionStatus).toBe('failed');
      expect(sr.failureReason).toBe('AI provider timeout');
      expect(sr.version).toBe(1);
    });
  });
});
