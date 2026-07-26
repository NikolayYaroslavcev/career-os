import { describe, it, expect } from 'vitest';
import { TeamtailorMapper } from '../teamtailor-mapper.js';
import type { RawJob } from '../../../interfaces/raw-job.js';

describe('TeamtailorMapper', () => {
  const mapper = new TeamtailorMapper();

  it('should have correct providerId', () => {
    expect(mapper.providerId).toBe('teamtailor');
  });

  it('should map a basic raw job to mapped job', () => {
    const raw: RawJob = {
      sourceId: '998877',
      title: 'Backend Engineer',
      description: '<p>Join our backend team.</p>',
      companyName: 'Acme Corp',
      location: 'Remote - Sweden',
      technologies: [],
      url: 'https://careers.acme.com/jobs/998877-backend-engineer',
      publishedAt: new Date('2026-07-02'),
      fetchedAt: new Date(),
      remote: true,
      employmentType: 'full_time',
      experienceLevel: 'senior',
    };

    const result = mapper.map(raw);

    expect(result.sourceId).toBe('998877');
    expect(result.title).toBe('Backend Engineer');
    expect(result.companyName).toBe('Acme Corp');
    expect(result.remote).toBe(true);
    expect(result.employmentType).toBe('full_time');
    expect(result.experienceLevel).toBe('senior');
  });

  it('should split location into city and country', () => {
    const raw: RawJob = {
      sourceId: '1',
      title: 'Developer',
      description: 'desc',
      companyName: 'Company',
      location: 'Stockholm, Sweden',
      technologies: [],
      url: 'https://example.com',
      publishedAt: new Date(),
      fetchedAt: new Date(),
    };

    const result = mapper.map(raw);

    expect(result.location.raw).toBe('Stockholm, Sweden');
    expect(result.location.city).toBe('Stockholm');
    expect(result.location.country).toBe('Sweden');
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

  it('should leave employmentType/experienceLevel undefined when the fetcher could not translate them', () => {
    const raw: RawJob = {
      sourceId: '1',
      title: 'Seasonal Support Specialist',
      description: 'desc',
      companyName: 'Company',
      location: 'Remote',
      technologies: [],
      url: 'https://example.com',
      publishedAt: new Date(),
      fetchedAt: new Date(),
    };

    const result = mapper.map(raw);

    expect(result.employmentType).toBeUndefined();
    expect(result.experienceLevel).toBeUndefined();
  });

  it('should always leave salary undefined since Teamtailor core job attributes expose no structured salary', () => {
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
});
