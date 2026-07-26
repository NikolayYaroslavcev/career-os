import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultNormalizationPipeline } from '../normalization/normalization-pipeline.js';
import type { MappedJob } from '../interfaces/mapper.js';

const createMappedJob = (overrides: Partial<MappedJob> = {}): MappedJob => ({
  sourceId: 'source-123',
  title: 'Senior Software Engineer',
  description: 'Build great things with TypeScript and React',
  companyName: 'Tech Corp',
  location: { raw: 'Remote, USA' },
  technologies: ['typescript', 'react', 'node.js'],
  url: 'https://example.com/job/1',
  publishedAt: new Date('2024-01-01'),
  fetchedAt: new Date(),
  ...overrides,
});

describe('DefaultNormalizationPipeline', () => {
  let pipeline: DefaultNormalizationPipeline;

  beforeEach(() => {
    pipeline = new DefaultNormalizationPipeline();
  });

  it('should normalize basic job data', () => {
    const job = createMappedJob();
    const result = pipeline.normalize('test-provider', job);

    expect(result.id).toBe('test-provider:source-123');
    expect(result.source).toBe('test-provider');
    expect(result.sourceId).toBe('source-123');
    expect(result.title).toBe('Senior Software Engineer');
    expect(result.companyName).toBe('Tech Corp');
    expect(result.url).toBe('https://example.com/job/1');
  });

  it('should strip HTML from description', () => {
    const job = createMappedJob({
      description: '<p>Build <strong>great</strong> things</p>',
    });

    const result = pipeline.normalize('test-provider', job);
    expect(result.description).toBe('Build great things');
  });

  it('should infer experience level from title', () => {
    const job = createMappedJob({ title: 'Senior Software Engineer' });
    const result = pipeline.normalize('test-provider', job);
    expect(result.experienceLevel).toBe('senior');
  });

  it('should infer experience level from description', () => {
    const job = createMappedJob({
      title: 'Software Engineer',
      description: 'Looking for a junior developer',
    });
    const result = pipeline.normalize('test-provider', job);
    expect(result.experienceLevel).toBe('junior');
  });

  it('should normalize technologies to lowercase', () => {
    const job = createMappedJob({
      technologies: ['TypeScript', 'React', 'NODE.JS'],
    });
    const result = pipeline.normalize('test-provider', job);
    expect(result.technologies).toEqual(['typescript', 'react', 'node.js']);
  });

  it('should generate consistent content hash', () => {
    const job = createMappedJob();
    const result1 = pipeline.normalize('test-provider', job);
    const result2 = pipeline.normalize('test-provider', job);
    expect(result1.contentHash).toBe(result2.contentHash);
  });

  it('should handle missing optional fields', () => {
    const job = createMappedJob({
      title: 'Software Engineer',
      description: 'Build great things',
      salary: undefined,
      experienceLevel: undefined,
      employmentType: undefined,
    });
    const result = pipeline.normalize('test-provider', job);

    expect(result.salary).toBeUndefined();
    expect(result.experienceLevel).toBeUndefined();
    expect(result.employmentType).toBeUndefined();
  });
});
