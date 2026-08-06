import { describe, it, expect } from 'vitest';
import { parseJob, parseJobsResponse, isValidComeetJob } from '../comeet-parser.js';
import type { ComeetJobPayload, ComeetListPayload } from '../../transport/comeet-transport.js';
import fixtureResponse from '../../__fixtures__/comeet-response.json' with { type: 'json' };

describe('comeet-parser', () => {
  describe('parseJobsResponse', () => {
    it('filters through isValidComeetJob then maps, matching providers’ original parseResponse', () => {
      const jobs = parseJobsResponse(fixtureResponse as ComeetListPayload);

      expect(jobs).toHaveLength(2);
      expect(jobs[0]?.externalId).toBe('job-001');
      expect(jobs[0]?.title).toBe('Senior Backend Engineer');
      expect(jobs[0]?.location).toBe('Tel Aviv, Israel');
    });

    it('joins detail sections with a blank line, matching providers’ original extractDescription', () => {
      const jobs = parseJobsResponse(fixtureResponse as ComeetListPayload);
      expect(jobs[0]?.description).toBe('Build APIs using Node.js and React.\n\nExperience with Kubernetes.');
    });

    it('returns an empty description when details is null', () => {
      const jobs = parseJobsResponse(fixtureResponse as ComeetListPayload);
      expect(jobs[1]?.description).toBe('');
    });

    it('leaves location undefined when the location name is empty, instead of defaulting to "Unknown" (that default lives in the provider wrapper)', () => {
      const jobs = parseJobsResponse(fixtureResponse as ComeetListPayload);
      expect(jobs[1]?.location).toBeUndefined();
    });

    it('falls back to position_url when url_active_page is empty', () => {
      const jobs = parseJobsResponse(fixtureResponse as ComeetListPayload);
      expect(jobs[1]?.url).toBe('https://www.comeet.com/jobs/acme/12.346');
    });

    it('does not carry a salary field on the canonical model — Comeet has none', () => {
      const jobs = parseJobsResponse(fixtureResponse as ComeetListPayload);
      expect(jobs[0]?.salary).toBeUndefined();
    });

    it('filters out malformed jobs instead of throwing', () => {
      const malformed = [{ uid: 'only-a-uid' }] as unknown as ComeetListPayload;
      expect(parseJobsResponse(malformed)).toEqual([]);
    });

    it('returns an empty array when the payload is not an array', () => {
      expect(parseJobsResponse({} as unknown as ComeetListPayload)).toEqual([]);
    });
  });

  describe('parseJob', () => {
    it('parses a single job identically to the listing entry', () => {
      const job = parseJob(fixtureResponse[0] as ComeetJobPayload);
      expect(job.externalId).toBe('job-001');
      expect(job.rawMetadata).toEqual(fixtureResponse[0]);
    });
  });

  describe('isValidComeetJob', () => {
    it('accepts a well-formed job', () => {
      expect(isValidComeetJob(fixtureResponse[0])).toBe(true);
    });

    it('rejects a payload missing required fields', () => {
      expect(isValidComeetJob({ uid: 'job-001' })).toBe(false);
      expect(isValidComeetJob(null)).toBe(false);
      expect(isValidComeetJob('not an object')).toBe(false);
    });
  });
});
