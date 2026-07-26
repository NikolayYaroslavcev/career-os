import { describe, it, expect } from 'vitest';
import { SmartRecruitersNormalizer } from '../smartrecruiters-normalizer.js';
import type { MappedJob } from '../../../interfaces/mapper.js';

describe('SmartRecruitersNormalizer', () => {
  const normalizer = new SmartRecruitersNormalizer();

  const createMappedJob = (overrides: Partial<MappedJob> = {}): MappedJob => ({
    sourceId: '12345',
    title: 'Senior React Developer',
    description: 'We are looking for a Senior React Developer.',
    companyName: 'Test Company',
    location: { raw: 'London, UK' },
    technologies: ['react', 'javascript'],
    url: 'https://smartrecruiters.com/jobs/12345',
    publishedAt: new Date('2026-07-15'),
    fetchedAt: new Date(),
    ...overrides,
  });

  describe('normalize', () => {
    it('should normalize a basic mapped job', () => {
      const mapped = createMappedJob();
      const result = normalizer.normalize(mapped);

      expect(result.id).toBe('smartrecruiters:12345');
      expect(result.source).toBe('smartrecruiters');
      expect(result.sourceId).toBe('12345');
      expect(result.title).toBe('Senior React Developer');
      expect(result.companyName).toBe('Test Company');
      expect(result.url).toBe('https://smartrecruiters.com/jobs/12345');
      expect(result.contentHash).toBeDefined();
      expect(result.normalizedAt).toBeInstanceOf(Date);
    });

    it('should set remote info correctly', () => {
      const mapped = createMappedJob({ remote: true });
      const result = normalizer.normalize(mapped);

      expect(result.remote).toEqual({ level: 'remote_only', explicit: true });
    });

    it('should normalize technologies to lowercase', () => {
      const mapped = createMappedJob({
        technologies: ['React', 'JavaScript'],
      });

      const result = normalizer.normalize(mapped);

      expect(result.technologies).toEqual(['react', 'javascript']);
    });

    it('should generate consistent content hash', () => {
      const mapped = createMappedJob();
      const result1 = normalizer.normalize(mapped);
      const result2 = normalizer.normalize(mapped);

      expect(result1.contentHash).toBe(result2.contentHash);
    });
  });

  describe('validate', () => {
    it('should return null for valid job', () => {
      const mapped = createMappedJob();
      const result = normalizer.validate(mapped);

      expect(result).toBeNull();
    });

    it('should return error for missing sourceId', () => {
      const mapped = createMappedJob({ sourceId: '' });
      const result = normalizer.validate(mapped);

      expect(result).not.toBeNull();
      expect(result?.field).toBe('sourceId');
    });

    it('should return error for missing title', () => {
      const mapped = createMappedJob({ title: '' });
      const result = normalizer.validate(mapped);

      expect(result).not.toBeNull();
      expect(result?.field).toBe('title');
    });

    it('should return error for missing company name', () => {
      const mapped = createMappedJob({ companyName: '' });
      const result = normalizer.validate(mapped);

      expect(result).not.toBeNull();
      expect(result?.field).toBe('companyName');
    });

    it('should return error for missing URL', () => {
      const mapped = createMappedJob({ url: '' });
      const result = normalizer.validate(mapped);

      expect(result).not.toBeNull();
      expect(result?.field).toBe('url');
    });
  });
});
