import { describe, it, expect } from 'vitest';
import { SmartRecruitersMapper } from '../smartrecruiters-mapper.js';
import type { RawJob } from '../../../interfaces/raw-job.js';

describe('SmartRecruitersMapper', () => {
  const mapper = new SmartRecruitersMapper('Test Company');

  describe('map', () => {
    it('should map a basic raw job to mapped job', () => {
      const raw: RawJob = {
        sourceId: '12345',
        title: 'Senior React Developer',
        description: '<p>We are looking for a Senior React Developer.</p>',
        companyName: 'Engineering',
        location: 'London, UK',
        technologies: [],
        url: 'https://smartrecruiters.com/jobs/12345',
        publishedAt: new Date('2026-07-15'),
        fetchedAt: new Date(),
      };

      const result = mapper.map(raw);

      expect(result.sourceId).toBe('12345');
      expect(result.title).toBe('Senior React Developer');
      expect(result.description).toBe('We are looking for a Senior React Developer.');
      expect(result.companyName).toBe('Engineering');
      expect(result.url).toBe('https://smartrecruiters.com/jobs/12345');
      expect(result.remote).toBe(false);
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

    it('should infer experience level from API extension', () => {
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
          experienceLevel: 'Senior',
        },
      };

      const result = mapper.map(raw);

      expect(result.experienceLevel).toBe('senior');
    });

    it('should infer experience level from title', () => {
      const raw: RawJob = {
        sourceId: '1',
        title: 'Junior Developer',
        description: 'desc',
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

    it('should infer employment type from API extension', () => {
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
          employmentType: 'Full Time',
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
  });
});
