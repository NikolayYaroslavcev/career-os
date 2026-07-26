import { describe, it, expect } from 'vitest';
import { AdzunaMapper } from '../adzuna-mapper.js';
import type { RawJob } from '../../../interfaces/raw-job.js';

describe('AdzunaMapper', () => {
  const mapper = new AdzunaMapper();

  describe('map', () => {
    it('should map a basic raw job to mapped job', () => {
      const raw: RawJob = {
        sourceId: '12345',
        title: 'Senior React Developer',
        description: '<p>We are looking for a Senior React Developer.</p>',
        companyName: 'Acme Corp',
        location: 'London, UK',
        technologies: [],
        url: 'https://adzuna.co.uk/jobs/land/ad/12345',
        publishedAt: new Date('2026-07-15'),
        fetchedAt: new Date(),
        extensions: {
          contractType: 'permanent',
          contractTime: 'full_time',
        },
      };

      const result = mapper.map(raw);

      expect(result.sourceId).toBe('12345');
      expect(result.title).toBe('Senior React Developer');
      expect(result.description).toBe('We are looking for a Senior React Developer.');
      expect(result.companyName).toBe('Acme Corp');
      expect(result.url).toBe('https://adzuna.co.uk/jobs/land/ad/12345');
      expect(result.remote).toBe(false);
      expect(result.publishedAt).toEqual(new Date('2026-07-15'));
    });

    it('should parse location with city and country', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Developer',
        description: 'desc',
        companyName: 'Company',
        location: 'London, Greater London',
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.location.raw).toBe('London, Greater London');
      expect(result.location.city).toBe('London');
      expect(result.location.country).toBe('Greater London');
    });

    it('should handle empty location', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Developer',
        description: 'desc',
        companyName: 'Company',
        location: '',
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.location.raw).toBe('Unknown');
    });

    it('should infer experience level from title', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Senior React Developer',
        description: 'desc',
        companyName: 'Company',
        location: 'London',
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.experienceLevel).toBe('senior');
    });

    it('should infer junior level from description', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Web Developer',
        description: 'Looking for a junior developer',
        companyName: 'Company',
        location: 'London',
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.experienceLevel).toBe('junior');
    });

    it('should infer employment type from extensions', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Developer',
        description: 'desc',
        companyName: 'Company',
        location: 'London',
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
        extensions: {
          contractType: 'permanent',
          contractTime: 'full_time',
        },
      };

      const result = mapper.map(raw);

      expect(result.employmentType).toBe('full_time');
    });

    it('should infer part_time from extensions', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Developer',
        description: 'desc',
        companyName: 'Company',
        location: 'London',
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
        extensions: {
          contractTime: 'part_time',
        },
      };

      const result = mapper.map(raw);

      expect(result.employmentType).toBe('part_time');
    });

    it('should extract technologies from description', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Developer',
        description: 'We need Python and React experience. AWS preferred.',
        companyName: 'Company',
        location: 'London',
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.technologies).toContain('python');
      expect(result.technologies).toContain('react');
      expect(result.technologies).toContain('aws');
    });

    it('should map salary information', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Developer',
        description: 'desc',
        companyName: 'Company',
        location: 'London',
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
        salary: {
          from: 50000,
          to: 70000,
          currency: 'GBP',
          period: 'yearly',
        },
      };

      const result = mapper.map(raw);

      expect(result.salary).toEqual({
        min: 50000,
        max: 70000,
        currency: 'GBP',
        period: 'yearly',
      });
    });

    it('should strip HTML from description', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Developer',
        description: '<p>We are <b>looking</b> for a developer.</p>',
        companyName: 'Company',
        location: 'London',
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.description).toBe('We are looking for a developer.');
    });

    it('should normalize title whitespace', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: '  Senior   React   Developer  ',
        description: 'desc',
        companyName: 'Company',
        location: 'London',
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.title).toBe('Senior React Developer');
    });
  });
});
