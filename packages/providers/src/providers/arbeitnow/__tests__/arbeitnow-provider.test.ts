import { describe, it, expect } from 'vitest';
import { ArbeitnowMapper } from '../arbeitnow-mapper.js';
import { ArbeitnowNormalizer } from '../arbeitnow-normalizer.js';

describe('ArbeitnowMapper', () => {
  const mapper = new ArbeitnowMapper();

  it('should map raw job', () => {
    const raw = {
      sourceId: '789', title: 'Full Stack Developer', description: 'Full-time position building web apps',
      companyName: 'EuroTech', location: 'Amsterdam, Netherlands', technologies: ['node', 'react'],
      url: 'https://arbeitnow.com/job/789', publishedAt: new Date('2024-03-01'),
      remote: false, fetchedAt: new Date(),
    };
    const mapped = mapper.map(raw);
    expect(mapped.sourceId).toBe('789');
    expect(mapped.title).toBe('Full Stack Developer');
    expect(mapped.employmentType).toBe('full_time');
  });
});

describe('ArbeitnowNormalizer', () => {
  const normalizer = new ArbeitnowNormalizer();

  it('should normalize a job', () => {
    const mapped = {
      sourceId: '1', title: 'Dev', companyName: 'Co', url: 'http://x',
      publishedAt: new Date(), description: 'desc', technologies: [],
      location: { raw: 'Remote' }, fetchedAt: new Date(), remote: true,
    };
    const result = normalizer.normalize(mapped);
    expect(result.source).toBe('arbeitnow');
  });
});
