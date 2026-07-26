import { describe, it, expect } from 'vitest';
import { RemotiveMapper } from '../remotive-mapper.js';
import { RemotiveNormalizer } from '../remotive-normalizer.js';

describe('RemotiveMapper', () => {
  const mapper = new RemotiveMapper();

  it('should map raw job to mapped job', () => {
    const raw = {
      sourceId: '123',
      title: '  Senior React Developer  ',
      description: '<p>Build UIs</p>',
      companyName: '  TechCo  ',
      location: 'Remote, US',
      technologies: ['react', 'typescript'],
      url: 'https://remotive.com/job/123',
      publishedAt: new Date('2024-01-15'),
      remote: true,
      fetchedAt: new Date(),
    };

    const mapped = mapper.map(raw);

    expect(mapped.sourceId).toBe('123');
    expect(mapped.title).toBe('Senior React Developer');
    expect(mapped.description).toBe('Build UIs');
    expect(mapped.companyName).toBe('TechCo');
    expect(mapped.location.raw).toBe('Remote, US');
    expect(mapped.technologies).toEqual(['react', 'typescript']);
    expect(mapped.remote).toBe(true);
  });

  it('should infer experience level from title', () => {
    const raw = {
      sourceId: '1', title: 'Senior Engineer', description: '', companyName: 'Co',
      location: 'Remote', technologies: [], url: 'http://x', publishedAt: new Date(),
      remote: true, fetchedAt: new Date(),
    };
    expect(mapper.map(raw).experienceLevel).toBe('senior');
  });

  it('should infer employment type from description', () => {
    const raw = {
      sourceId: '1', title: 'Engineer', description: 'Full-time position', companyName: 'Co',
      location: 'Remote', technologies: [], url: 'http://x', publishedAt: new Date(),
      remote: true, fetchedAt: new Date(),
    };
    expect(mapper.map(raw).employmentType).toBe('full_time');
  });
});

describe('RemotiveNormalizer', () => {
  const normalizer = new RemotiveNormalizer();

  it('should validate required fields', () => {
    const valid = {
      sourceId: '1', title: 'Engineer', companyName: 'Co', url: 'http://x',
      publishedAt: new Date(), description: 'desc', technologies: [],
      location: { raw: 'Remote' }, fetchedAt: new Date(),
      remote: true,
    };
    expect(normalizer.validate(valid)).toBeNull();
  });

  it('should reject missing title', () => {
    const invalid = {
      sourceId: '1', title: '', companyName: 'Co', url: 'http://x',
      publishedAt: new Date(), description: 'desc', technologies: [],
      location: { raw: 'Remote' }, fetchedAt: new Date(), remote: true,
    };
    expect(normalizer.validate(invalid)).not.toBeNull();
  });

  it('should normalize a job', () => {
    const mapped = {
      sourceId: '1', title: 'Engineer', companyName: 'Co', url: 'http://x',
      publishedAt: new Date(), description: 'Build things', technologies: ['react'],
      location: { raw: 'Remote' }, fetchedAt: new Date(), remote: true,
    };
    const result = normalizer.normalize(mapped);
    expect(result.source).toBe('remotive');
    expect(result.title).toBe('Engineer');
    expect(result.contentHash).toBeTruthy();
  });
});
