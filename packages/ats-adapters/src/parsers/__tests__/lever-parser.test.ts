import { describe, it, expect } from 'vitest';
import { parseJob, parseJobsResponse, isValidLeverPosting } from '../lever-parser.js';
import type { LeverPostingPayload } from '../../transport/lever-transport.js';
import fixtureResponse from '../../__fixtures__/lever-response.json' with { type: 'json' };
import fixtureSingleJob from '../../__fixtures__/lever-single-job.json' with { type: 'json' };

describe('lever-parser', () => {
  describe('parseJobsResponse', () => {
    it('parses every posting in the listing unconditionally (no validity filtering)', () => {
      const jobs = parseJobsResponse(fixtureResponse as LeverPostingPayload[]);

      expect(jobs).toHaveLength(3);
      expect(jobs[0]?.externalId).toBe('a1b2c3d4-1111-2222-3333-444455556666');
      expect(jobs[0]?.title).toBe('Senior Backend Engineer');
      expect(jobs[0]?.url).toBe('https://jobs.lever.co/acme/a1b2c3d4-1111-2222-3333-444455556666');
      expect(jobs[0]?.location).toBe('Remote - US');
      expect(jobs[0]?.salary).toEqual({ min: 150000, max: 190000, currency: 'USD' });
    });

    it('leaves salary undefined when salaryRange is absent', () => {
      const jobs = parseJobsResponse(fixtureResponse as LeverPostingPayload[]);
      expect(jobs[1]?.salary).toBeUndefined();
    });

    it('does not carry technologies or departments on the canonical model', () => {
      const jobs = parseJobsResponse(fixtureResponse as LeverPostingPayload[]);
      expect(jobs[0]).not.toHaveProperty('technologies');
      expect(jobs[0]).not.toHaveProperty('departments');
    });

    it('carries the untouched posting on rawMetadata for consumer-owned derivation', () => {
      const jobs = parseJobsResponse(fixtureResponse as LeverPostingPayload[]);
      expect(jobs[0]?.rawMetadata).toEqual(fixtureResponse[0]);
    });
  });

  describe('parseJob', () => {
    it('parses a single posting identically to the listing entry', () => {
      const job = parseJob(fixtureSingleJob as LeverPostingPayload);
      expect(job.externalId).toBe('a1b2c3d4-1111-2222-3333-444455556666');
      expect(job.salary).toEqual({ min: 150000, max: 190000, currency: 'USD' });
    });

    it('prefers `description` over `descriptionPlain`, matching providers original preference order', () => {
      const job = parseJob(fixtureSingleJob as LeverPostingPayload);
      expect(job.description).toBe(
        '<div>We are looking for a Senior Backend Engineer to join our platform team.</div>',
      );
    });

    it('falls back to descriptionPlain when description is absent', () => {
      const rest: Record<string, unknown> = { ...(fixtureSingleJob as Record<string, unknown>) };
      delete rest.description;
      const job = parseJob(rest as unknown as LeverPostingPayload);
      expect(job.description).toBe('We are looking for a Senior Backend Engineer to join our platform team.');
    });
  });

  describe('isValidLeverPosting', () => {
    it('accepts a well-formed posting payload', () => {
      expect(isValidLeverPosting(fixtureSingleJob)).toBe(true);
    });

    it('rejects a payload missing required fields', () => {
      expect(isValidLeverPosting({ id: '1' })).toBe(false);
      expect(isValidLeverPosting(null)).toBe(false);
      expect(isValidLeverPosting('not an object')).toBe(false);
    });
  });
});
