import { describe, it, expect } from 'vitest';
import { WorkdayMapper } from '../workday-mapper.js';
import type { RawJob } from '../../../interfaces/raw-job.js';

describe('WorkdayMapper', () => {
  const mapper = new WorkdayMapper();

  it('should have correct providerId', () => {
    expect(mapper.providerId).toBe('workday');
  });

  it('should map a basic raw job to mapped job', () => {
    const raw: RawJob = {
      sourceId: 'R-12345',
      title: 'Software Engineer II',
      description: 'Remote - USA — full description available at the listing page (req R-12345).',
      companyName: 'Acme Corp',
      location: 'Remote - USA',
      technologies: [],
      url: 'https://acme.wd1.myworkdayjobs.com/job/Remote---USA/Software-Engineer-II_R-12345',
      publishedAt: new Date('2026-07-10'),
      fetchedAt: new Date(),
      remote: true,
    };

    const result = mapper.map(raw);

    expect(result.sourceId).toBe('R-12345');
    expect(result.title).toBe('Software Engineer II');
    expect(result.companyName).toBe('Acme Corp');
    expect(result.remote).toBe(true);
    expect(result.technologies).toEqual([]);
  });

  it('should split location into city and country', () => {
    const raw: RawJob = {
      sourceId: '1',
      title: 'Developer',
      description: 'desc',
      companyName: 'Company',
      location: 'Chicago, IL, United States',
      technologies: [],
      url: 'https://example.com',
      publishedAt: new Date(),
      fetchedAt: new Date(),
    };

    const result = mapper.map(raw);

    expect(result.location.raw).toBe('Chicago, IL, United States');
    expect(result.location.city).toBe('Chicago');
    expect(result.location.country).toBe('United States');
  });

  it('should default location when missing', () => {
    const raw: RawJob = {
      sourceId: '1',
      title: 'Developer',
      description: 'desc',
      companyName: 'Company',
      location: '',
      technologies: [],
      url: 'https://example.com',
      publishedAt: new Date(),
      fetchedAt: new Date(),
    };

    const result = mapper.map(raw);

    expect(result.location.raw).toBe('Not specified');
  });

  it('should always leave salary undefined since Workday list postings expose no salary data', () => {
    const raw: RawJob = {
      sourceId: '1',
      title: 'Developer',
      description: 'desc',
      companyName: 'Company',
      location: 'Remote',
      technologies: [],
      url: 'https://example.com',
      publishedAt: new Date(),
      fetchedAt: new Date(),
    };

    const result = mapper.map(raw);

    expect(result.salary).toBeUndefined();
  });

  it('should leave experienceLevel and employmentType undefined for the shared pipeline to infer', () => {
    const raw: RawJob = {
      sourceId: '1',
      title: 'Senior Software Engineer',
      description: 'desc',
      companyName: 'Company',
      location: 'Remote',
      technologies: [],
      url: 'https://example.com',
      publishedAt: new Date(),
      fetchedAt: new Date(),
    };

    const result = mapper.map(raw);

    expect(result.experienceLevel).toBeUndefined();
    expect(result.employmentType).toBeUndefined();
  });
});
