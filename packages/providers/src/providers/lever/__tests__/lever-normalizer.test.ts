import { describe, it, expect } from 'vitest';
import { LeverNormalizer } from '../lever-normalizer.js';
import { LeverMapper } from '../lever-mapper.js';
import type { RawJob } from '../../../interfaces/raw-job.js';

describe('LeverNormalizer', () => {
  const normalizer = new LeverNormalizer();
  const mapper = new LeverMapper();

  it('should have correct providerId', () => {
    expect(normalizer.providerId).toBe('lever');
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
      sourceId: 'a1b2c3d4-1111-2222-3333-444455556666',
      title: 'Senior Backend Engineer',
      description: '<div>Great <b>role</b>.</div>',
      companyName: 'Acme Corp',
      location: 'Remote - US',
      technologies: ['Go', 'go', 'Kubernetes'],
      url: 'https://jobs.lever.co/acme/a1b2c3d4-1111-2222-3333-444455556666',
      publishedAt: new Date('2026-07-10'),
      fetchedAt: new Date(),
      remote: true,
    };

    const normalized = normalizer.normalize(mapper.map(raw));

    expect(normalized.source).toBe('lever');
    expect(normalized.sourceId).toBe('a1b2c3d4-1111-2222-3333-444455556666');
    expect(normalized.id).toBe('lever:a1b2c3d4-1111-2222-3333-444455556666');
    expect(normalized.description).toBe('Great role.');
    expect(normalized.experienceLevel).toBe('senior');
    expect(normalized.technologies).toEqual(['go', 'kubernetes']);
    expect(normalized.remote.level).toBe('remote_only');
    expect(normalized.contentHash).toBeTruthy();
  });
});
