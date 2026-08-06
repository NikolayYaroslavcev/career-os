import { describe, it, expect } from 'vitest';
import { parseJob, parseJobsResponse, isValidAshbyJob } from '../ashby-parser.js';
import type { AshbyJobBoardPayload, AshbyJobPayload } from '../../transport/ashby-transport.js';
import fixtureResponse from '../../__fixtures__/ashby-response.json' with { type: 'json' };

describe('ashby-parser', () => {
  describe('parseJobsResponse', () => {
    it('filters through isValidAshbyJob then maps, matching providers’ original parseResponse', () => {
      const jobs = parseJobsResponse(fixtureResponse as AshbyJobBoardPayload);

      expect(jobs).toHaveLength(2);
      expect(jobs[0]?.externalId).toBe('11111111-2222-3333-4444-555555555555');
      expect(jobs[0]?.title).toBe('Staff Software Engineer');
      expect(jobs[0]?.location).toBe('Remote - North America');
    });

    it('leaves location undefined when locationName is empty, instead of defaulting to "" (that default lives in the provider wrapper)', () => {
      const jobs = parseJobsResponse(fixtureResponse as AshbyJobBoardPayload);
      expect(jobs[1]?.location).toBeUndefined();
    });

    it('leaves departments undefined on the canonical model — departmentName/teamName stay in rawMetadata for consumers to combine themselves', () => {
      const jobs = parseJobsResponse(fixtureResponse as AshbyJobBoardPayload);
      expect(jobs[0]?.departments).toBeUndefined();
      expect((jobs[0]?.rawMetadata as AshbyJobPayload).departmentName).toBe('Engineering');
      expect((jobs[0]?.rawMetadata as AshbyJobPayload).teamName).toBe('Infrastructure');
    });

    it('throws when the payload shape is invalid, matching providers’ original parseResponse (does not return an empty array)', () => {
      expect(() => parseJobsResponse({} as unknown as AshbyJobBoardPayload)).toThrow(
        'Response is not a valid Ashby job board payload',
      );
      expect(() => parseJobsResponse(null as unknown as AshbyJobBoardPayload)).toThrow();
    });

    it('filters out malformed jobs instead of throwing per-item', () => {
      const malformed = { jobs: [{ id: 'only-an-id' }] } as unknown as AshbyJobBoardPayload;
      expect(parseJobsResponse(malformed)).toEqual([]);
    });
  });

  describe('parseJob', () => {
    it('parses a single job identically to the listing entry', () => {
      const job = parseJob(fixtureResponse.jobs[0] as AshbyJobPayload);
      expect(job.externalId).toBe('11111111-2222-3333-4444-555555555555');
      expect(job.rawMetadata).toEqual(fixtureResponse.jobs[0]);
    });
  });

  describe('isValidAshbyJob', () => {
    it('accepts a well-formed job', () => {
      expect(isValidAshbyJob(fixtureResponse.jobs[0])).toBe(true);
    });

    it('rejects a payload missing required fields', () => {
      expect(isValidAshbyJob({ id: '1' })).toBe(false);
      expect(isValidAshbyJob(null)).toBe(false);
      expect(isValidAshbyJob('not an object')).toBe(false);
    });
  });
});
