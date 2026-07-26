import { describe, it, expect } from 'vitest';
import { WWRMapper } from '../weworkremotely-mapper.js';
import { WWRNormalizer } from '../weworkremotely-normalizer.js';

describe('WWRMapper', () => {
  const mapper = new WWRMapper();

  it('should map raw job', () => {
    const raw = {
      sourceId: 'wwr-0', title: 'Ruby on Rails Dev', description: 'Backend work',
      companyName: 'RailsCorp', location: 'Remote', technologies: ['ruby', 'rails'],
      url: 'https://weworkremotely.com/jobs/1', publishedAt: new Date('2024-05-01'),
      remote: true, fetchedAt: new Date(),
    };
    const mapped = mapper.map(raw);
    expect(mapped.sourceId).toBe('wwr-0');
    expect(mapped.title).toBe('Ruby on Rails Dev');
  });
});

describe('WWRNormalizer', () => {
  const normalizer = new WWRNormalizer();

  it('should normalize a job', () => {
    const mapped = {
      sourceId: '1', title: 'Dev', companyName: 'Co', url: 'http://x',
      publishedAt: new Date(), description: 'desc', technologies: [],
      location: { raw: 'Remote' }, fetchedAt: new Date(), remote: true,
    };
    const result = normalizer.normalize(mapped);
    expect(result.source).toBe('we_work_remotely');
  });
});
