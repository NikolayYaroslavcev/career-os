import { describe, it, expect } from 'vitest';
import { RecruiteeMapper } from '../recruitee-mapper.js';
import type { RawJob } from '../../../interfaces/raw-job.js';

describe('RecruiteeMapper', () => {
  const mapper = new RecruiteeMapper('Test Company');

  describe('map', () => {
    it('should map a basic raw job to mapped job', () => {
      const raw: RawJob = {
        sourceId: '12345',
        title: 'Senior React Developer',
        description: '<p>We are looking for a Senior React Developer.</p>',
        companyName: 'Unknown',
        location: 'Amsterdam, NL',
        technologies: [],
        url: 'https://recruitee.com/jobs/12345',
        publishedAt: new Date('2026-07-15'),
        fetchedAt: new Date(),
        remote: true,
      };

      const result = mapper.map(raw);

      expect(result.sourceId).toBe('12345');
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
        location: 'Amsterdam',
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
        location: 'Amsterdam',
        technologies: [],
        url: 'https://example.com',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.technologies).toContain('python');
      expect(result.technologies).toContain('react');
    });
  });
});
