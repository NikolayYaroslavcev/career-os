import { describe, it, expect } from 'vitest';
import { HimalayasMapper } from '../himalayas-mapper.js';
import { HimalayasNormalizer } from '../himalayas-normalizer.js';

describe('HimalayasMapper', () => {
  const mapper = new HimalayasMapper();

  it('should map raw job', () => {
    const raw = {
      sourceId: '456', title: 'Backend Developer', description: 'Build APIs',
      companyName: 'StartupInc', location: 'Berlin, Germany', technologies: ['python', 'django'],
      url: 'https://himalayas.app/jobs/456', publishedAt: new Date('2024-02-01'),
      remote: true, fetchedAt: new Date(),
    };
    const mapped = mapper.map(raw);
    expect(mapped.sourceId).toBe('456');
    expect(mapped.title).toBe('Backend Developer');
    expect(mapped.companyName).toBe('StartupInc');
    expect(mapped.location.country).toBe('Germany');
  });
});

describe('HimalayasNormalizer', () => {
  const normalizer = new HimalayasNormalizer();

  it('should normalize a job', () => {
    const mapped = {
      sourceId: '1', title: 'Dev', companyName: 'Co', url: 'http://x',
      publishedAt: new Date(), description: 'desc', technologies: [],
      location: { raw: 'Remote' }, fetchedAt: new Date(), remote: true,
    };
    const result = normalizer.normalize(mapped);
    expect(result.source).toBe('himalayas');
  });
});
