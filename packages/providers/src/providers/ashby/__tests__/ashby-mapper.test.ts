import { describe, it, expect } from 'vitest';
import { AshbyMapper } from '../ashby-mapper.js';
import type { RawJob } from '../../../interfaces/raw-job.js';

describe('AshbyMapper', () => {
  const mapper = new AshbyMapper();

  it('should have correct providerId', () => {
    expect(mapper.providerId).toBe('ashby');
  });

  it('should map a basic raw job to mapped job', () => {
    const raw: RawJob = {
      sourceId: '11111111-2222-3333-4444-555555555555',
      title: 'Staff Software Engineer',
      description: '<p>We are looking for a Staff Software Engineer.</p>',
      companyName: 'Acme Corp',
      location: 'Remote - North America',
      technologies: [],
      url: 'https://jobs.ashbyhq.com/acme/11111111-2222-3333-4444-555555555555',
      publishedAt: new Date('2026-07-05'),
      fetchedAt: new Date(),
      remote: true,
    };

    const result = mapper.map(raw);

    expect(result.sourceId).toBe('11111111-2222-3333-4444-555555555555');
    expect(result.title).toBe('Staff Software Engineer');
    expect(result.companyName).toBe('Acme Corp');
    expect(result.url).toBe('https://jobs.ashbyhq.com/acme/11111111-2222-3333-4444-555555555555');
    expect(result.remote).toBe(true);
    expect(result.technologies).toEqual([]);
  });

  it('should split location into city and country', () => {
    const raw: RawJob = {
      sourceId: '1',
      title: 'Developer',
      description: 'desc',
      companyName: 'Company',
      location: 'San Francisco, CA, United States',
      technologies: [],
      url: 'https://example.com',
      publishedAt: new Date(),
      fetchedAt: new Date(),
    };

    const result = mapper.map(raw);

    expect(result.location.raw).toBe('San Francisco, CA, United States');
    expect(result.location.city).toBe('San Francisco');
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

  it('should always leave salary undefined since Ashby does not expose structured compensation', () => {
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

  it('should pass through the employmentType already translated by the fetcher', () => {
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
      employmentType: 'contract',
    };

    const result = mapper.map(raw);

    expect(result.employmentType).toBe('contract');
  });

  it('should leave experienceLevel undefined for the shared pipeline to infer', () => {
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
  });
});
