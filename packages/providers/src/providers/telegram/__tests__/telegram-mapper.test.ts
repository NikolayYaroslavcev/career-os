import { describe, it, expect } from 'vitest';
import { TelegramMapper } from '../telegram-mapper.js';
import { TelegramNormalizer } from '../telegram-normalizer.js';
import type { RawJob } from '../../../interfaces/raw-job.js';

function rawJob(overrides: Partial<RawJob> = {}): RawJob {
  return {
    sourceId: 'frontend_jobs:102',
    title: 'Senior Frontend Developer',
    description: 'Senior Frontend Developer | Remote Russia | Rocket Sci #remote #react #typescript',
    companyName: 'Rocket Sci',
    location: 'Remote Russia',
    salary: { from: 200000, to: 300000, currency: 'RUB', period: 'monthly' },
    technologies: ['TypeScript', 'react', 'react'],
    url: 'https://teletype.in/@rocketsci/frontend-role',
    publishedAt: new Date('2026-07-20'),
    fetchedAt: new Date(),
    remote: true,
    ...overrides,
  };
}

describe('TelegramMapper', () => {
  const mapper = new TelegramMapper();

  it('should map a raw job into a MappedJob', () => {
    const mapped = mapper.map(rawJob());

    expect(mapped.sourceId).toBe('frontend_jobs:102');
    expect(mapped.title).toBe('Senior Frontend Developer');
    expect(mapped.companyName).toBe('Rocket Sci');
    expect(mapped.location).toEqual({ raw: 'Remote Russia', city: 'Remote Russia' });
    expect(mapped.salary).toEqual({ min: 200000, max: 300000, currency: 'RUB', period: 'monthly' });
    expect(mapped.remote).toBe(true);
  });

  it('should deduplicate and lowercase technologies', () => {
    const mapped = mapper.map(rawJob());
    expect(mapped.technologies).toEqual(['typescript', 'react']);
  });

  it('should default location to "Не указано" when missing', () => {
    const mapped = mapper.map(rawJob({ location: '' }));
    expect(mapped.location).toEqual({ raw: 'Не указано' });
  });

  it('should default an empty company name to "Unknown"', () => {
    const mapped = mapper.map(rawJob({ companyName: '' }));
    expect(mapped.companyName).toBe('Unknown');
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

describe('TelegramNormalizer', () => {
  const normalizer = new TelegramNormalizer();
  const mapper = new TelegramMapper();

  it('should have providerId telegram', () => {
    expect(normalizer.providerId).toBe('telegram');
  });

  it('should normalize a mapped job end-to-end', () => {
    const mapped = mapper.map(rawJob());
    const result = normalizer.normalize(mapped);

    expect(result.id).toBe('telegram:frontend_jobs:102');
    expect(result.source).toBe('telegram');
    expect(result.companyName).toBe('Rocket Sci');
  });

  it('should validate a well-formed job as valid', () => {
    const mapped = mapper.map(rawJob());
    expect(normalizer.validate(mapped)).toBeNull();
  });

  it('should not require a company name (free-text posts often omit it)', () => {
    const mapped = mapper.map(rawJob({ companyName: '' }));
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
