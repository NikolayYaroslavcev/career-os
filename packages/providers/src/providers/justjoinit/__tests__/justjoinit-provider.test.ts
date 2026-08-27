import { describe, it, expect } from 'vitest';
import { JustJoinItMapper } from '../justjoinit-mapper.js';
import { JustJoinItNormalizer } from '../justjoinit-normalizer.js';

describe('JustJoinItMapper', () => {
  const mapper = new JustJoinItMapper();

  it('maps a raw job into MappedJob shape, splitting location into city/country', () => {
    const raw = {
      sourceId: 'acme-senior-react-developer-warszawa-react',
      title: 'Senior React Developer',
      description: 'We use React, TypeScript, and Node.js daily.',
      companyName: 'Acme',
      location: 'Warszawa, Poland',
      technologies: [],
      url: 'https://justjoin.it/job-offer/acme-senior-react-developer-warszawa-react',
      publishedAt: new Date('2026-08-22'),
      remote: true,
      employmentType: 'full_time',
      fetchedAt: new Date(),
    };
    const mapped = mapper.map(raw);
    expect(mapped.sourceId).toBe(raw.sourceId);
    expect(mapped.location.city).toBe('Warszawa');
    expect(mapped.location.country).toBe('Poland');
    expect(mapped.employmentType).toBe('full_time');
    expect(mapped.remote).toBe(true);
  });

  it('extracts technologies from the title and description text', () => {
    const raw = {
      sourceId: 'x', title: 'React Developer', description: 'Experience with React, TypeScript and PostgreSQL required.',
      companyName: 'Acme', location: 'Kraków, Poland', technologies: [],
      url: 'https://justjoin.it/job-offer/x', publishedAt: new Date(), fetchedAt: new Date(),
    };
    const mapped = mapper.map(raw);
    expect(mapped.technologies).toEqual(expect.arrayContaining(['react', 'typescript', 'postgresql']));
  });

  it('decodes HTML entities in title/description/company', () => {
    const raw = {
      sourceId: 'x', title: 'Connectivity &amp; Network Engineer', description: 'Build &amp; ship things',
      companyName: 'Acme &amp; Co', location: 'Katowice, Poland', technologies: [],
      url: 'https://justjoin.it/job-offer/x', publishedAt: new Date(), fetchedAt: new Date(),
    };
    const mapped = mapper.map(raw);
    expect(mapped.title).toBe('Connectivity & Network Engineer');
    expect(mapped.companyName).toBe('Acme & Co');
  });

  it('preserves Polish diacritics in the city name', () => {
    const raw = {
      sourceId: 'x', title: 'Dev', description: 'desc', companyName: 'Acme', location: 'Wrocław, Poland',
      technologies: [], url: 'https://justjoin.it/job-offer/x', publishedAt: new Date(), fetchedAt: new Date(),
    };
    expect(mapper.map(raw).location.city).toBe('Wrocław');
  });
});

describe('JustJoinItNormalizer', () => {
  const normalizer = new JustJoinItNormalizer();

  it('normalizes a mapped job with source=justjoin_it', () => {
    const mapped = {
      sourceId: 'x', title: 'Dev', companyName: 'Acme', url: 'https://justjoin.it/job-offer/x',
      publishedAt: new Date(), description: 'desc', technologies: ['react'],
      location: { raw: 'Warszawa, Poland', city: 'Warszawa', country: 'Poland' }, fetchedAt: new Date(), remote: true,
    };
    const result = normalizer.normalize(mapped);
    expect(result.source).toBe('justjoin_it');
    expect(result.id).toBe('justjoin_it:x');
  });

  it('rejects a job missing a required field', () => {
    const mapped = {
      sourceId: '', title: 'Dev', companyName: 'Acme', url: 'https://justjoin.it/job-offer/x',
      publishedAt: new Date(), description: 'desc', technologies: [],
      location: { raw: 'Warszawa, Poland' }, fetchedAt: new Date(),
    };
    const error = normalizer.validate(mapped);
    expect(error?.field).toBe('sourceId');
  });
});
