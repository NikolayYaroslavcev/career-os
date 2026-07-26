import { describe, it, expect } from 'vitest';
import { NoDeskMapper } from '../nodesk-mapper.js';
import { NoDeskNormalizer } from '../nodesk-normalizer.js';

describe('NoDeskMapper', () => {
  const mapper = new NoDeskMapper();

  it('should map raw job', () => {
    const raw = {
      sourceId: 'nodesk-0', title: 'Product Designer', description: 'Design beautiful UIs',
      companyName: 'DesignCo', location: 'Remote', technologies: ['figma', 'css'],
      url: 'https://nodesk.co/job/1', publishedAt: new Date('2024-07-01'),
      remote: true, fetchedAt: new Date(),
    };
    const mapped = mapper.map(raw);
    expect(mapped.sourceId).toBe('nodesk-0');
    expect(mapped.title).toBe('Product Designer');
  });
});

describe('NoDeskNormalizer', () => {
  const normalizer = new NoDeskNormalizer();

  it('should normalize a job', () => {
    const mapped = {
      sourceId: '1', title: 'Dev', companyName: 'Co', url: 'http://x',
      publishedAt: new Date(), description: 'desc', technologies: [],
      location: { raw: 'Remote' }, fetchedAt: new Date(), remote: true,
    };
    const result = normalizer.normalize(mapped);
    expect(result.source).toBe('nodesk');
  });
});
