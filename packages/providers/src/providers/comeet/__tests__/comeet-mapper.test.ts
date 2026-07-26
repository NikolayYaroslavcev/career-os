import { describe, it, expect } from 'vitest';
import { ComeetMapper } from '../comeet-mapper.js';
import type { RawJob } from '../../../interfaces/raw-job.js';

describe('ComeetMapper', () => {
  const mapper = new ComeetMapper('Test Company');

  describe('map', () => {
    it('should map a basic raw job to mapped job', () => {
      const raw: RawJob = {
        sourceId: 'abc-123',
        title: 'Senior React Developer',
        description: '<p>We are looking for a Senior React Developer.</p>',
        companyName: 'Unknown',
        location: 'Tel Aviv, Israel',
        technologies: [],
        url: 'https://comeet.co/jobs/abc-123',
        publishedAt: new Date('2026-07-15'),
        fetchedAt: new Date(),
        remote: true,
      };

      const result = mapper.map(raw);

      expect(result.sourceId).toBe('abc-123');
      expect(result.title).toBe('Senior React Developer');
      expect(result.description).toBe('We are looking for a Senior React Developer.');
      expect(result.companyName).toBe('Test Company');
      expect(result.remote).toBe(true);
    });

    it('should infer employment type from extension', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Developer',
        description: 'desc',
        companyName: 'Unknown',
        location: 'Tel Aviv',
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
        extensions: {
          employmentType: 'full_time',
        },
      };

      const result = mapper.map(raw);

      expect(result.employmentType).toBe('full_time');
    });

    it('should extract technologies from description', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Developer',
        description: 'We need Python and React experience.',
        companyName: 'Unknown',
        location: 'Tel Aviv',
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.technologies).toContain('python');
      expect(result.technologies).toContain('react');
    });

    it('should map salary information', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Developer',
        description: 'desc',
        companyName: 'Unknown',
        location: 'Tel Aviv',
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
        salary: {
          from: 50000,
          to: 70000,
          currency: 'USD',
          period: 'yearly',
        },
      };

      const result = mapper.map(raw);

      expect(result.salary).toEqual({
        min: 50000,
        max: 70000,
        currency: 'USD',
        period: 'yearly',
      });
    });
  });
});
