import { describe, it, expect } from 'vitest';
import { parseJob, parseJobsResponse, isValidTeamtailorJob } from '../teamtailor-parser.js';
import type { TeamtailorJobResourcePayload, TeamtailorJobsListPayload } from '../../transport/teamtailor-transport.js';
import fixtureResponse from '../../__fixtures__/teamtailor-response.json' with { type: 'json' };

describe('teamtailor-parser', () => {
  describe('parseJobsResponse', () => {
    it('filters through isValidTeamtailorJob then maps, matching providers’ original parseResponse', () => {
      const jobs = parseJobsResponse(fixtureResponse as TeamtailorJobsListPayload);

      expect(jobs).toHaveLength(2);
      expect(jobs[0]?.externalId).toBe('998877');
      expect(jobs[0]?.title).toBe('Backend Engineer');
      expect(jobs[0]?.url).toBe('https://careers.acme.com/jobs/998877-backend-engineer');
      expect(jobs[0]?.location).toBe('Remote - Sweden');
    });

    it('resolves department/role names from the included array — the JSON:API pattern company-watch attempted but never correctly exercised', () => {
      const jobs = parseJobsResponse(fixtureResponse as TeamtailorJobsListPayload);
      expect(jobs[0]?.departments).toEqual(['Engineering', 'Backend']);
    });

    it('leaves departments undefined when there are no resolvable relationships', () => {
      const jobs = parseJobsResponse(fixtureResponse as TeamtailorJobsListPayload);
      expect(jobs[1]?.departments).toBeUndefined();
    });

    it('leaves location undefined when locationName is empty, instead of defaulting to "" (that default lives in the provider wrapper)', () => {
      const jobs = parseJobsResponse(fixtureResponse as TeamtailorJobsListPayload);
      expect(jobs[1]?.location).toBeUndefined();
    });

    it('prefers body over pitch for description, matching providers’ original', () => {
      const jobs = parseJobsResponse(fixtureResponse as TeamtailorJobsListPayload);
      expect(jobs[0]?.description).toBe('<p>Join our backend team building the core platform.</p>');
    });

    it('throws when the payload shape is invalid, matching providers’ original parseResponse', () => {
      expect(() => parseJobsResponse({} as unknown as TeamtailorJobsListPayload)).toThrow(
        'Response is not a valid Teamtailor jobs payload',
      );
    });

    it('filters out malformed jobs instead of throwing per-item', () => {
      const malformed = { data: [{ id: 'only-an-id' }] } as unknown as TeamtailorJobsListPayload;
      expect(parseJobsResponse(malformed)).toEqual([]);
    });
  });

  describe('parseJob', () => {
    it('parses a single job identically to the listing entry, given the same included array', () => {
      const job = parseJob(fixtureResponse.data[0] as TeamtailorJobResourcePayload, fixtureResponse.included);
      expect(job.externalId).toBe('998877');
      expect(job.departments).toEqual(['Engineering', 'Backend']);
      expect(job.rawMetadata).toEqual(fixtureResponse.data[0]);
    });

    it('leaves departments undefined when no included array is provided', () => {
      const job = parseJob(fixtureResponse.data[0] as TeamtailorJobResourcePayload);
      expect(job.departments).toBeUndefined();
    });
  });

  describe('isValidTeamtailorJob', () => {
    it('accepts a well-formed job', () => {
      expect(isValidTeamtailorJob(fixtureResponse.data[0])).toBe(true);
    });

    it('rejects a payload missing required fields', () => {
      expect(isValidTeamtailorJob({ id: '1' })).toBe(false);
      expect(isValidTeamtailorJob(null)).toBe(false);
      expect(isValidTeamtailorJob('not an object')).toBe(false);
    });
  });
});
