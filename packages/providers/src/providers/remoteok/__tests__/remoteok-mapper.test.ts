import { describe, it, expect } from 'vitest';
import { RemoteOKMapper } from '../remoteok-mapper.js';
import type { RawJob } from '../../../interfaces/raw-job.js';

describe('RemoteOKMapper', () => {
  const mapper = new RemoteOKMapper();

  describe('map', () => {
    it('should map a basic raw job to mapped job', () => {
      const raw: RawJob = {
        sourceId: '12345',
        title: 'Senior React Developer',
        description: '<p>We are looking for a Senior React Developer.</p>',
        companyName: 'Acme Corp',
        location: 'Worldwide',
        technologies: ['react', 'javascript'],
        url: 'https://remoteok.com/remote-jobs/12345',
        publishedAt: new Date('2026-07-15'),
        remote: true,
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.sourceId).toBe('12345');
      expect(result.title).toBe('Senior React Developer');
      expect(result.description).toBe('We are looking for a Senior React Developer.');
      expect(result.companyName).toBe('Acme Corp');
      expect(result.url).toBe('https://remoteok.com/remote-jobs/12345');
      expect(result.remote).toBe(true);
      expect(result.publishedAt).toEqual(new Date('2026-07-15'));
    });

    it('should parse location with city and country', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Developer',
        description: 'desc',
        companyName: 'Company',
        location: 'Berlin, Germany',
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.location.raw).toBe('Berlin, Germany');
      expect(result.location.city).toBe('Berlin');
      expect(result.location.country).toBe('Germany');
    });

    it('should handle Worldwide location', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Developer',
        description: 'desc',
        companyName: 'Company',
        location: 'Worldwide',
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.location.raw).toBe('Worldwide');
      expect(result.location.city).toBe('Worldwide');
      expect(result.location.country).toBeUndefined();
    });

    it('should infer experience level from title', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Senior React Developer',
        description: 'desc',
        companyName: 'Company',
        location: 'Worldwide',
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
        location: 'Worldwide',
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.experienceLevel).toBe('junior');
    });

    it('should infer employment type from title', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Full-time Developer',
        description: 'desc',
        companyName: 'Company',
        location: 'Worldwide',
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.employmentType).toBe('full_time');
    });

    it('should deduplicate technologies', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Developer',
        description: 'desc',
        companyName: 'Company',
        location: 'Worldwide',
        technologies: ['react', 'react', 'javascript'],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.technologies).toEqual(['react', 'javascript']);
    });

    it('should map salary information', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Developer',
        description: 'desc',
        companyName: 'Company',
        location: 'Worldwide',
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
        salary: {
          from: 80000,
          to: 120000,
          currency: 'USD',
          period: 'yearly',
        },
      };

      const result = mapper.map(raw);

      expect(result.salary).toEqual({
        min: 80000,
        max: 120000,
        currency: 'USD',
        period: 'yearly',
      });
    });
  });
});
