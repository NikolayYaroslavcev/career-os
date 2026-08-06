import { describe, it, expect } from 'vitest';
import { SocialMessageMapper } from '../social-message-mapper.js';
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

describe('SocialMessageMapper', () => {
  const mapper = new SocialMessageMapper();

  it('should have providerId telegram', () => {
    expect(mapper.providerId).toBe('telegram');
  });

  it('should pass through an already-structured RawJob (from AI extraction, or regex fallback) into a MappedJob', () => {
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

  it('should drop salary when neither from nor to is present', () => {
    const mapped = mapper.map(rawJob({ salary: undefined }));
    expect(mapped.salary).toBeUndefined();
  });

  it('does not infer experience level itself — leaves that to the normalization pipeline', () => {
    const mapped = mapper.map(rawJob({ title: 'Старший разработчик', experienceLevel: undefined }));
    expect(mapped.experienceLevel).toBeUndefined();
  });
});
