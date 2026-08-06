import { describe, it, expect } from 'vitest';
import { parseJob, parseJobsResponse, isValidWorkdayJobPosting } from '../workday-parser.js';
import type { WorkdayJobPostingPayload, WorkdayJobsPayload } from '../../transport/workday-transport.js';
import fixtureResponse from '../../__fixtures__/workday-response.json' with { type: 'json' };

describe('workday-parser', () => {
  const config = { tenant: 'acme', site: 'External', host: 'wd1.myworkdayjobs.com' };
  const fetchedAt = new Date('2026-07-10T00:00:00.000Z');

  describe('parseJobsResponse', () => {
    it('filters through isValidWorkdayJobPosting then maps, matching providers’ original parseResponse', () => {
      const jobs = parseJobsResponse(config, fixtureResponse as WorkdayJobsPayload, fetchedAt);

      expect(jobs).toHaveLength(3);
      expect(jobs[0]?.externalId).toBe('R-12345');
      expect(jobs[0]?.title).toBe('Software Engineer II');
      expect(jobs[0]?.url).toBe('https://acme.wd1.myworkdayjobs.com/job/Remote---USA/Software-Engineer-II_R-12345');
      expect(jobs[0]?.location).toBe('Remote - USA');
    });

    it('parses "Posted Today" as the fetch time', () => {
      const jobs = parseJobsResponse(config, fixtureResponse as WorkdayJobsPayload, fetchedAt);
      expect(jobs[0]?.publishedAt).toEqual(fetchedAt);
    });

    it('parses "Posted N Days Ago" as an offset from the fetch time — the bug company-watch had (new Date(postedOn) -> Invalid Date) is not reproduced here', () => {
      const jobs = parseJobsResponse(config, fixtureResponse as WorkdayJobsPayload, fetchedAt);
      const threeDaysAgo = new Date(fetchedAt.getTime() - 3 * 24 * 60 * 60 * 1000);
      expect(jobs[1]?.publishedAt).toEqual(threeDaysAgo);
      expect(jobs[1]?.publishedAt?.getTime()).not.toBeNaN();
    });

    it('parses "Posted 30+ Days Ago" using the numeric prefix', () => {
      const jobs = parseJobsResponse(config, fixtureResponse as WorkdayJobsPayload, fetchedAt);
      const thirtyDaysAgo = new Date(fetchedAt.getTime() - 30 * 24 * 60 * 60 * 1000);
      expect(jobs[2]?.publishedAt).toEqual(thirtyDaysAgo);
    });

    it('throws when the payload shape is invalid, matching providers’ original parseResponse', () => {
      expect(() => parseJobsResponse(config, {} as unknown as WorkdayJobsPayload)).toThrow(
        'Response is not a valid Workday jobs payload',
      );
    });

    it('filters out malformed postings instead of throwing per-item', () => {
      const malformed = { total: 1, jobPostings: [{ title: 'only-a-title' }] } as unknown as WorkdayJobsPayload;
      expect(parseJobsResponse(config, malformed)).toEqual([]);
    });
  });

  describe('parseJob', () => {
    it('parses a single posting identically to the listing entry', () => {
      const job = parseJob(config, fixtureResponse.jobPostings[0] as WorkdayJobPostingPayload, fetchedAt);
      expect(job.externalId).toBe('R-12345');
      expect(job.rawMetadata).toEqual(fixtureResponse.jobPostings[0]);
    });

    it('falls back externalId to externalPath when jobReqId is empty', () => {
      const item = { ...fixtureResponse.jobPostings[0], jobReqId: '' } as WorkdayJobPostingPayload;
      const job = parseJob(config, item, fetchedAt);
      expect(job.externalId).toBe('/job/Remote---USA/Software-Engineer-II_R-12345');
    });
  });

  describe('isValidWorkdayJobPosting', () => {
    it('accepts a well-formed posting', () => {
      expect(isValidWorkdayJobPosting(fixtureResponse.jobPostings[0])).toBe(true);
    });

    it('rejects a payload missing required fields', () => {
      expect(isValidWorkdayJobPosting({ title: 'x' })).toBe(false);
      expect(isValidWorkdayJobPosting(null)).toBe(false);
      expect(isValidWorkdayJobPosting('not an object')).toBe(false);
    });
  });
});
