import { describe, it, expect } from 'vitest';
import { JobicyMapper } from '../jobicy-mapper.js';
import { JobicyNormalizer } from '../jobicy-normalizer.js';

describe('JobicyMapper', () => {
  const mapper = new JobicyMapper();

  it('should map raw job', () => {
    const raw = {
      sourceId: '101', title: 'React Developer', description: 'Frontend work',
      companyName: 'RemoteCo', location: 'Anywhere', technologies: ['react', 'css'],
      url: 'https://jobicy.com/job/101', publishedAt: new Date('2024-04-01'),
      remote: true, fetchedAt: new Date(),
    };
    const mapped = mapper.map(raw);
    expect(mapped.sourceId).toBe('101');
    expect(mapped.title).toBe('React Developer');
  });
});

describe('JobicyNormalizer', () => {
  const normalizer = new JobicyNormalizer();

  it('should normalize a job', () => {
    const mapped = {
      sourceId: '1', title: 'Dev', companyName: 'Co', url: 'http://x',
      publishedAt: new Date(), description: 'desc', technologies: [],
      location: { raw: 'Remote' }, fetchedAt: new Date(), remote: true,
    };
    const result = normalizer.normalize(mapped);
    expect(result.source).toBe('jobicy');
  });
});
