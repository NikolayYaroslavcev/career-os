import { describe, it, expect } from 'vitest';
import { parseJob, parseJobsResponse, isValidGreenhouseJob } from '../greenhouse-parser.js';
import type { GreenhouseJobsPayload, GreenhouseRawJobPayload } from '../../transport/greenhouse-transport.js';
import fixtureResponse from '../../__fixtures__/greenhouse-response.json' with { type: 'json' };
import fixtureSingleJob from '../../__fixtures__/greenhouse-single-job.json' with { type: 'json' };

describe('greenhouse-parser', () => {
  describe('parseJobsResponse', () => {
    it('parses every job in the board listing unconditionally (no validity filtering)', () => {
      const jobs = parseJobsResponse(fixtureResponse as GreenhouseJobsPayload);

      expect(jobs).toHaveLength(3);
      expect(jobs[0]?.externalId).toBe('4028547');
      expect(jobs[0]?.title).toBe('Senior Backend Engineer');
      expect(jobs[0]?.url).toBe('https://boards.greenhouse.io/acme/jobs/4028547');
      expect(jobs[0]?.location).toBe('Remote - US');
      expect(jobs[0]?.salary).toEqual({ min: 150000, max: 190000, currency: 'USD' });
      expect(jobs[0]?.departments).toEqual(['Engineering']);
      expect(jobs[0]?.rawMetadata).toEqual([{ id: 1, name: 'Technologies', value: 'Go, Kubernetes, PostgreSQL' }]);
    });

    it('leaves salary undefined when pay_input_ranges is null', () => {
      const jobs = parseJobsResponse(fixtureResponse as GreenhouseJobsPayload);
      expect(jobs[1]?.salary).toBeUndefined();
    });

    it('does not carry a technologies field on the canonical model', () => {
      const jobs = parseJobsResponse(fixtureResponse as GreenhouseJobsPayload);
      expect(jobs[0]).not.toHaveProperty('technologies');
    });
  });

  describe('parseJob', () => {
    it('parses a single job identically to the listing entry', () => {
      const job = parseJob(fixtureSingleJob as GreenhouseRawJobPayload);
      expect(job.externalId).toBe('4028547');
      expect(job.salary).toEqual({ min: 150000, max: 190000, currency: 'USD' });
    });
  });

  describe('isValidGreenhouseJob', () => {
    it('accepts a well-formed job payload', () => {
      expect(isValidGreenhouseJob(fixtureSingleJob)).toBe(true);
    });

    it('rejects a payload missing required fields', () => {
      expect(isValidGreenhouseJob({ id: 1 })).toBe(false);
      expect(isValidGreenhouseJob(null)).toBe(false);
      expect(isValidGreenhouseJob('not an object')).toBe(false);
    });
  });
});
