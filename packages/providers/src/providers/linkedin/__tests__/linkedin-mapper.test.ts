import { describe, it, expect } from 'vitest';
import { LinkedInMapper } from '../linkedin-mapper.js';
import type { RawJob } from '../../../interfaces/raw-job.js';

describe('LinkedInMapper', () => {
  const mapper = new LinkedInMapper();

  const createRawJob = (overrides: Partial<RawJob> = {}): RawJob => ({
    sourceId: '12345',
    title: 'Senior TypeScript Developer',
    description: 'Build web applications with TypeScript and React',
    companyName: 'TechCorp',
    location: 'Berlin, Germany',
    technologies: ['typescript'],
    url: 'https://www.linkedin.com/jobs/view/12345',
    publishedAt: new Date('2026-07-15'),
    fetchedAt: new Date(),
    remote: false,
    ...overrides,
  });

  describe('providerId', () => {
    it('should be linkedin', () => {
      expect(mapper.providerId).toBe('linkedin');
    });
  });

  describe('map', () => {
    it('should map a basic raw job to mapped job', () => {
      const raw = createRawJob();
      const result = mapper.map(raw);

      expect(result.sourceId).toBe('12345');
      expect(result.title).toBe('Senior TypeScript Developer');
      expect(result.companyName).toBe('TechCorp');
      expect(result.url).toBe('https://www.linkedin.com/jobs/view/12345');
      expect(result.remote).toBe(false);
    });

    it('should strip HTML tags from description', () => {
      const raw = createRawJob({
        description: '<p>Build <strong>web applications</strong> with TypeScript</p>',
      });
      const result = mapper.map(raw);

      expect(result.description).toBe('Build web applications with TypeScript');
    });

    it('should decode HTML entities in title', () => {
      const raw = createRawJob({
        title: 'Senior Developer &amp; Architect',
      });
      const result = mapper.map(raw);

      expect(result.title).toBe('Senior Developer & Architect');
    });

    it('should decode HTML entities in company name', () => {
      const raw = createRawJob({
        companyName: 'Tech &amp; Co',
      });
      const result = mapper.map(raw);

      expect(result.companyName).toBe('Tech & Co');
    });

    it('should strip "- LinkedIn" suffix from company name', () => {
      const raw = createRawJob({
        companyName: 'TechCorp - LinkedIn',
      });
      const result = mapper.map(raw);

      expect(result.companyName).toBe('TechCorp');
    });

    it('should parse city and country from location', () => {
      const raw = createRawJob({
        location: 'Berlin, Germany',
      });
      const result = mapper.map(raw);

      expect(result.location.raw).toBe('Berlin, Germany');
      expect(result.location.city).toBe('Berlin');
      expect(result.location.country).toBe('Germany');
    });

    it('should handle location with only city', () => {
      const raw = createRawJob({
        location: 'Berlin',
      });
      const result = mapper.map(raw);

      expect(result.location.raw).toBe('Berlin');
      expect(result.location.city).toBe('Berlin');
      expect(result.location.country).toBeUndefined();
    });

    it('should handle empty location', () => {
      const raw = createRawJob({
        location: '',
      });
      const result = mapper.map(raw);

      expect(result.location.raw).toBe('');
    });

    it('should extract technologies from title and description', () => {
      const raw = createRawJob({
        title: 'React Developer',
        description: 'Working with TypeScript, Node.js, and PostgreSQL',
        technologies: [],
      });
      const result = mapper.map(raw);

      expect(result.technologies).toContain('react');
      expect(result.technologies).toContain('typescript');
      expect(result.technologies).toContain('node');
      expect(result.technologies).toContain('postgresql');
    });

    it('should deduplicate technologies', () => {
      const raw = createRawJob({
        title: 'React Developer',
        description: 'React and react',
        technologies: ['React', 'react', 'typescript'],
      });
      const result = mapper.map(raw);

      const reactCount = result.technologies.filter((t) => t === 'react').length;
      expect(reactCount).toBe(1);
    });

    it('should preserve existing technologies from raw job', () => {
      const raw = createRawJob({
        technologies: ['kubernetes', 'docker'],
        title: 'DevOps Engineer',
        description: 'Infrastructure work',
      });
      const result = mapper.map(raw);

      expect(result.technologies).toContain('kubernetes');
      expect(result.technologies).toContain('docker');
    });

    it('should infer senior experience level from title', () => {
      const raw = createRawJob({
        title: 'Senior Software Engineer',
        description: '',
      });
      const result = mapper.map(raw);

      expect(result.experienceLevel).toBe('senior');
    });

    it('should infer junior experience level from title', () => {
      const raw = createRawJob({
        title: 'Junior Frontend Developer',
        description: '',
      });
      const result = mapper.map(raw);

      expect(result.experienceLevel).toBe('junior');
    });

    it('should infer lead experience level from title', () => {
      const raw = createRawJob({
        title: 'Team Lead Backend',
        description: '',
      });
      const result = mapper.map(raw);

      expect(result.experienceLevel).toBe('lead');
    });

    it('should infer principal experience level from title', () => {
      const raw = createRawJob({
        title: 'Staff Engineer',
        description: '',
      });
      const result = mapper.map(raw);

      expect(result.experienceLevel).toBe('principal');
    });

    it('should infer intern experience level from title', () => {
      const raw = createRawJob({
        title: 'Software Engineering Intern',
        description: '',
      });
      const result = mapper.map(raw);

      expect(result.experienceLevel).toBe('intern');
    });

    it('should return undefined experience level when not detectable', () => {
      const raw = createRawJob({
        title: 'Software Engineer',
        description: '',
      });
      const result = mapper.map(raw);

      expect(result.experienceLevel).toBeUndefined();
    });

    it('should use existing experience level from raw job', () => {
      const raw = createRawJob({
        experienceLevel: 'senior',
        title: 'Engineer',
        description: '',
      });
      const result = mapper.map(raw);

      expect(result.experienceLevel).toBe('senior');
    });

    it('should infer full_time employment type', () => {
      const raw = createRawJob({
        title: 'Full-Time Developer',
        description: '',
      });
      const result = mapper.map(raw);

      expect(result.employmentType).toBe('full_time');
    });

    it('should infer part_time employment type', () => {
      const raw = createRawJob({
        title: 'Part-Time Designer',
        description: '',
      });
      const result = mapper.map(raw);

      expect(result.employmentType).toBe('part_time');
    });

    it('should infer contract employment type', () => {
      const raw = createRawJob({
        title: 'Contract Developer',
        description: '',
      });
      const result = mapper.map(raw);

      expect(result.employmentType).toBe('contract');
    });

    it('should infer freelance employment type', () => {
      const raw = createRawJob({
        title: 'Freelance Designer',
        description: '',
      });
      const result = mapper.map(raw);

      expect(result.employmentType).toBe('freelance');
    });

    it('should infer internship employment type', () => {
      const raw = createRawJob({
        title: 'Summer Internship',
        description: '',
      });
      const result = mapper.map(raw);

      expect(result.employmentType).toBe('internship');
    });

    it('should return undefined employment type when not detectable', () => {
      const raw = createRawJob({
        title: 'Software Engineer',
        description: '',
      });
      const result = mapper.map(raw);

      expect(result.employmentType).toBeUndefined();
    });

    it('should infer remote from location containing "remote"', () => {
      const raw = createRawJob({
        location: 'Remote',
        remote: undefined,
      });
      const result = mapper.map(raw);

      expect(result.remote).toBe(true);
    });

    it('should infer remote from location containing "anywhere"', () => {
      const raw = createRawJob({
        location: 'Anywhere',
        remote: undefined,
      });
      const result = mapper.map(raw);

      expect(result.remote).toBe(true);
    });

    it('should not infer remote for non-remote locations', () => {
      const raw = createRawJob({
        location: 'Berlin, Germany',
        remote: undefined,
      });
      const result = mapper.map(raw);

      expect(result.remote).toBe(false);
    });

    it('should use existing remote flag from raw job', () => {
      const raw = createRawJob({
        location: 'Berlin, Germany',
        remote: true,
      });
      const result = mapper.map(raw);

      expect(result.remote).toBe(true);
    });

    it('should map publishedAt from raw job', () => {
      const date = new Date('2026-06-15');
      const raw = createRawJob({ publishedAt: date });
      const result = mapper.map(raw);

      expect(result.publishedAt).toEqual(date);
    });

    it('should map fetchedAt from raw job', () => {
      const date = new Date('2026-07-01');
      const raw = createRawJob({ fetchedAt: date });
      const result = mapper.map(raw);

      expect(result.fetchedAt).toEqual(date);
    });

    it('should preserve extensions from raw job', () => {
      const raw = createRawJob({
        extensions: { applicants: '50', source: 'linkedin_guest_api' },
      });
      const result = mapper.map(raw);

      expect(result.extensions).toEqual({ applicants: '50', source: 'linkedin_guest_api' });
    });

    it('should not set salary (LinkedIn guest API does not provide salary)', () => {
      const raw = createRawJob();
      const result = mapper.map(raw);

      expect(result.salary).toBeUndefined();
    });
  });
});
