import { describe, it, expect } from 'vitest';
import { WorkableMapper } from '../workable-mapper.js';
import { WorkableNormalizer } from '../workable-normalizer.js';

describe('WorkableMapper', () => {
  const mapper = new WorkableMapper();

  it('should map a raw job, passing structured experienceLevel/employmentType through unchanged', () => {
    const raw = {
      sourceId: 'F4C096B22E',
      title: 'Senior Backend Engineer, Platform',
      description: '<p>Build things with Kafka.</p>',
      companyName: 'Acme AI',
      location: 'Paris, Île-de-France, France',
      technologies: ['kafka'],
      experienceLevel: 'middle' as const,
      employmentType: 'full_time' as const,
      url: 'https://apply.workable.com/j/F4C096B22E/apply',
      publishedAt: new Date('2026-07-30T09:00:00.000Z'),
      remote: true,
      fetchedAt: new Date(),
    };

    const mapped = mapper.map(raw);

    expect(mapped.sourceId).toBe('F4C096B22E');
    expect(mapped.title).toBe('Senior Backend Engineer, Platform');
    expect(mapped.description).toBe('Build things with Kafka.');
    expect(mapped.experienceLevel).toBe('middle');
    expect(mapped.employmentType).toBe('full_time');
    expect(mapped.location.city).toBe('Paris');
    expect(mapped.location.country).toBe('France');
  });

  it('should fall back to "Not specified" location when raw location is empty', () => {
    const mapped = mapper.map({
      sourceId: '1', title: 'Dev', description: '', companyName: 'Co', location: '',
      technologies: [], url: 'https://x', publishedAt: new Date(), remote: undefined, fetchedAt: new Date(),
    });
    expect(mapped.location).toEqual({ raw: 'Not specified' });
  });
});

describe('WorkableNormalizer', () => {
  const normalizer = new WorkableNormalizer();

  it('should normalize a job with source "workable"', () => {
    const mapped = {
      sourceId: '1', title: 'Dev', companyName: 'Co', url: 'https://x',
      publishedAt: new Date(), description: 'desc', technologies: [],
      location: { raw: 'Paris' }, fetchedAt: new Date(), remote: false,
    };
    const result = normalizer.normalize(mapped);
    expect(result.source).toBe('workable');
  });

  it('should flag a missing url as an error', () => {
    const mapped = {
      sourceId: '1', title: 'Dev', companyName: 'Co', url: '',
      publishedAt: new Date(), description: 'desc', technologies: [],
      location: { raw: 'Paris' }, fetchedAt: new Date(),
    };
    expect(normalizer.validate(mapped)).toEqual({ field: 'url', message: 'Missing or empty URL', severity: 'error' });
  });
});
