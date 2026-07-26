import { describe, it, expect } from 'vitest';
import { WorkingNomadsMapper } from '../workingnomads-mapper.js';
import { WorkingNomadsNormalizer } from '../workingnomads-normalizer.js';

describe('WorkingNomadsMapper', () => {
  const mapper = new WorkingNomadsMapper();

  it('should map raw job', () => {
    const raw = {
      sourceId: 'wn-1', title: 'Digital Nomad Dev', description: 'Work from anywhere',
      companyName: 'NomadInc', location: 'Remote', technologies: ['javascript'],
      url: 'https://workingnomads.com/job/1', publishedAt: new Date('2024-06-01'),
      remote: true, fetchedAt: new Date(),
    };
    const mapped = mapper.map(raw);
    expect(mapped.sourceId).toBe('wn-1');
    expect(mapped.remote).toBe(true);
  });
});

describe('WorkingNomadsNormalizer', () => {
  const normalizer = new WorkingNomadsNormalizer();

  it('should normalize a job', () => {
    const mapped = {
      sourceId: '1', title: 'Dev', companyName: 'Co', url: 'http://x',
      publishedAt: new Date(), description: 'desc', technologies: [],
      location: { raw: 'Remote' }, fetchedAt: new Date(), remote: true,
    };
    const result = normalizer.normalize(mapped);
    expect(result.source).toBe('working_nomads');
  });
});
