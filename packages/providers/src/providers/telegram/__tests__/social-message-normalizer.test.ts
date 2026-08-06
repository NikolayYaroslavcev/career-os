import { describe, it, expect } from 'vitest';
import { SocialMessageMapper } from '../social-message-mapper.js';
import { SocialMessageNormalizer } from '../social-message-normalizer.js';
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

describe('SocialMessageNormalizer', () => {
  const normalizer = new SocialMessageNormalizer();
  const mapper = new SocialMessageMapper();

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

  it('should infer experience level from a Russian title via the shared normalization pipeline', () => {
    const mapped = mapper.map(rawJob({ title: 'Старший разработчик', experienceLevel: undefined }));
    const result = normalizer.normalize(mapped);
    expect(result.experienceLevel).toBe('senior');
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
