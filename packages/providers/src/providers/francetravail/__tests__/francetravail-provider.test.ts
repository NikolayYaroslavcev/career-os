import { describe, it, expect } from 'vitest';
import { FranceTravailMapper } from '../francetravail-mapper.js';
import { FranceTravailNormalizer } from '../francetravail-normalizer.js';

describe('FranceTravailMapper', () => {
  const mapper = new FranceTravailMapper();

  it('should convert raw salary (from/to) into mapped salary (min/max) and mark France as the country', () => {
    const raw = {
      sourceId: '1', title: 'Développeur Java', description: 'Java, Spring Boot, PostgreSQL',
      companyName: 'Acme SAS', location: 'Paris (75)', technologies: [],
      salary: { from: 40000, to: 50000, currency: 'EUR', period: 'yearly' as const },
      url: 'https://candidat.francetravail.fr/offres/recherche/detail/1', publishedAt: new Date('2026-07-30'),
      employmentType: 'full_time', fetchedAt: new Date(),
    };
    const mapped = mapper.map(raw);
    expect(mapped.salary).toEqual({ min: 40000, max: 50000, currency: 'EUR', period: 'yearly' });
    expect(mapped.location).toEqual({ raw: 'Paris (75)', country: 'France' });
    expect(mapped.technologies).toContain('java');
  });
});

describe('FranceTravailNormalizer', () => {
  const normalizer = new FranceTravailNormalizer();

  it('should normalize a job', () => {
    const mapped = {
      sourceId: '1', title: 'Dev', companyName: 'Co', url: 'http://x',
      publishedAt: new Date(), description: 'desc', technologies: [],
      location: { raw: 'Paris', country: 'France' }, fetchedAt: new Date(),
    };
    const result = normalizer.normalize(mapped);
    expect(result.source).toBe('france_travail');
  });
});
