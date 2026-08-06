import { describe, it, expect } from 'vitest';
import { PersonioMapper } from '../personio-mapper.js';
import { PersonioNormalizer } from '../personio-normalizer.js';

describe('PersonioMapper', () => {
  const mapper = new PersonioMapper();

  it('should map a raw job, passing structured experienceLevel/employmentType through unchanged', () => {
    const raw = {
      sourceId: '2731150',
      title: 'Senior Backend Engineer (m/f/d)',
      description: '<h3>Your mission</h3>\n<p>Build things.</p>',
      companyName: 'Acme Corp',
      location: 'Berlin, Munich, Remote',
      technologies: ['Kotlin', 'Kafka'],
      experienceLevel: 'senior' as const,
      employmentType: 'full_time' as const,
      url: 'https://acme.jobs.personio.de/job/2731150?language=en',
      publishedAt: new Date('2026-06-25T17:23:34+00:00'),
      remote: true,
      fetchedAt: new Date(),
    };

    const mapped = mapper.map(raw);

    expect(mapped.sourceId).toBe('2731150');
    expect(mapped.title).toBe('Senior Backend Engineer (m/f/d)');
    expect(mapped.description).toBe('Your mission Build things.');
    expect(mapped.experienceLevel).toBe('senior');
    expect(mapped.employmentType).toBe('full_time');
    expect(mapped.location.city).toBe('Berlin');
    expect(mapped.location.country).toBe('Remote');
  });

  it('should fall back to "Not specified" location when raw location is empty', () => {
    const mapped = mapper.map({
      sourceId: '1', title: 'Dev', description: '', companyName: 'Co', location: '',
      technologies: [], url: 'https://x', publishedAt: new Date(), remote: undefined, fetchedAt: new Date(),
    });
    expect(mapped.location).toEqual({ raw: 'Not specified' });
  });
});

describe('PersonioNormalizer', () => {
  const normalizer = new PersonioNormalizer();

  it('should normalize a job with source "personio"', () => {
    const mapped = {
      sourceId: '1', title: 'Dev', companyName: 'Co', url: 'https://x',
      publishedAt: new Date(), description: 'desc', technologies: [],
      location: { raw: 'Berlin' }, fetchedAt: new Date(), remote: false,
    };
    const result = normalizer.normalize(mapped);
    expect(result.source).toBe('personio');
  });

  it('should flag a missing url as an error', () => {
    const mapped = {
      sourceId: '1', title: 'Dev', companyName: 'Co', url: '',
      publishedAt: new Date(), description: 'desc', technologies: [],
      location: { raw: 'Berlin' }, fetchedAt: new Date(),
    };
    expect(normalizer.validate(mapped)).toEqual({ field: 'url', message: 'Missing or empty URL', severity: 'error' });
  });
});
