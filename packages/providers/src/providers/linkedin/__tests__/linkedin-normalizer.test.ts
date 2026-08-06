import { describe, it, expect } from 'vitest';
import { LinkedInNormalizer } from '../linkedin-normalizer.js';
import type { MappedJob } from '../../../interfaces/mapper.js';

describe('LinkedInNormalizer', () => {
  const normalizer = new LinkedInNormalizer();

  const createMappedJob = (overrides: Partial<MappedJob> = {}): MappedJob => ({
    sourceId: '12345',
    title: 'Senior TypeScript Developer',
    description: 'Build web applications with TypeScript and React',
    companyName: 'TechCorp',
    location: { raw: 'Berlin, Germany', city: 'Berlin', country: 'Germany' },
    technologies: ['typescript', 'react'],
    url: 'https://www.linkedin.com/jobs/view/12345',
    publishedAt: new Date('2026-07-15'),
    fetchedAt: new Date(),
    remote: false,
    ...overrides,
  });

  describe('providerId', () => {
    it('should be linkedin', () => {
      expect(normalizer.providerId).toBe('linkedin');
    });
  });

  describe('normalize', () => {
    it('should normalize a basic mapped job', () => {
      const mapped = createMappedJob();
      const result = normalizer.normalize(mapped);

      expect(result.id).toBe('linkedin:12345');
      expect(result.source).toBe('linkedin');
      expect(result.sourceId).toBe('12345');
      expect(result.title).toBe('Senior TypeScript Developer');
      expect(result.companyName).toBe('TechCorp');
      expect(result.url).toBe('https://www.linkedin.com/jobs/view/12345');
      expect(result.contentHash).toBeDefined();
      expect(result.normalizedAt).toBeInstanceOf(Date);
    });

    it('should set remote info correctly when remote is true', () => {
      const mapped = createMappedJob({ remote: true });
      const result = normalizer.normalize(mapped);

      expect(result.remote).toEqual({ level: 'remote_only', explicit: true });
    });

    it('should set remote to unknown when remote is false', () => {
      const mapped = createMappedJob({ remote: false });
      const result = normalizer.normalize(mapped);

      expect(result.remote).toEqual({ level: 'unknown', explicit: true });
    });

    it('should set remote to unknown when not specified', () => {
      const mapped = createMappedJob({ remote: undefined });
      const result = normalizer.normalize(mapped);

      expect(result.remote).toEqual({ level: 'unknown', explicit: false });
    });

    it('should normalize technologies to lowercase and deduplicate', () => {
      const mapped = createMappedJob({
        technologies: ['TypeScript', 'typescript', 'React', 'react'],
      });
      const result = normalizer.normalize(mapped);

      expect(result.technologies).toEqual(['typescript', 'react']);
    });

    it('should strip HTML tags from description', () => {
      const mapped = createMappedJob({
        description: 'Build <strong>web applications</strong> with TypeScript',
      });
      const result = normalizer.normalize(mapped);

      expect(result.description).toBe('Build web applications with TypeScript');
    });

    it('should infer experience level from title when not set', () => {
      const mapped = createMappedJob({
        title: 'Senior Developer',
        experienceLevel: undefined,
      });
      const result = normalizer.normalize(mapped);

      expect(result.experienceLevel).toBe('senior');
    });

    it('should use existing experience level when set', () => {
      const mapped = createMappedJob({
        experienceLevel: 'lead',
      });
      const result = normalizer.normalize(mapped);

      expect(result.experienceLevel).toBe('lead');
    });

    it('should infer employment type from title when not set', () => {
      const mapped = createMappedJob({
        title: 'Full-Time Developer',
        employmentType: undefined,
      });
      const result = normalizer.normalize(mapped);

      expect(result.employmentType).toBe('full_time');
    });

    it('should generate a consistent content hash for identical input', () => {
      const mapped = createMappedJob();
      const result1 = normalizer.normalize(mapped);
      const result2 = normalizer.normalize(mapped);

      expect(result1.contentHash).toBe(result2.contentHash);
    });

    it('should generate a different content hash for different jobs', () => {
      const mapped1 = createMappedJob({ title: 'Frontend Developer', sourceId: '1' });
      const mapped2 = createMappedJob({ title: 'Backend Developer', sourceId: '2' });

      const result1 = normalizer.normalize(mapped1);
      const result2 = normalizer.normalize(mapped2);

      expect(result1.contentHash).not.toBe(result2.contentHash);
    });

    it('should handle salary normalization', () => {
      const mapped = createMappedJob({
        salary: { min: 80000, max: 120000, currency: 'USD', period: 'yearly' },
      });
      const result = normalizer.normalize(mapped);

      expect(result.salary).toBeDefined();
      expect(result.salary?.min).toBe(80000);
      expect(result.salary?.max).toBe(120000);
      expect(result.salary?.period).toBe('monthly');
      expect(result.salary?.isEstimate).toBe(true);
    });

    it('should preserve original currency for non-USD salaries', () => {
      const mapped = createMappedJob({
        salary: { min: 60000, max: 90000, currency: 'EUR', period: 'monthly' },
      });
      const result = normalizer.normalize(mapped);

      expect(result.salary?.originalCurrency).toBe('EUR');
      expect(result.salary?.originalMin).toBe(60000);
      expect(result.salary?.originalMax).toBe(90000);
      expect(result.salary?.isEstimate).toBe(false);
    });

    it('should not set originalCurrency for USD salaries', () => {
      const mapped = createMappedJob({
        salary: { min: 80000, max: 120000, currency: 'USD', period: 'monthly' },
      });
      const result = normalizer.normalize(mapped);

      expect(result.salary?.originalCurrency).toBeUndefined();
    });

    it('should set remoteEligible to true for remote jobs', () => {
      const mapped = createMappedJob({ remote: true });
      const result = normalizer.normalize(mapped);

      expect(result.location.remoteEligible).toBe(true);
    });

    it('should set remoteEligible to false for non-remote jobs', () => {
      const mapped = createMappedJob({ remote: false });
      const result = normalizer.normalize(mapped);

      expect(result.location.remoteEligible).toBe(false);
    });

    it('should preserve companySourceId and companyUrl', () => {
      const mapped = createMappedJob({
        companySourceId: 'company-123',
        companyUrl: 'https://www.linkedin.com/company/techcorp',
      });
      const result = normalizer.normalize(mapped);

      expect(result.companySourceId).toBe('company-123');
      expect(result.companyUrl).toBe('https://www.linkedin.com/company/techcorp');
    });
  });

  describe('validate', () => {
    it('should return null for a valid job', () => {
      const mapped = createMappedJob();
      expect(normalizer.validate(mapped)).toBeNull();
    });

    it('should return an error for missing sourceId', () => {
      const result = normalizer.validate(createMappedJob({ sourceId: '' }));
      expect(result?.field).toBe('sourceId');
      expect(result?.severity).toBe('error');
    });

    it('should return an error for missing title', () => {
      const result = normalizer.validate(createMappedJob({ title: '' }));
      expect(result?.field).toBe('title');
      expect(result?.severity).toBe('error');
    });

    it('should return an error for whitespace-only title', () => {
      const result = normalizer.validate(createMappedJob({ title: '   ' }));
      expect(result?.field).toBe('title');
      expect(result?.severity).toBe('error');
    });

    it('should return an error for missing company name', () => {
      const result = normalizer.validate(createMappedJob({ companyName: '' }));
      expect(result?.field).toBe('companyName');
      expect(result?.severity).toBe('error');
    });

    it('should return an error for missing url', () => {
      const result = normalizer.validate(createMappedJob({ url: '' }));
      expect(result?.field).toBe('url');
      expect(result?.severity).toBe('error');
    });

    it('should return an error for missing publishedAt', () => {
      const result = normalizer.validate(createMappedJob({ publishedAt: undefined as unknown as Date }));
      expect(result?.field).toBe('publishedAt');
      expect(result?.severity).toBe('error');
    });
  });
});
