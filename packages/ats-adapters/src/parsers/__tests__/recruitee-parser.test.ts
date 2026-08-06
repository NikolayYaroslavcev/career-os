import { describe, it, expect } from 'vitest';
import { parseJob, parseJobsResponse, isValidRecruiteeOffer } from '../recruitee-parser.js';
import type { RecruiteeListPayload, RecruiteeOfferPayload } from '../../transport/recruitee-transport.js';
import fixtureResponse from '../../__fixtures__/recruitee-response.json' with { type: 'json' };
import fixtureSingleJob from '../../__fixtures__/recruitee-single-job.json' with { type: 'json' };

describe('recruitee-parser', () => {
  describe('parseJobsResponse', () => {
    it('filters through isValidRecruiteeOffer then maps, matching providers’ original parseResponse', () => {
      const jobs = parseJobsResponse(fixtureResponse as RecruiteeListPayload);

      expect(jobs).toHaveLength(3);
      expect(jobs[0]?.externalId).toBe('1001');
      expect(jobs[0]?.title).toBe('Senior Backend Engineer');
      expect(jobs[0]?.url).toBe('https://acme.recruitee.com/o/senior-backend-engineer');
      expect(jobs[0]?.location).toBe('Berlin, Germany');
      expect(jobs[0]?.salary).toEqual({ min: 50000, max: 70000, currency: 'EUR' });
    });

    it('leaves location undefined when the offer location is empty, instead of defaulting to "Unknown" (that default lives in the provider wrapper)', () => {
      const jobs = parseJobsResponse(fixtureResponse as RecruiteeListPayload);
      expect(jobs[1]?.location).toBeUndefined();
    });

    it('leaves salary undefined when both salary_from and salary_to are null', () => {
      const jobs = parseJobsResponse(fixtureResponse as RecruiteeListPayload);
      expect(jobs[1]?.salary).toBeUndefined();
    });

    it('leaves salary undefined when both salary_from and salary_to are 0, matching providers’ original falsy check', () => {
      const jobs = parseJobsResponse(fixtureResponse as RecruiteeListPayload);
      expect(jobs[2]?.salary).toBeUndefined();
    });

    it('leaves departments undefined on the canonical model — department/team stay in rawMetadata for consumers to combine themselves', () => {
      const jobs = parseJobsResponse(fixtureResponse as RecruiteeListPayload);
      expect(jobs[0]?.departments).toBeUndefined();
      expect((jobs[0]?.rawMetadata as RecruiteeOfferPayload).department).toBe('Engineering');
      expect((jobs[0]?.rawMetadata as RecruiteeOfferPayload).team).toBe('Platform');
    });

    it('does not carry a technologies field on the canonical model', () => {
      const jobs = parseJobsResponse(fixtureResponse as RecruiteeListPayload);
      expect(jobs[0]).not.toHaveProperty('technologies');
    });

    it('filters out malformed offers instead of throwing', () => {
      const malformed = {
        offers: [{ id: 'not-a-number' }],
        meta: { total: 1, per_page: 50, current_page: 1, total_pages: 1 },
      } as unknown as RecruiteeListPayload;

      expect(parseJobsResponse(malformed)).toEqual([]);
    });

    it('returns an empty array when offers is missing or not an array', () => {
      expect(
        parseJobsResponse({ meta: { total: 0, per_page: 50, current_page: 1, total_pages: 0 } } as unknown as RecruiteeListPayload),
      ).toEqual([]);
    });
  });

  describe('parseJob', () => {
    it('parses a single offer identically to the listing entry', () => {
      const job = parseJob(fixtureSingleJob as RecruiteeOfferPayload);
      expect(job.externalId).toBe('1001');
      expect(job.salary).toEqual({ min: 50000, max: 70000, currency: 'EUR' });
      expect(job.rawMetadata).toEqual(fixtureSingleJob);
    });
  });

  describe('isValidRecruiteeOffer', () => {
    it('accepts a well-formed offer', () => {
      expect(isValidRecruiteeOffer(fixtureSingleJob)).toBe(true);
    });

    it('rejects a payload missing required fields', () => {
      expect(isValidRecruiteeOffer({ id: 1 })).toBe(false);
      expect(isValidRecruiteeOffer(null)).toBe(false);
      expect(isValidRecruiteeOffer('not an object')).toBe(false);
    });
  });
});
