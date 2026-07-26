import { describe, it, expect } from 'vitest';
import { HNHiringMapper } from '../hnhiring-mapper.js';
import { HNHiringNormalizer } from '../hnhiring-normalizer.js';

describe('HNHiringMapper', () => {
  const mapper = new HNHiringMapper();

  it('should map raw job', () => {
    const raw = {
      sourceId: 'hn-12345', title: 'Startup | Senior Go Engineer | Remote',
      description: 'We are hiring a Go engineer', companyName: 'Startup',
      location: 'Remote, US', technologies: ['go', 'docker'],
      url: 'https://news.ycombinator.com/item?id=12345', publishedAt: new Date('2024-08-01'),
      remote: true, fetchedAt: new Date(),
    };
    const mapped = mapper.map(raw);
    expect(mapped.sourceId).toBe('hn-12345');
    expect(mapped.location.country).toBe('US');
  });
});

describe('HNHiringNormalizer', () => {
  const normalizer = new HNHiringNormalizer();

  it('should normalize a job', () => {
    const mapped = {
      sourceId: '1', title: 'Dev', companyName: 'Co', url: 'http://x',
      publishedAt: new Date(), description: 'desc', technologies: [],
      location: { raw: 'Remote' }, fetchedAt: new Date(), remote: true,
    };
    const result = normalizer.normalize(mapped);
    expect(result.source).toBe('hn_hiring');
  });
});
