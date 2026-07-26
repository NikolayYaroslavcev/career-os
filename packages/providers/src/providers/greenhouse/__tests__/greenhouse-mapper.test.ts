import { describe, it, expect } from 'vitest';
import { GreenhouseMapper } from '../greenhouse-mapper.js';
import type { RawJob } from '../../../interfaces/raw-job.js';

describe('GreenhouseMapper', () => {
  const mapper = new GreenhouseMapper();

  it('should have correct providerId', () => {
    expect(mapper.providerId).toBe('greenhouse');
  });

  it('should map a basic raw job to mapped job', () => {
    const raw: RawJob = {
      sourceId: '4028547',
      title: 'Senior Backend Engineer',
      description: '<p>We are looking for a Senior Backend Engineer.</p>',
      companyName: 'Acme Corp',
      location: 'Remote - US',
      technologies: ['go', 'kubernetes'],
      url: 'https://boards.greenhouse.io/acme/jobs/4028547',
      publishedAt: new Date('2026-07-10'),
      fetchedAt: new Date(),
      remote: true,
    };

    const result = mapper.map(raw);

    expect(result.sourceId).toBe('4028547');
    expect(result.title).toBe('Senior Backend Engineer');
    expect(result.companyName).toBe('Acme Corp');
    expect(result.url).toBe('https://boards.greenhouse.io/acme/jobs/4028547');
    expect(result.remote).toBe(true);
    expect(result.technologies).toEqual(['go', 'kubernetes']);
  });

  it('should split location into city and country', () => {
    const raw: RawJob = {
      sourceId: '1',
      title: 'Developer',
      description: 'desc',
      companyName: 'Company',
      location: 'New York, NY, United States',
      technologies: [],
      url: 'https://example.com',
      publishedAt: new Date(),
      fetchedAt: new Date(),
    };

    const result = mapper.map(raw);

    expect(result.location.raw).toBe('New York, NY, United States');
    expect(result.location.city).toBe('New York');
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

  it('should map salary information', () => {
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
      salary: { from: 150000, to: 190000, currency: 'USD', period: 'yearly' },
    };

    const result = mapper.map(raw);

    expect(result.salary).toEqual({ min: 150000, max: 190000, currency: 'USD', period: 'yearly' });
  });

  it('should leave experienceLevel and employmentType undefined for the shared pipeline to infer', () => {
    const raw: RawJob = {
      sourceId: '1',
      title: 'Senior Developer',
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
