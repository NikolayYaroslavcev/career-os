import { describe, it, expect } from 'vitest';
import { parseJob, parseJobsResponse, isValidSmartRecruitersPosting } from '../smartrecruiters-parser.js';
import type { SmartRecruitersListPayload, SmartRecruitersPostingPayload } from '../../transport/smartrecruiters-transport.js';
import fixtureResponse from '../../__fixtures__/smartrecruiters-response.json' with { type: 'json' };
import fixtureSingleJob from '../../__fixtures__/smartrecruiters-single-job.json' with { type: 'json' };

describe('smartrecruiters-parser', () => {
  describe('parseJobsResponse', () => {
    it('filters through isValidSmartRecruitersPosting then maps, matching providers’ original parseResponse', () => {
      const jobs = parseJobsResponse(fixtureResponse as SmartRecruitersListPayload);

      expect(jobs).toHaveLength(3);
      expect(jobs[0]?.externalId).toBe('7f8a9b2c-0001');
      expect(jobs[0]?.title).toBe('Senior Backend Engineer');
      expect(jobs[0]?.url).toBe('https://jobs.smartrecruiters.com/acme/7f8a9b2c-0001');
      expect(jobs[0]?.location).toBe('Berlin, Germany');
      expect(jobs[0]?.salary).toEqual({ min: 70000, max: 95000, currency: 'EUR' });
      expect(jobs[0]?.departments).toEqual(['Engineering']);
    });

    it('leaves location undefined when city/country are both empty, instead of defaulting to "Unknown" (that default lives in the provider wrapper)', () => {
      const jobs = parseJobsResponse(fixtureResponse as SmartRecruitersListPayload);
      expect(jobs[1]?.location).toBeUndefined();
    });

    it('leaves salary undefined when both min and max are falsy (0), matching providers’ original falsy check', () => {
      const jobs = parseJobsResponse(fixtureResponse as SmartRecruitersListPayload);
      expect(jobs[2]?.salary).toBeUndefined();
    });

    it('leaves salary undefined when the salary object itself is null', () => {
      const jobs = parseJobsResponse(fixtureResponse as SmartRecruitersListPayload);
      expect(jobs[1]?.salary).toBeUndefined();
    });

    it('does not carry a technologies field on the canonical model', () => {
      const jobs = parseJobsResponse(fixtureResponse as SmartRecruitersListPayload);
      expect(jobs[0]).not.toHaveProperty('technologies');
    });

    it('filters out malformed postings instead of throwing', () => {
      const malformed = {
        offset: 0,
        limit: 100,
        totalFound: 1,
        content: [{ id: 'only-an-id' }],
      } as unknown as SmartRecruitersListPayload;

      expect(parseJobsResponse(malformed)).toEqual([]);
    });

    it('returns an empty array when content is missing or not an array', () => {
      expect(parseJobsResponse({ offset: 0, limit: 100, totalFound: 0 } as unknown as SmartRecruitersListPayload)).toEqual([]);
    });
  });

  describe('parseJob', () => {
    it('parses a single posting identically to the listing entry', () => {
      const job = parseJob(fixtureSingleJob as SmartRecruitersPostingPayload);
      expect(job.externalId).toBe('7f8a9b2c-0001');
      expect(job.salary).toEqual({ min: 70000, max: 95000, currency: 'EUR' });
      expect(job.rawMetadata).toEqual(fixtureSingleJob);
    });
  });

  describe('isValidSmartRecruitersPosting', () => {
    it('accepts a well-formed posting', () => {
      expect(isValidSmartRecruitersPosting(fixtureSingleJob)).toBe(true);
    });

    it('rejects a payload missing required fields', () => {
      expect(isValidSmartRecruitersPosting({ id: '1' })).toBe(false);
      expect(isValidSmartRecruitersPosting(null)).toBe(false);
      expect(isValidSmartRecruitersPosting('not an object')).toBe(false);
    });
  });
});
