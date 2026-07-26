import { describe, it, expect } from 'vitest';
import { WorkdayNormalizer } from '../workday-normalizer.js';
import { WorkdayMapper } from '../workday-mapper.js';
import type { RawJob } from '../../../interfaces/raw-job.js';

describe('WorkdayNormalizer', () => {
  const normalizer = new WorkdayNormalizer();
  const mapper = new WorkdayMapper();

  it('should have correct providerId', () => {
    expect(normalizer.providerId).toBe('workday');
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
      sourceId: 'R-12347',
      title: 'Senior Product Manager',
      description: 'Remote - Canada — full description available at the listing page (req R-12347).',
      companyName: 'Acme Corp',
      location: 'Remote - Canada',
      technologies: [],
      url: 'https://acme.wd1.myworkdayjobs.com/job/Remote---Canada/Senior-Product-Manager_R-12347',
      publishedAt: new Date('2026-06-20'),
      fetchedAt: new Date(),
      remote: true,
    };

    const normalized = normalizer.normalize(mapper.map(raw));

    expect(normalized.source).toBe('workday');
    expect(normalized.sourceId).toBe('R-12347');
    expect(normalized.id).toBe('workday:R-12347');
    expect(normalized.experienceLevel).toBe('senior');
    expect(normalized.remote.level).toBe('remote_only');
    expect(normalized.contentHash).toBeTruthy();
  });
});
