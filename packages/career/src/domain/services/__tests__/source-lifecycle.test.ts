import { describe, it, expect } from 'vitest';
import { SourceLifecycleServiceImpl } from '../source-lifecycle-service-impl.js';
import { Source } from '../../entities/vacancy-source.js';
import { createVacancySourceId, createVacancyId } from '../../base/identifier.js';

function createTestSource(overrides: Record<string, unknown> = {}) {
  return Source.create({
    id: createVacancySourceId('source-1'),
    vacancyId: createVacancyId('vacancy-1'),
    providerType: 'ATS',
    providerId: 'greenhouse',
    externalId: 'ext-1',
    sourceUrl: 'https://boards.greenhouse.io/acme/jobs/1',
    applyUrl: 'https://boards.greenhouse.io/acme/jobs/1?utm=source',
    ...overrides,
  });
}

describe('SourceLifecycleServiceImpl', () => {
  const service = new SourceLifecycleServiceImpl();

  describe('recordSyncSuccess', () => {
    it('resets failure count and sets status to ACTIVE from BROKEN', async () => {
      const source = createTestSource();
      source.recordSyncFailure();
      source.recordSyncFailure();
      source.recordSyncFailure();
      expect(source.status).toBe('BROKEN');

      const result = await service.recordSyncSuccess(source);

      expect(result.changed).toBe(true);
      expect(result.newStatus).toBe('ACTIVE');
      expect(source.failureCount).toBe(0);
    });

    it('reports no change when already ACTIVE', async () => {
      const source = createTestSource();

      const result = await service.recordSyncSuccess(source);

      expect(result.changed).toBe(false);
      expect(result.newStatus).toBe('ACTIVE');
    });
  });

  describe('recordSyncFailure', () => {
    it('increments failure count', async () => {
      const source = createTestSource();

      const result = await service.recordSyncFailure(source);

      expect(source.failureCount).toBe(1);
      expect(result.newStatus).toBe('ACTIVE');
    });

    it('marks source as BROKEN after 3 failures', async () => {
      const source = createTestSource();

      await service.recordSyncFailure(source);
      await service.recordSyncFailure(source);
      const result = await service.recordSyncFailure(source);

      expect(source.failureCount).toBe(3);
      expect(result.newStatus).toBe('BROKEN');
      expect(result.changed).toBe(true);
    });
  });

  describe('computePrimaryApplyUrl', () => {
    it('returns applyUrl from highest priority active source', () => {
      const atsSource = createTestSource({
        id: createVacancySourceId('s1'),
        providerId: 'greenhouse',
        applyUrl: 'https://greenhouse.io/apply',
      });
      atsSource.updateStatus('ACTIVE');

      const boardSource = createTestSource({
        id: createVacancySourceId('s2'),
        providerId: 'remote_ok',
        applyUrl: 'https://remoteok.com/apply',
      });
      boardSource.updateStatus('ACTIVE');

      const url = service.computePrimaryApplyUrl([boardSource, atsSource]);
      expect(url).toBe('https://greenhouse.io/apply');
    });

    it('falls back to sourceUrl when no applyUrl', () => {
      const source = Source.create({
        id: createVacancySourceId('s1'),
        vacancyId: createVacancyId('vacancy-1'),
        providerType: 'ATS',
        providerId: 'greenhouse',
        externalId: 'ext-1',
        sourceUrl: 'https://greenhouse.io/jobs/1',
      });

      const url = service.computePrimaryApplyUrl([source]);
      expect(url).toBe('https://greenhouse.io/jobs/1');
    });

    it('prefers active sources over expired', () => {
      const expiredSource = createTestSource({
        id: createVacancySourceId('s1'),
        providerId: 'greenhouse',
        applyUrl: 'https://expired.com',
      });
      expiredSource.markExpired();

      const activeSource = createTestSource({
        id: createVacancySourceId('s2'),
        providerId: 'remote_ok',
        applyUrl: 'https://active.com',
      });

      const url = service.computePrimaryApplyUrl([expiredSource, activeSource]);
      expect(url).toBe('https://active.com');
    });

    it('returns undefined for empty sources', () => {
      const url = service.computePrimaryApplyUrl([]);
      expect(url).toBeUndefined();
    });
  });
});
