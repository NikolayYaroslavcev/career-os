import { describe, it, expect } from 'vitest';
import { AshbyNormalizer } from '../ashby-normalizer.js';
import { AshbyMapper } from '../ashby-mapper.js';
import type { RawJob } from '../../../interfaces/raw-job.js';

describe('AshbyNormalizer', () => {
  const normalizer = new AshbyNormalizer();
  const mapper = new AshbyMapper();

  it('should have correct providerId', () => {
    expect(normalizer.providerId).toBe('ashby');
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
      sourceId: '11111111-2222-3333-4444-555555555555',
      title: 'Staff Software Engineer',
      description: '<p>Great <b>role</b>.</p>',
      companyName: 'Acme Corp',
      location: 'Remote - North America',
      technologies: [],
      url: 'https://jobs.ashbyhq.com/acme/11111111-2222-3333-4444-555555555555',
      publishedAt: new Date('2026-07-05'),
      fetchedAt: new Date(),
      remote: true,
      employmentType: 'full_time',
    };

    const normalized = normalizer.normalize(mapper.map(raw));

    expect(normalized.source).toBe('ashby');
    expect(normalized.sourceId).toBe('11111111-2222-3333-4444-555555555555');
    expect(normalized.id).toBe('ashby:11111111-2222-3333-4444-555555555555');
    expect(normalized.description).toBe('Great role.');
    expect(normalized.remote.level).toBe('remote_only');
    expect(normalized.employmentType).toBe('full_time');
    expect(normalized.technologies).toEqual([]);
    expect(normalized.contentHash).toBeTruthy();
  });

  it('should infer experienceLevel from title text when Ashby does not provide it explicitly', () => {
    const raw: RawJob = {
      sourceId: '33333333-4444-5555-6666-777777777777',
      title: 'Software Engineering Intern',
      description: 'Join us for a summer internship.',
      companyName: 'Acme Corp',
      location: 'Remote - Europe',
      technologies: [],
      url: 'https://jobs.ashbyhq.com/acme/33333333-4444-5555-6666-777777777777',
      publishedAt: new Date('2026-07-03'),
      fetchedAt: new Date(),
      remote: true,
      employmentType: 'internship',
    };

    const normalized = normalizer.normalize(mapper.map(raw));

    expect(normalized.experienceLevel).toBe('intern');
  });
});
