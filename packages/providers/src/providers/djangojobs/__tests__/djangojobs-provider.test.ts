import { describe, it, expect } from 'vitest';
import { DjangoJobsMapper } from '../djangojobs-mapper.js';
import { DjangoJobsNormalizer } from '../djangojobs-normalizer.js';

describe('DjangoJobsMapper', () => {
  const mapper = new DjangoJobsMapper();

  it('should map a raw job and always tag it django/python', () => {
    const raw = {
      sourceId: 'django-bwd-1', title: 'Lead Engineer', description: 'Builds a data platform.',
      companyName: 'Relevant Healthcare', location: 'Unknown', technologies: [],
      url: 'http://builtwithdjango.com/jobs/1/lead-engineer', publishedAt: new Date('2026-07-30'),
      fetchedAt: new Date(),
    };
    const mapped = mapper.map(raw);
    expect(mapped.sourceId).toBe('django-bwd-1');
    expect(mapped.technologies).toContain('django');
    expect(mapped.technologies).toContain('python');
  });
});

describe('DjangoJobsNormalizer', () => {
  const normalizer = new DjangoJobsNormalizer();

  it('should normalize a job', () => {
    const mapped = {
      sourceId: '1', title: 'Dev', companyName: 'Co', url: 'http://x',
      publishedAt: new Date(), description: 'desc', technologies: ['django'],
      location: { raw: 'Unknown' }, fetchedAt: new Date(),
    };
    const result = normalizer.normalize(mapped);
    expect(result.source).toBe('django_jobs');
  });
});
