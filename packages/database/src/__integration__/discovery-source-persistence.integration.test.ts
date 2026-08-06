import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import type { DiscoverySourceId } from '@careeros/discovery-sources';
import { integrationTestsEnabled } from './db-guard.js';

const runIf = integrationTestsEnabled() ? describe : describe.skip;

// ADR-035 Phase 4 — PrismaDiscoverySourceRepository had zero test coverage
// (unit or integration) before this suite. Uses real DiscoverySourceId
// values from the registry's own constant list so a source-id typo would be
// caught at compile time, but always through a `-test` suffix so a real run's
// row is never touched by cleanup.
runIf('DiscoverySource persistence (real Postgres)', () => {
  let prisma: import('@prisma/client').PrismaClient;
  let PrismaDiscoverySourceRepository: typeof import('../infrastructure/prisma-discovery-source-repository.js').PrismaDiscoverySourceRepository;
  const createdSourceIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import('../client.js'));
    ({ PrismaDiscoverySourceRepository } = await import('../infrastructure/prisma-discovery-source-repository.js'));
  });

  afterEach(async () => {
    if (createdSourceIds.length === 0) return;
    await prisma.discoverySource.deleteMany({ where: { sourceId: { in: createdSourceIds.splice(0) } } });
  });

  it('confirms the DiscoverySource table exists (migration ran)', async () => {
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'DiscoverySource'
    `;
    expect(tables.map((t) => t.table_name)).toEqual(['DiscoverySource']);
  });

  it('ensureRegistered is idempotent bootstrap — creates once, enabled by default, no-ops on repeat calls', async () => {
    const sourceId = `integration-test-cncf-${crypto.randomUUID()}` as DiscoverySourceId;
    createdSourceIds.push(sourceId);
    const repository = new PrismaDiscoverySourceRepository();

    const first = await repository.ensureRegistered(sourceId);
    expect(first.enabled).toBe(true);
    expect(first.candidatesFound).toBe(0);

    // Disable, then call ensureRegistered again — must not silently re-enable it.
    await repository.update({ ...first, enabled: false });
    const second = await repository.ensureRegistered(sourceId);
    expect(second.enabled).toBe(false);
    expect(second.id).toBe(first.id);
  });

  it('enable/disable is persisted and reflected in findAllEnabled()', async () => {
    const sourceId = `integration-test-github-${crypto.randomUUID()}` as DiscoverySourceId;
    createdSourceIds.push(sourceId);
    const repository = new PrismaDiscoverySourceRepository();

    const created = await repository.ensureRegistered(sourceId);
    expect((await repository.findAllEnabled()).some((s) => s.sourceId === sourceId)).toBe(true);

    await repository.update({ ...created, enabled: false });
    expect((await repository.findAllEnabled()).some((s) => s.sourceId === sourceId)).toBe(false);
    expect((await repository.findAll()).some((s) => s.sourceId === sourceId)).toBe(true);
  });

  it('persists run stats, cursor, lastRunAt/lastRunStatus/lastRunError, and updatedAt advances on update', async () => {
    const sourceId = `integration-test-sitemap-${crypto.randomUUID()}` as DiscoverySourceId;
    createdSourceIds.push(sourceId);
    const repository = new PrismaDiscoverySourceRepository();

    const created = await repository.ensureRegistered(sourceId);
    const createdUpdatedAt = created.updatedAt.getTime();

    await new Promise((resolve) => setTimeout(resolve, 10));

    const runAt = new Date();
    const updated = await repository.update({
      ...created,
      cursor: { page: 3 },
      lastRunAt: runAt,
      lastRunStatus: 'success',
      lastRunError: null,
      candidatesFound: 42,
      candidatesEnrolled: 5,
      candidatesRejected: 30,
      metadata: { note: 'integration test' },
    });

    expect(updated.cursor).toEqual({ page: 3 });
    expect(updated.lastRunAt?.getTime()).toBe(runAt.getTime());
    expect(updated.lastRunStatus).toBe('success');
    expect(updated.candidatesFound).toBe(42);
    expect(updated.candidatesEnrolled).toBe(5);
    expect(updated.candidatesRejected).toBe(30);
    expect(updated.metadata).toEqual({ note: 'integration test' });
    expect(updated.updatedAt.getTime()).toBeGreaterThan(createdUpdatedAt);

    const failed = await repository.update({
      ...updated,
      lastRunStatus: 'failed',
      lastRunError: 'upstream timed out',
    });
    expect(failed.lastRunStatus).toBe('failed');
    expect(failed.lastRunError).toBe('upstream timed out');

    const found = await repository.findBySourceId(sourceId);
    expect(found?.lastRunStatus).toBe('failed');
  });
});
