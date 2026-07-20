import { describe, it, expect } from 'vitest';
import { HHNormalizer } from '../hh-normalizer.js';
import type { MappedJob } from '../../../interfaces/mapper.js';

describe('HHNormalizer', () => {
  const normalizer = new HHNormalizer();

  const createMappedJob = (overrides: Partial<MappedJob> = {}): MappedJob => ({
    sourceId: '98765432',
    title: 'Frontend Developer (React)',
    description: 'Разработка UI на React.',
    companyName: 'Tech Company LLC',
    location: { raw: 'Москва', city: 'Москва' },
    technologies: ['react', 'typescript'],
    url: 'https://hh.ru/vacancy/98765432',
    publishedAt: new Date('2026-07-15'),
    fetchedAt: new Date(),
    ...overrides,
  });

  describe('providerId', () => {
    it('should be hh', () => {
      expect(normalizer.providerId).toBe('hh');
    });
  });

  describe('normalize', () => {
    it('should normalize a basic mapped job', () => {
      const mapped = createMappedJob();
      const result = normalizer.normalize(mapped);

      expect(result.id).toBe('hh:98765432');
      expect(result.source).toBe('hh');
      expect(result.sourceId).toBe('98765432');
      expect(result.title).toBe('Frontend Developer (React)');
      expect(result.companyName).toBe('Tech Company LLC');
      expect(result.url).toBe('https://hh.ru/vacancy/98765432');
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

    it('should keep RUR salary already-monthly with no estimate flag and preserve original currency', () => {
      const mapped = createMappedJob({
        salary: {
          min: 200000,
          max: 300000,
          currency: 'RUR',
          period: 'monthly',
        },
      });

      const result = normalizer.normalize(mapped);

      expect(result.salary).toBeDefined();
      expect(result.salary?.min).toBe(200000);
      expect(result.salary?.max).toBe(300000);
      expect(result.salary?.period).toBe('monthly');
      expect(result.salary?.isEstimate).toBe(false);
      expect(result.salary?.originalCurrency).toBe('RUR');
    });

    it('should normalize technologies to lowercase and deduplicate', () => {
      const mapped = createMappedJob({
        technologies: ['React', 'react', 'TypeScript'],
      });

      const result = normalizer.normalize(mapped);

      expect(result.technologies).toEqual(['react', 'typescript']);
    });

    it('should strip highlighttext/HTML tags from description', () => {
      const mapped = createMappedJob({
        description: 'Опыт работы с <highlighttext>React</highlighttext> от 2 лет.',
      });

      const result = normalizer.normalize(mapped);

      expect(result.description).toBe('Опыт работы с React от 2 лет.');
    });

    it('should infer experience level from a Russian title when unset', () => {
      const mapped = createMappedJob({
        title: 'Старший разработчик',
        experienceLevel: undefined,
      });
      const result = normalizer.normalize(mapped);

      expect(result.experienceLevel).toBe('senior');
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
  });
});
