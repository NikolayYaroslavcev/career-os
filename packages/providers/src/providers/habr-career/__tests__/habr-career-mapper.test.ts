import { describe, it, expect } from 'vitest';
import { HabrCareerMapper } from '../habr-career-mapper.js';
import { HabrCareerNormalizer } from '../habr-career-normalizer.js';
import type { RawJob } from '../../../interfaces/raw-job.js';

function rawJob(overrides: Partial<RawJob> = {}): RawJob {
  return {
    sourceId: '1000123456',
    title: 'Senior Backend Developer',
    description: 'Опыт работы с Python от 3 лет.',
    companyName: 'Skyeng',
    location: 'Москва',
    salary: { from: 250000, to: 350000, currency: 'RUB', period: 'monthly' },
    technologies: ['Python', 'python', 'Django'],
    url: 'https://career.habr.com/vacancies/1000123456',
    publishedAt: new Date('2026-07-22'),
    fetchedAt: new Date(),
    remote: true,
    ...overrides,
  };
}

describe('HabrCareerMapper', () => {
  const mapper = new HabrCareerMapper();

  it('should map a raw job into a MappedJob', () => {
    const mapped = mapper.map(rawJob());

    expect(mapped.sourceId).toBe('1000123456');
    expect(mapped.title).toBe('Senior Backend Developer');
    expect(mapped.companyName).toBe('Skyeng');
    expect(mapped.location).toEqual({ raw: 'Москва', city: 'Москва' });
    expect(mapped.salary).toEqual({ min: 250000, max: 350000, currency: 'RUB', period: 'monthly' });
    expect(mapped.remote).toBe(true);
  });

  it('should deduplicate and lowercase technologies', () => {
    const mapped = mapper.map(rawJob());
    expect(mapped.technologies).toEqual(['python', 'django']);
  });

  it('should default location to "Не указано" when missing', () => {
    const mapped = mapper.map(rawJob({ location: '' }));
    expect(mapped.location).toEqual({ raw: 'Не указано' });
  });

  it('should infer experience level from a Russian title when unset', () => {
    const mapped = mapper.map(rawJob({ title: 'Старший разработчик', experienceLevel: undefined }));
    expect(mapped.experienceLevel).toBe('senior');
  });

  it('should drop salary when neither from nor to is present', () => {
    const mapped = mapper.map(rawJob({ salary: undefined }));
    expect(mapped.salary).toBeUndefined();
  });
});

describe('HabrCareerNormalizer', () => {
  const normalizer = new HabrCareerNormalizer();
  const mapper = new HabrCareerMapper();

  it('should have providerId habr_career', () => {
    expect(normalizer.providerId).toBe('habr_career');
  });

  it('should normalize a mapped job end-to-end', () => {
    const mapped = mapper.map(rawJob());
    const result = normalizer.normalize(mapped);

    expect(result.id).toBe('habr_career:1000123456');
    expect(result.source).toBe('habr_career');
    expect(result.companyName).toBe('Skyeng');
  });

  it('should validate a well-formed job as valid', () => {
    const mapped = mapper.map(rawJob());
    expect(normalizer.validate(mapped)).toBeNull();
  });

  it('should not require a company name (RSS has no structured company field)', () => {
    const mapped = mapper.map(rawJob({ companyName: 'Unknown' }));
    expect(normalizer.validate(mapped)).toBeNull();
  });

  it('should return an error for a missing title', () => {
    const mapped = mapper.map(rawJob({ title: '' }));
    expect(normalizer.validate(mapped)?.field).toBe('title');
  });

  it('should return an error for a missing sourceId', () => {
    const mapped = mapper.map(rawJob({ sourceId: '' }));
    expect(normalizer.validate(mapped)?.field).toBe('sourceId');
  });
});
