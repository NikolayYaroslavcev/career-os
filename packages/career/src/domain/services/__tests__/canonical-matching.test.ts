import { describe, it, expect } from 'vitest';
import { CanonicalMatchingServiceImpl } from '../canonical-matching-service-impl.js';

describe('CanonicalMatchingServiceImpl', () => {
  const service = new CanonicalMatchingServiceImpl();

  describe('computeMatchScore', () => {
    it('returns 1.0 for identical vacancies', () => {
      const score = service.computeMatchScore(
        { title: 'Software Engineer', companyName: 'Google', location: 'Mountain View', remote: 'hybrid' },
        { title: 'Software Engineer', companyName: 'Google', location: 'Mountain View', remote: 'hybrid' }
      );
      expect(score).toBeGreaterThanOrEqual(0.9);
    });

    it('returns high score for similar title and company', () => {
      const score = service.computeMatchScore(
        { title: 'Senior Software Engineer', companyName: 'Google Inc' },
        { title: 'Senior Software Engineer', companyName: 'Google' }
      );
      expect(score).toBeGreaterThan(0.6);
    });

    it('returns low score for different jobs', () => {
      const score = service.computeMatchScore(
        { title: 'Software Engineer', companyName: 'Google', location: 'Mountain View', remote: 'remote' },
        { title: 'Marketing Manager', companyName: 'Apple', location: 'Cupertino', remote: 'onsite' }
      );
      expect(score).toBeLessThan(0.5);
    });

    it('handles missing location gracefully', () => {
      const score = service.computeMatchScore(
        { title: 'Software Engineer', companyName: 'Google' },
        { title: 'Software Engineer', companyName: 'Google' }
      );
      expect(score).toBeGreaterThanOrEqual(0.8);
    });

    it('penalizes different remote types', () => {
      const score = service.computeMatchScore(
        { title: 'Engineer', companyName: 'Corp', remote: 'remote' },
        { title: 'Engineer', companyName: 'Corp', remote: 'onsite' }
      );
      expect(score).toBeLessThan(0.8);
    });

    it('rewards matching employment types', () => {
      const match = service.computeMatchScore(
        { title: 'Engineer', companyName: 'Corp', employmentType: 'full_time' },
        { title: 'Engineer', companyName: 'Corp', employmentType: 'full_time' }
      );
      const noMatch = service.computeMatchScore(
        { title: 'Engineer', companyName: 'Corp', employmentType: 'full_time' },
        { title: 'Engineer', companyName: 'Corp', employmentType: 'contract' }
      );
      expect(match).toBeGreaterThan(noMatch);
    });

    it('handles overlapping salary ranges', () => {
      const score = service.computeMatchScore(
        { title: 'Engineer', companyName: 'Corp', salaryMin: 100000, salaryMax: 150000 },
        { title: 'Engineer', companyName: 'Corp', salaryMin: 120000, salaryMax: 180000 }
      );
      expect(score).toBeGreaterThan(0.8);
    });

    it('handles non-overlapping salary ranges', () => {
      const score = service.computeMatchScore(
        { title: 'Engineer', companyName: 'Corp', salaryMin: 100000, salaryMax: 120000 },
        { title: 'Engineer', companyName: 'Corp', salaryMin: 200000, salaryMax: 250000 }
      );
      expect(score).toBeLessThan(0.8);
    });
  });
});
