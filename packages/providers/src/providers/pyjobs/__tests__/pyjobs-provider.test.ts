import { describe, it, expect } from 'vitest';
import { PyJobsMapper } from '../pyjobs-mapper.js';
import { PyJobsNormalizer } from '../pyjobs-normalizer.js';

describe('PyJobsMapper', () => {
  const mapper = new PyJobsMapper();

  it('should map a raw job and always tag it python', () => {
    const raw = {
      sourceId: 'pyjobs-1', title: 'Backend Engineer', description: 'Acme — Hybrid — Full-time',
      companyName: 'Acme', location: 'Hybrid', technologies: [],
      url: 'https://www.pyjobs.com/job/backend-engineer-1', publishedAt: new Date('2026-07-30'),
      remote: false, fetchedAt: new Date(),
    };
    const mapped = mapper.map(raw);
    expect(mapped.sourceId).toBe('pyjobs-1');
    expect(mapped.technologies).toContain('python');
  });
});

describe('PyJobsNormalizer', () => {
  const normalizer = new PyJobsNormalizer();

  it('should normalize a job', () => {
    const mapped = {
      sourceId: '1', title: 'Dev', companyName: 'Co', url: 'http://x',
      publishedAt: new Date(), description: 'desc', technologies: ['python'],
      location: { raw: 'Remote' }, fetchedAt: new Date(), remote: true,
    };
    const result = normalizer.normalize(mapped);
    expect(result.source).toBe('pyjobs');
  });
});
