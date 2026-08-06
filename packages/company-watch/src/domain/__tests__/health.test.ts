import { describe, it, expect } from 'vitest';
import {
  deriveNextHealthStatus,
  isRetirementDue,
  computePriorityScore,
  derivePollingIntervalSeconds,
  COMPANY_WATCH_RETIREMENT_AFTER_BROKEN_MS,
  COMPANY_WATCH_MIN_POLLING_INTERVAL_SECONDS,
  COMPANY_WATCH_MAX_POLLING_INTERVAL_SECONDS,
  COMPANY_WATCH_BROKEN_POLLING_INTERVAL_SECONDS,
} from '../health.js';

describe('deriveNextHealthStatus', () => {
  it('stays RETIRED regardless of further failures (terminal state)', () => {
    expect(
      deriveNextHealthStatus({ currentStatus: 'RETIRED', consecutiveFailureCount: 1, isStructuralFailure: false })
    ).toBe('RETIRED');
  });

  it('a transient failure at count 1-2 moves to DEGRADED', () => {
    expect(deriveNextHealthStatus({ currentStatus: 'ACTIVE', consecutiveFailureCount: 1, isStructuralFailure: false })).toBe('DEGRADED');
    expect(deriveNextHealthStatus({ currentStatus: 'DEGRADED', consecutiveFailureCount: 2, isStructuralFailure: false })).toBe('DEGRADED');
  });

  it('a transient failure reaches BROKEN only at count 3', () => {
    expect(deriveNextHealthStatus({ currentStatus: 'DEGRADED', consecutiveFailureCount: 3, isStructuralFailure: false })).toBe('BROKEN');
  });

  it('a structural failure fast-tracks to BROKEN at count 2, not 3', () => {
    expect(deriveNextHealthStatus({ currentStatus: 'DEGRADED', consecutiveFailureCount: 2, isStructuralFailure: true })).toBe('BROKEN');
  });

  it('a structural failure on the first occurrence still only reaches DEGRADED', () => {
    expect(deriveNextHealthStatus({ currentStatus: 'ACTIVE', consecutiveFailureCount: 1, isStructuralFailure: true })).toBe('DEGRADED');
  });
});

describe('isRetirementDue', () => {
  it('is false for any non-BROKEN status', () => {
    expect(isRetirementDue('ACTIVE', new Date(0))).toBe(false);
    expect(isRetirementDue('DEGRADED', new Date(0))).toBe(false);
    expect(isRetirementDue('RETIRED', new Date(0))).toBe(false);
  });

  it('is false for BROKEN with no lastSuccessfulSyncAt on record', () => {
    expect(isRetirementDue('BROKEN', undefined)).toBe(false);
  });

  it('is false for BROKEN when the 14-day window has not yet elapsed', () => {
    const almostThere = new Date(Date.now() - (COMPANY_WATCH_RETIREMENT_AFTER_BROKEN_MS - 60_000));
    expect(isRetirementDue('BROKEN', almostThere)).toBe(false);
  });

  it('is true for BROKEN once continuously broken for >= 14 days', () => {
    const longAgo = new Date(Date.now() - COMPANY_WATCH_RETIREMENT_AFTER_BROKEN_MS - 60_000);
    expect(isRetirementDue('BROKEN', longAgo)).toBe(true);
  });
});

describe('computePriorityScore', () => {
  it('floors at 20 for zero or negative trailing NEW_JOB velocity', () => {
    expect(computePriorityScore(0)).toBe(20);
    expect(computePriorityScore(-5)).toBe(20);
  });

  it('scales up with velocity, capped at 100', () => {
    expect(computePriorityScore(1)).toBe(28);
    expect(computePriorityScore(10)).toBe(100);
    expect(computePriorityScore(1000)).toBe(100);
  });
});

describe('derivePollingIntervalSeconds', () => {
  it('uses the fixed BROKEN backoff interval regardless of priority', () => {
    expect(derivePollingIntervalSeconds(100, 'BROKEN')).toBe(COMPANY_WATCH_BROKEN_POLLING_INTERVAL_SECONDS);
    expect(derivePollingIntervalSeconds(0, 'BROKEN')).toBe(COMPANY_WATCH_BROKEN_POLLING_INTERVAL_SECONDS);
  });

  it('uses the max (quietest) interval for RETIRED regardless of priority', () => {
    expect(derivePollingIntervalSeconds(100, 'RETIRED')).toBe(COMPANY_WATCH_MAX_POLLING_INTERVAL_SECONDS);
  });

  it('maps priority 100 to the min interval and 0 to the max interval for ACTIVE', () => {
    expect(derivePollingIntervalSeconds(100, 'ACTIVE')).toBe(COMPANY_WATCH_MIN_POLLING_INTERVAL_SECONDS);
    expect(derivePollingIntervalSeconds(0, 'ACTIVE')).toBe(COMPANY_WATCH_MAX_POLLING_INTERVAL_SECONDS);
  });

  it('clamps out-of-range priority scores', () => {
    expect(derivePollingIntervalSeconds(150, 'ACTIVE')).toBe(COMPANY_WATCH_MIN_POLLING_INTERVAL_SECONDS);
    expect(derivePollingIntervalSeconds(-50, 'DEGRADED')).toBe(COMPANY_WATCH_MAX_POLLING_INTERVAL_SECONDS);
  });
});
