import { describe, it, expect } from 'vitest';
import { LinkedInSyncStrategy } from '../linkedin-sync-strategy.js';
import type { ProviderState } from '../../../interfaces/provider-state.js';
import type { NormalizedVacancy } from '../../../interfaces/normalized-vacancy.js';

describe('LinkedInSyncStrategy', () => {
  const strategy = new LinkedInSyncStrategy();

  const createState = (overrides: Partial<ProviderState> = {}): ProviderState => ({
    providerId: 'linkedin',
    lastSync: null,
    nextSync: null,
    health: 'healthy',
    importedCount: 0,
    failedCount: 0,
    normalizedCount: 0,
    deduplicatedCount: 0,
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    avgResponseTimeMs: 0,
    totalRequests: 0,
    updatedAt: new Date(),
    ...overrides,
  });

  describe('providerId', () => {
    it('should be linkedin', () => {
      expect(strategy.providerId).toBe('linkedin');
    });
  });

  describe('shouldSync', () => {
    it('should return true for healthy provider with no nextSync', () => {
      const state = createState({ health: 'healthy', nextSync: null });
      expect(strategy.shouldSync(state)).toBe(true);
    });

    it('should return false for unhealthy provider', () => {
      const state = createState({ health: 'unhealthy' });
      expect(strategy.shouldSync(state)).toBe(false);
    });

    it('should return false when consecutive failures >= 3', () => {
      const state = createState({ consecutiveFailures: 3 });
      expect(strategy.shouldSync(state)).toBe(false);
    });

    it('should return false when consecutive failures > 3', () => {
      const state = createState({ consecutiveFailures: 5 });
      expect(strategy.shouldSync(state)).toBe(false);
    });

    it('should return true when consecutive failures < 3', () => {
      const state = createState({ consecutiveFailures: 2 });
      expect(strategy.shouldSync(state)).toBe(true);
    });

    it('should return true when nextSync is in the past', () => {
      const state = createState({ nextSync: new Date(Date.now() - 1000) });
      expect(strategy.shouldSync(state)).toBe(true);
    });

    it('should return false when nextSync is in the future', () => {
      const state = createState({ nextSync: new Date(Date.now() + 100000) });
      expect(strategy.shouldSync(state)).toBe(false);
    });
  });

  describe('getFullSyncCursor', () => {
    it('should return offset cursor starting at 0', () => {
      const cursor = strategy.getFullSyncCursor();

      expect(cursor.type).toBe('offset');
      if (cursor.type === 'offset') {
        expect(cursor.offset).toBe(0);
        expect(cursor.limit).toBe(25);
      }
    });
  });

  describe('getIncrementalCursor', () => {
    it('should return timestamp cursor with lastSync', () => {
      const lastSync = new Date('2026-07-15');
      const state = createState({ lastSync });
      const cursor = strategy.getIncrementalCursor(state);

      expect(cursor.type).toBe('timestamp');
      if (cursor.type === 'timestamp') {
        expect(cursor.since).toEqual(lastSync);
        expect(cursor.inclusive).toBe(false);
      }
    });

    it('should use epoch when lastSync is null', () => {
      const state = createState({ lastSync: null });
      const cursor = strategy.getIncrementalCursor(state);

      expect(cursor.type).toBe('timestamp');
      if (cursor.type === 'timestamp') {
        expect(cursor.since).toEqual(new Date(0));
      }
    });
  });

  describe('processResults', () => {
    it('should update state with imported count', () => {
      const state = createState({ importedCount: 10 });
      const results: NormalizedVacancy[] = [
        { id: 'linkedin:1', source: 'linkedin', sourceId: '1', title: 'Dev', description: '', companyName: 'Corp', location: { raw: 'Berlin', remoteEligible: false }, technologies: [], url: '', publishedAt: new Date(), fetchedAt: new Date(), remote: { level: 'unknown', explicit: false }, normalizedAt: new Date(), contentHash: 'abc' },
      ];
      const cursor = { cursor: { type: 'offset' as const, offset: 25, limit: 25 }, strategy: 'offset' as const, exhausted: false, fetchedCount: 1 };

      const result = strategy.processResults(state, results, cursor);

      expect(result.stateUpdates.changes.importedCount).toBe(11);
      expect(result.stateUpdates.changes.consecutiveFailures).toBe(0);
      expect(result.stateUpdates.changes.consecutiveSuccesses).toBe(1);
    });

    it('should continue when cursor is not exhausted', () => {
      const state = createState();
      const cursor = { cursor: { type: 'offset' as const, offset: 25, limit: 25 }, strategy: 'offset' as const, exhausted: false, fetchedCount: 1 };

      const result = strategy.processResults(state, [], cursor);

      expect(result.shouldContinue).toBe(true);
    });

    it('should stop when cursor is exhausted', () => {
      const state = createState();
      const cursor = { cursor: { type: 'offset' as const, offset: 1000, limit: 25 }, strategy: 'offset' as const, exhausted: true, fetchedCount: 0 };

      const result = strategy.processResults(state, [], cursor);

      expect(result.shouldContinue).toBe(false);
    });

    it('should reset consecutive failures on success', () => {
      const state = createState({ consecutiveFailures: 2 });
      const cursor = { cursor: { type: 'offset' as const, offset: 25, limit: 25 }, strategy: 'offset' as const, exhausted: false, fetchedCount: 1 };

      const result = strategy.processResults(state, [], cursor);

      expect(result.stateUpdates.changes.consecutiveFailures).toBe(0);
    });

    it('should include metrics', () => {
      const state = createState();
      const cursor = { cursor: { type: 'offset' as const, offset: 25, limit: 25 }, strategy: 'offset' as const, exhausted: false, fetchedCount: 5 };

      const result = strategy.processResults(state, [], cursor);

      expect(result.metrics.fetched).toBe(5);
      expect(result.metrics.normalized).toBe(0);
      expect(result.metrics.imported).toBe(0);
      expect(result.metrics.failed).toBe(0);
    });
  });
});
