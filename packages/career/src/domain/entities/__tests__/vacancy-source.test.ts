import { describe, it, expect } from 'vitest';
import { Source } from '../vacancy-source.js';
import { createVacancySourceId, createVacancyId } from '../../base/identifier.js';

describe('Source entity', () => {
  function createTestSource() {
    return Source.create({
      id: createVacancySourceId('source-1'),
      vacancyId: createVacancyId('vacancy-1'),
      providerType: 'ATS',
      providerId: 'greenhouse',
      externalId: 'ext-123',
      sourceUrl: 'https://boards.greenhouse.io/acme/jobs/123',
      applyUrl: 'https://boards.greenhouse.io/acme/jobs/123/apply',
    });
  }

  it('creates with ACTIVE status by default', () => {
    const source = createTestSource();
    expect(source.status).toBe('ACTIVE');
    expect(source.isActive).toBe(true);
    expect(source.failureCount).toBe(0);
  });

  it('records sync success and resets failure count', () => {
    const source = createTestSource();
    source.recordSyncFailure();
    source.recordSyncFailure();
    expect(source.failureCount).toBe(2);

    source.recordSyncSuccess();
    expect(source.failureCount).toBe(0);
    expect(source.status).toBe('ACTIVE');
    expect(source.lastSuccessfulSync).toBeDefined();
  });

  it('marks as BROKEN after 3 consecutive failures', () => {
    const source = createTestSource();
    source.recordSyncFailure();
    source.recordSyncFailure();
    source.recordSyncFailure();

    expect(source.status).toBe('BROKEN');
    expect(source.isActive).toBe(false);
    expect(source.failureCount).toBe(3);
  });

  it('marks as EXPIRED', () => {
    const source = createTestSource();
    source.markExpired();

    expect(source.status).toBe('EXPIRED');
    expect(source.isActive).toBe(false);
  });

  it('marks as REMOVED', () => {
    const source = createTestSource();
    source.markRemoved();

    expect(source.status).toBe('REMOVED');
    expect(source.isActive).toBe(false);
  });

  it('updates apply URL', () => {
    const source = createTestSource();
    source.updateApplyUrl('https://new-apply-url.com');

    expect(source.applyUrl).toBe('https://new-apply-url.com');
  });

  it('can set and unset primary', () => {
    const source = createTestSource();
    expect(source.isPrimary).toBe(false);

    source.setPrimary();
    expect(source.isPrimary).toBe(true);

    source.unsetPrimary();
    expect(source.isPrimary).toBe(false);
  });
});
