import { describe, it, expect, beforeEach } from 'vitest';
import { DeduplicationEngine } from '../deduplication/deduplication-engine.js';
import type { NormalizedVacancy } from '../interfaces/normalized-vacancy.js';

const createVacancy = (overrides: Partial<NormalizedVacancy> = {}): NormalizedVacancy => ({
  id: 'test-id',
  source: 'test-provider',
  sourceId: 'source-123',
  title: 'Software Engineer',
  description: 'Build great things',
  companyName: 'Tech Corp',
  location: { raw: 'Remote', remoteEligible: true },
  technologies: ['typescript', 'react'],
  url: 'https://example.com/job/1',
  publishedAt: new Date('2024-01-01'),
  fetchedAt: new Date(),
  remote: { level: 'remote_only', explicit: true },
  normalizedAt: new Date(),
  contentHash: 'abc123',
  ...overrides,
});

describe('DeduplicationEngine', () => {
  let engine: DeduplicationEngine;

  beforeEach(() => {
    engine = new DeduplicationEngine({
      keyFields: ['contentHash'],
      similarityThreshold: 0.8,
      timeWindowMs: 86400000,
    });
  });

  it('should return all jobs as unique when no duplicates', () => {
    const jobs = [
      createVacancy({ contentHash: 'hash1', title: 'Frontend Engineer', companyName: 'Alpha Inc' }),
      createVacancy({ contentHash: 'hash2', title: 'Backend Engineer', companyName: 'Beta LLC' }),
      createVacancy({ contentHash: 'hash3', title: 'DevOps Engineer', companyName: 'Gamma Corp' }),
    ];

    const result = engine.deduplicate(jobs);

    expect(result.unique).toHaveLength(3);
    expect(result.duplicates).toHaveLength(0);
    expect(result.stats.duplicatesFound).toBe(0);
  });

  it('should detect duplicates by content hash', () => {
    const jobs = [
      createVacancy({ contentHash: 'hash1', source: 'provider-a', title: 'Software Engineer', companyName: 'Acme Corporation' }),
      createVacancy({ contentHash: 'hash1', source: 'provider-b', title: 'Software Engineer', companyName: 'Acme Corporation' }),
      createVacancy({ contentHash: 'hash2', title: 'Data Scientist', companyName: 'GlobalTech Industries' }),
    ];

    const result = engine.deduplicate(jobs);

    expect(result.unique).toHaveLength(2);
    expect(result.duplicates).toHaveLength(1);
    expect(result.stats.duplicatesFound).toBe(1);
  });

  it('should track duplicate sources', () => {
    const jobs = [
      createVacancy({ contentHash: 'hash1', source: 'provider-a', title: 'Engineer X', companyName: 'Company X' }),
      createVacancy({ contentHash: 'hash1', source: 'provider-b', title: 'Engineer X', companyName: 'Company X' }),
      createVacancy({ contentHash: 'hash1', source: 'provider-c', title: 'Engineer X', companyName: 'Company X' }),
    ];

    const result = engine.deduplicate(jobs);

    expect(result.duplicates[0]?.sources).toContain('provider-a');
    expect(result.duplicates[0]?.sources).toContain('provider-b');
    expect(result.duplicates[0]?.sources).toContain('provider-c');
  });

  it('should clear internal state', () => {
    engine.deduplicate([createVacancy({ contentHash: 'hash1', title: 'Job A', companyName: 'Corp A' })]);
    engine.clear();

    const result = engine.deduplicate([createVacancy({ contentHash: 'hash1', title: 'Job A', companyName: 'Corp A' })]);
    expect(result.unique).toHaveLength(1);
  });

  it('should handle empty input', () => {
    const result = engine.deduplicate([]);

    expect(result.unique).toHaveLength(0);
    expect(result.duplicates).toHaveLength(0);
    expect(result.stats.totalInput).toBe(0);
  });
});
