import { describe, it, expect } from 'vitest';
import { SpeedrunMapper } from '../speedrun-mapper.js';
import { SpeedrunNormalizer } from '../speedrun-normalizer.js';

describe('SpeedrunMapper', () => {
  const mapper = new SpeedrunMapper();

  it('should convert raw salary (from/to) into mapped salary (min/max)', () => {
    const raw = {
      sourceId: 'speedrun-1', title: 'Senior Backend Engineer', description: 'Flock Safety — senior — FullTime',
      companyName: 'Flock Safety', location: 'Atlanta, GA', technologies: [],
      salary: { from: 170000, to: 220000, currency: 'USD', period: 'yearly' as const },
      experienceLevel: 'senior',
      url: 'https://speedrun-talent-network.com/jobs/x', publishedAt: new Date('2026-07-30'),
      remote: false, employmentType: 'full_time', fetchedAt: new Date(),
    };
    const mapped = mapper.map(raw);
    expect(mapped.salary).toEqual({ min: 170000, max: 220000, currency: 'USD', period: 'yearly' });
    expect(mapped.experienceLevel).toBe('senior');
  });
});

describe('SpeedrunNormalizer', () => {
  const normalizer = new SpeedrunNormalizer();

  it('should normalize a job', () => {
    const mapped = {
      sourceId: '1', title: 'Dev', companyName: 'Co', url: 'http://x',
      publishedAt: new Date(), description: 'desc', technologies: [],
      location: { raw: 'Remote' }, fetchedAt: new Date(), remote: true,
    };
    const result = normalizer.normalize(mapped);
    expect(result.source).toBe('speedrun');
  });
});
