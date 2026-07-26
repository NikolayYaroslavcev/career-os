import { describe, it, expect } from 'vitest';
import { GreenhouseNormalizer } from '../greenhouse-normalizer.js';
import { GreenhouseMapper } from '../greenhouse-mapper.js';
import type { RawJob } from '../../../interfaces/raw-job.js';

describe('GreenhouseNormalizer', () => {
  const normalizer = new GreenhouseNormalizer();
  const mapper = new GreenhouseMapper();

  it('should have correct providerId', () => {
    expect(normalizer.providerId).toBe('greenhouse');
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
      sourceId: '4028547',
      title: 'Senior Backend Engineer',
      description: '<p>Great <b>role</b>.</p>',
      companyName: 'Acme Corp',
      location: 'Remote - US',
      technologies: ['Go', 'go', 'Kubernetes'],
      url: 'https://boards.greenhouse.io/acme/jobs/4028547',
      publishedAt: new Date('2026-07-10'),
      fetchedAt: new Date(),
      remote: true,
    };

    const normalized = normalizer.normalize(mapper.map(raw));

    expect(normalized.source).toBe('greenhouse');
    expect(normalized.sourceId).toBe('4028547');
    expect(normalized.id).toBe('greenhouse:4028547');
    expect(normalized.description).toBe('Great role.');
    expect(normalized.experienceLevel).toBe('senior');
    expect(normalized.technologies).toEqual(['go', 'kubernetes']);
    expect(normalized.remote.level).toBe('remote_only');
    expect(normalized.contentHash).toBeTruthy();
  });
});
