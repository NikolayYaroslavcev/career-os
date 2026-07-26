import { describe, it, expect } from 'vitest';
import { AdzunaNormalizer } from '../adzuna-normalizer.js';
import type { MappedJob } from '../../../interfaces/mapper.js';

describe('AdzunaNormalizer', () => {
  const normalizer = new AdzunaNormalizer();

  const createMappedJob = (overrides: Partial<MappedJob> = {}): MappedJob => ({
    sourceId: '12345',
    title: 'Senior React Developer',
    description: 'We are looking for a Senior React Developer.',
    companyName: 'Acme Corp',
    location: { raw: 'London, UK' },
    technologies: ['react', 'javascript', 'typescript'],
    url: 'https://adzuna.co.uk/jobs/land/ad/12345',
    publishedAt: new Date('2026-07-15'),
    fetchedAt: new Date(),
    ...overrides,
  });

  describe('normalize', () => {
    it('should normalize a basic mapped job', () => {
      const mapped = createMappedJob();
      const result = normalizer.normalize(mapped);

      expect(result.id).toBe('adzuna:12345');
      expect(result.source).toBe('adzuna');
      expect(result.sourceId).toBe('12345');
      expect(result.title).toBe('Senior React Developer');
      expect(result.companyName).toBe('Acme Corp');
      expect(result.url).toBe('https://adzuna.co.uk/jobs/land/ad/12345');
      expect(result.contentHash).toBeDefined();
      expect(result.normalizedAt).toBeInstanceOf(Date);
    });

    it('should set remote info correctly', () => {
      const mapped = createMappedJob({ remote: true });
      const result = normalizer.normalize(mapped);

      expect(result.remote).toEqual({ level: 'remote_only', explicit: true });
    });

    it('should set remote to unknown when not specified', () => {
      const mapped = createMappedJob({ remote: undefined });
      const result = normalizer.normalize(mapped);

      expect(result.remote).toEqual({ level: 'unknown', explicit: false });
    });

    it('should normalize salary to monthly', () => {
      const mapped = createMappedJob({
        salary: {
          min: 50000,
          max: 70000,
          currency: 'GBP',
          period: 'yearly',
        },
      });

      const result = normalizer.normalize(mapped);

      expect(result.salary).toBeDefined();
      expect(result.salary?.min).toBe(50000);
      expect(result.salary?.max).toBe(70000);
      expect(result.salary?.period).toBe('monthly');
      expect(result.salary?.isEstimate).toBe(true);
    });

    it('should preserve original currency for non-USD', () => {
      const mapped = createMappedJob({
        salary: {
          min: 40000,
          max: 60000,
          currency: 'GBP',
          period: 'yearly',
        },
      });

      const result = normalizer.normalize(mapped);

      expect(result.salary?.originalCurrency).toBe('GBP');
      expect(result.salary?.originalMin).toBe(40000);
      expect(result.salary?.originalMax).toBe(60000);
    });

    it('should normalize technologies to lowercase', () => {
      const mapped = createMappedJob({
        technologies: ['React', 'JavaScript', 'TypeScript'],
      });

      const result = normalizer.normalize(mapped);

      expect(result.technologies).toEqual(['react', 'javascript', 'typescript']);
    });

    it('should deduplicate technologies', () => {
      const mapped = createMappedJob({
        technologies: ['react', 'react', 'javascript'],
      });

      const result = normalizer.normalize(mapped);

      expect(result.technologies).toEqual(['react', 'javascript']);
    });

    it('should strip HTML from title', () => {
      const mapped = createMappedJob({
        title: '<b>Senior</b> React Developer',
      });

      const result = normalizer.normalize(mapped);

      expect(result.title).toBe('Senior React Developer');
    });

    it('should strip HTML from description', () => {
      const mapped = createMappedJob({
        description: '<p>We are <b>looking</b> for a developer.</p>',
      });

      const result = normalizer.normalize(mapped);

      expect(result.description).toBe('We are looking for a developer.');
    });

    it('should infer experience level from title', () => {
      const mapped = createMappedJob({
        title: 'Engineering Lead',
        description: 'Lead our engineering team.',
      });
      const result = normalizer.normalize(mapped);

      expect(result.experienceLevel).toBe('lead');
    });

    it('should infer employment type from title', () => {
      const mapped = createMappedJob({ title: 'Contract Developer' });
      const result = normalizer.normalize(mapped);

      expect(result.employmentType).toBe('contract');
    });

    it('should generate consistent content hash', () => {
      const mapped = createMappedJob();
      const result1 = normalizer.normalize(mapped);
      const result2 = normalizer.normalize(mapped);

      expect(result1.contentHash).toBe(result2.contentHash);
    });

    it('should generate different content hash for different jobs', () => {
      const mapped1 = createMappedJob({ title: 'React Developer', sourceId: '1' });
      const mapped2 = createMappedJob({ title: 'Python Developer', sourceId: '2' });

      const result1 = normalizer.normalize(mapped1);
      const result2 = normalizer.normalize(mapped2);

      expect(result1.contentHash).not.toBe(result2.contentHash);
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
      expect(result?.severity).toBe('error');
    });

    it('should return error for missing title', () => {
      const mapped = createMappedJob({ title: '' });
      const result = normalizer.validate(mapped);

      expect(result).not.toBeNull();
      expect(result?.field).toBe('title');
      expect(result?.severity).toBe('error');
    });

    it('should return error for missing company name', () => {
      const mapped = createMappedJob({ companyName: '' });
      const result = normalizer.validate(mapped);

      expect(result).not.toBeNull();
      expect(result?.field).toBe('companyName');
      expect(result?.severity).toBe('error');
    });

    it('should return error for missing URL', () => {
      const mapped = createMappedJob({ url: '' });
      const result = normalizer.validate(mapped);

      expect(result).not.toBeNull();
      expect(result?.field).toBe('url');
      expect(result?.severity).toBe('error');
    });

    it('should return error for missing publishedAt', () => {
      const mapped = createMappedJob({ publishedAt: undefined as unknown as Date });
      const result = normalizer.validate(mapped);

      expect(result).not.toBeNull();
      expect(result?.field).toBe('publishedAt');
      expect(result?.severity).toBe('error');
    });
  });
});
