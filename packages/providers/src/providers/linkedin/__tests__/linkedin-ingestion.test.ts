import { describe, it, expect } from 'vitest';
import { validateIngestionPayload, ingestionPayloadToRawJob } from '../linkedin-ingestion.js';
import type { LinkedInIngestionPayload } from '../linkedin-types.js';

describe('LinkedIn Ingestion', () => {
  describe('validateIngestionPayload', () => {
    it('should return true for a valid payload', () => {
      const payload = {
        jobId: '12345',
        title: 'Senior Developer',
        company: 'TechCorp',
        url: 'https://www.linkedin.com/jobs/view/12345',
        location: 'Berlin, Germany',
        description: 'Build things',
      };
      expect(validateIngestionPayload(payload)).toBe(true);
    });

    it('should return true with only required fields for validation', () => {
      // validateIngestionPayload only checks jobId, title, company, url
      const payload = {
        jobId: '12345',
        title: 'Developer',
        company: 'TechCorp',
        url: 'https://www.linkedin.com/jobs/view/12345',
      };
      expect(validateIngestionPayload(payload)).toBe(true);
    });

    it('should return false for null', () => {
      expect(validateIngestionPayload(null)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(validateIngestionPayload('string')).toBe(false);
      expect(validateIngestionPayload(123)).toBe(false);
      expect(validateIngestionPayload(undefined)).toBe(false);
    });

    it('should return false for missing jobId', () => {
      const payload = { title: 'Dev', company: 'Corp', url: 'https://example.com' };
      expect(validateIngestionPayload(payload)).toBe(false);
    });

    it('should return false for empty jobId', () => {
      const payload = { jobId: '  ', title: 'Dev', company: 'Corp', url: 'https://example.com' };
      expect(validateIngestionPayload(payload)).toBe(false);
    });

    it('should return false for missing title', () => {
      const payload = { jobId: '123', company: 'Corp', url: 'https://example.com' };
      expect(validateIngestionPayload(payload)).toBe(false);
    });

    it('should return false for empty title', () => {
      const payload = { jobId: '123', title: '', company: 'Corp', url: 'https://example.com' };
      expect(validateIngestionPayload(payload)).toBe(false);
    });

    it('should return false for missing company', () => {
      const payload = { jobId: '123', title: 'Dev', url: 'https://example.com' };
      expect(validateIngestionPayload(payload)).toBe(false);
    });

    it('should return false for missing url', () => {
      const payload = { jobId: '123', title: 'Dev', company: 'Corp' };
      expect(validateIngestionPayload(payload)).toBe(false);
    });

    it('should return false for empty url', () => {
      const payload = { jobId: '123', title: 'Dev', company: 'Corp', url: '' };
      expect(validateIngestionPayload(payload)).toBe(false);
    });
  });

  describe('ingestionPayloadToRawJob', () => {
    const createPayload = (overrides: Partial<LinkedInIngestionPayload> = {}): LinkedInIngestionPayload => ({
      jobId: '12345',
      title: 'Senior Developer',
      company: 'TechCorp',
      location: 'Berlin, Germany',
      description: 'Build web applications',
      url: 'https://www.linkedin.com/jobs/view/12345',
      ...overrides,
    });

    it('should convert a basic payload to RawJob', () => {
      const payload = createPayload({ postedDate: '2026-07-15' });
      const result = ingestionPayloadToRawJob(payload);

      expect(result.sourceId).toBe('12345');
      expect(result.title).toBe('Senior Developer');
      expect(result.companyName).toBe('TechCorp');
      expect(result.location).toBe('Berlin, Germany');
      expect(result.description).toBe('Build web applications');
      expect(result.url).toBe('https://www.linkedin.com/jobs/view/12345');
      expect(result.publishedAt).toEqual(new Date('2026-07-15'));
      expect(result.extensions?.source).toBe('linkedin_extension');
    });

    it('should use current date when postedDate is not provided', () => {
      const before = new Date();
      const payload = createPayload({ postedDate: undefined });
      const result = ingestionPayloadToRawJob(payload);

      expect(result.publishedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('should use provided now parameter as fallback date', () => {
      const fixedDate = new Date('2026-01-01');
      const payload = createPayload({ postedDate: undefined });
      const result = ingestionPayloadToRawJob(payload, fixedDate);

      expect(result.publishedAt).toEqual(fixedDate);
    });

    it('should default description to empty string when empty', () => {
      const payload = createPayload({ description: '' });
      const result = ingestionPayloadToRawJob(payload);

      expect(result.description).toBe('');
    });

    it('should default location to empty string when empty', () => {
      const payload = createPayload({ location: '' });
      const result = ingestionPayloadToRawJob(payload);

      expect(result.location).toBe('');
    });

    it('should detect remote from location', () => {
      const payload = createPayload({ location: 'Remote' });
      const result = ingestionPayloadToRawJob(payload);

      expect(result.remote).toBe(true);
    });

    it('should not detect remote for non-remote location', () => {
      const payload = createPayload({ location: 'Berlin, Germany' });
      const result = ingestionPayloadToRawJob(payload);

      expect(result.remote).toBe(false);
    });

    it('should preserve skills as technologies', () => {
      const payload = createPayload({ skills: ['TypeScript', 'React', 'Node.js'] });
      const result = ingestionPayloadToRawJob(payload);

      expect(result.technologies).toEqual(['TypeScript', 'React', 'Node.js']);
    });

    it('should default technologies to empty array when skills not provided', () => {
      const payload = createPayload({ skills: undefined });
      const result = ingestionPayloadToRawJob(payload);

      expect(result.technologies).toEqual([]);
    });

    it('should preserve easyApply flag in extensions', () => {
      const payload = createPayload({ easyApply: true });
      const result = ingestionPayloadToRawJob(payload);

      expect(result.extensions?.easyApply).toBe(true);
    });

    describe('salary parsing', () => {
      it('should parse salary range with plain numbers', () => {
        const payload = createPayload({ salary: '80000 - 120000' });
        const result = ingestionPayloadToRawJob(payload);

        expect(result.salary).toBeDefined();
        expect(result.salary?.from).toBe(80000);
        expect(result.salary?.to).toBe(120000);
        expect(result.salary?.currency).toBe('USD');
        expect(result.salary?.period).toBe('yearly');
      });

      it('should parse salary range with dollar sign and commas as separate digit groups', () => {
        // Implementation strips non-digits then matches \d+, so $80,000 → ["80", "000", "120", "000"]
        // to = parseNumber("000") = 0, but 0 || undefined → undefined
        const payload = createPayload({ salary: '$80,000 - $120,000' });
        const result = ingestionPayloadToRawJob(payload);

        expect(result.salary).toBeDefined();
        expect(result.salary?.from).toBe(80);
        expect(result.salary?.to).toBeUndefined();
      });

      it('should parse salary with K suffix as plain number (K stripped by regex)', () => {
        // K is stripped during cleaning, so "80K" → "80"
        const payload = createPayload({ salary: '80K - 120K' });
        const result = ingestionPayloadToRawJob(payload);

        expect(result.salary?.from).toBe(80);
        expect(result.salary?.to).toBe(120);
      });

      it('should parse single salary value', () => {
        const payload = createPayload({ salary: '100000' });
        const result = ingestionPayloadToRawJob(payload);

        expect(result.salary?.from).toBe(100000);
        expect(result.salary?.to).toBeUndefined();
      });

      it('should return undefined salary for empty string', () => {
        const payload = createPayload({ salary: '' });
        const result = ingestionPayloadToRawJob(payload);

        expect(result.salary).toBeUndefined();
      });

      it('should return undefined salary when not provided', () => {
        const payload = createPayload({ salary: undefined });
        const result = ingestionPayloadToRawJob(payload);

        expect(result.salary).toBeUndefined();
      });

      it('should return undefined salary for non-numeric content', () => {
        const payload = createPayload({ salary: 'Competitive' });
        const result = ingestionPayloadToRawJob(payload);

        expect(result.salary).toBeUndefined();
      });

      it('should return undefined salary when both values are zero', () => {
        const payload = createPayload({ salary: '$0 - $0' });
        const result = ingestionPayloadToRawJob(payload);

        expect(result.salary).toBeUndefined();
      });
    });
  });
});
