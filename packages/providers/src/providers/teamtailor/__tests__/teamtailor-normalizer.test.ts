import { describe, it, expect } from 'vitest';
import { TeamtailorNormalizer } from '../teamtailor-normalizer.js';
import { TeamtailorMapper } from '../teamtailor-mapper.js';
import type { RawJob } from '../../../interfaces/raw-job.js';

describe('TeamtailorNormalizer', () => {
  const normalizer = new TeamtailorNormalizer();
  const mapper = new TeamtailorMapper();

  it('should have correct providerId', () => {
    expect(normalizer.providerId).toBe('teamtailor');
  });

  it('should validate required fields', () => {
    const validJob = {
      sourceId: '1',
      title: 'Developer',
      description: 'desc',
      companyName: 'Company',
      location: { raw: 'Remote' },
      technologies: [],
      url: 'https://example.com',
      publishedAt: new Date(),
      fetchedAt: new Date(),
    };

    expect(normalizer.validate(validJob)).toBeNull();
    expect(normalizer.validate({ ...validJob, sourceId: '' })).not.toBeNull();
    expect(normalizer.validate({ ...validJob, title: '' })).not.toBeNull();
    expect(normalizer.validate({ ...validJob, companyName: '' })).not.toBeNull();
    expect(normalizer.validate({ ...validJob, url: '' })).not.toBeNull();
  });

  it('should normalize a mapped job into a NormalizedVacancy using the shared pipeline', () => {
    const raw: RawJob = {
      sourceId: '998877',
      title: 'Backend Engineer',
      description: '<p>Join our backend team.</p>',
      companyName: 'Acme Corp',
      location: 'Remote - Sweden',
      technologies: [],
      url: 'https://careers.acme.com/jobs/998877-backend-engineer',
      publishedAt: new Date('2026-07-02'),
      fetchedAt: new Date(),
      remote: true,
      employmentType: 'full_time',
      experienceLevel: 'senior',
    };

    const normalized = normalizer.normalize(mapper.map(raw));

    expect(normalized.source).toBe('teamtailor');
    expect(normalized.sourceId).toBe('998877');
    expect(normalized.id).toBe('teamtailor:998877');
    expect(normalized.experienceLevel).toBe('senior');
    expect(normalized.employmentType).toBe('full_time');
    expect(normalized.remote.level).toBe('remote_only');
    expect(normalized.contentHash).toBeTruthy();
  });

  it('should infer experienceLevel from text when Teamtailor could not provide a canonical employment-level', () => {
    const raw: RawJob = {
      sourceId: '998879',
      title: 'Junior Seasonal Support Specialist',
      description: '<p>Short-term support role during peak season.</p>',
      companyName: 'Acme Corp',
      location: 'Remote - EU',
      technologies: [],
      url: 'https://careers.acme.com/jobs/998879-seasonal-support-specialist',
      publishedAt: new Date('2026-06-28'),
      fetchedAt: new Date(),
      remote: true,
    };

    const normalized = normalizer.normalize(mapper.map(raw));

    expect(normalized.experienceLevel).toBe('junior');
  });
});
