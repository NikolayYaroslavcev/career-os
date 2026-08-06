import { describe, it, expect } from 'vitest';
import { SocialMessageMapper } from '../social-message-mapper.js';
import { SocialMessageNormalizer } from '../social-message-normalizer.js';
import { DeduplicationEngine } from '../../../deduplication/deduplication-engine.js';
import type { RawJob } from '../../../interfaces/raw-job.js';

// Reproduces a real pattern in job channels: the same vacancy gets reposted
// (bumped) under a new message id days later, so sourceId/url/contentHash
// all differ — only DeduplicationEngine's fuzzy title+company matching (not
// an exact-key match) can catch it. Exercises "reuse existing deduplication"
// for the Telegram provider rather than reimplementing dedup logic here.
function rawJob(overrides: Partial<RawJob> = {}): RawJob {
  return {
    sourceId: 'frontend_jobs:102',
    title: 'Senior Frontend Developer',
    description: 'Senior Frontend Developer | Remote Russia | Rocket Sci #remote #react',
    companyName: 'Rocket Sci',
    location: 'Remote Russia',
    technologies: ['react'],
    url: 'https://teletype.in/@rocketsci/frontend-role',
    publishedAt: new Date('2026-07-20'),
    fetchedAt: new Date(),
    remote: true,
    ...overrides,
  };
}

describe('Telegram vacancy deduplication', () => {
  const mapper = new SocialMessageMapper();
  const normalizer = new SocialMessageNormalizer();

  it('flags a reposted vacancy (different message id/url, same title+company) as a duplicate', () => {
    const original = normalizer.normalize(mapper.map(rawJob()));
    const repost = normalizer.normalize(mapper.map(rawJob({
      sourceId: 'frontend_jobs:105',
      title: 'SENIOR FRONTEND DEVELOPER',
      companyName: 'ROCKET SCI',
      url: 'https://teletype.in/@rocketsci/frontend-role?utm_source=telegram',
    })));

    expect(original.contentHash).not.toBe(repost.contentHash);

    const engine = new DeduplicationEngine({
      keyFields: ['contentHash'],
      similarityThreshold: 0.8,
      timeWindowMs: 7 * 24 * 60 * 60 * 1000,
    });

    const result = engine.deduplicate([original, repost]);

    expect(result.unique).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
    expect(result.stats.duplicatesFound).toBe(1);
  });

  it('does not flag two genuinely different vacancies as duplicates', () => {
    const jobA = normalizer.normalize(mapper.map(rawJob()));
    const jobB = normalizer.normalize(mapper.map(rawJob({
      sourceId: 'frontend_jobs:103',
      title: 'Backend Developer (Python/Django)',
      companyName: 'TechCorp',
      location: 'Москва',
      url: 'https://t.me/hr_techcorp',
    })));

    const engine = new DeduplicationEngine({
      keyFields: ['contentHash'],
      similarityThreshold: 0.8,
      timeWindowMs: 7 * 24 * 60 * 60 * 1000,
    });

    const result = engine.deduplicate([jobA, jobB]);

    expect(result.unique).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
  });
});
