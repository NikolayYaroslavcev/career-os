import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { CompanyWatchData } from '@careeros/company-watch';
import { integrationTestsEnabled } from './db-guard.js';

const runIf = integrationTestsEnabled() ? describe : describe.skip;

runIf('Company Watch persistence (real Postgres)', () => {
  let prisma: import('@prisma/client').PrismaClient;
  let PrismaCompanyWatchRepository: typeof import('../infrastructure/prisma-company-watch-repository.js').PrismaCompanyWatchRepository;
  let PrismaCompanyWatchEventRepository: typeof import('../infrastructure/prisma-company-watch-event-repository.js').PrismaCompanyWatchEventRepository;
  let PrismaCompanyWatchSyncLogRepository: typeof import('../infrastructure/prisma-company-watch-sync-log-repository.js').PrismaCompanyWatchSyncLogRepository;
  let workspaceId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../client.js'));
    ({ PrismaCompanyWatchRepository } = await import('../infrastructure/prisma-company-watch-repository.js'));
    ({ PrismaCompanyWatchEventRepository } = await import('../infrastructure/prisma-company-watch-event-repository.js'));
    ({ PrismaCompanyWatchSyncLogRepository } = await import('../infrastructure/prisma-company-watch-sync-log-repository.js'));

    const workspace = await prisma.workspace.create({ data: { name: `integration-test-${crypto.randomUUID()}` } });
    workspaceId = workspace.id;
  });

  afterAll(async () => {
    // Cascades away every CompanyWatch (+ its Events/SyncLogs) created under this workspace.
    await prisma.workspace.delete({ where: { id: workspaceId } });
  });

  it('confirms the CompanyWatch, CompanyWatchEvent, and CompanyWatchSyncLog tables exist (migrations created them)', async () => {
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('CompanyWatch', 'CompanyWatchEvent', 'CompanyWatchSyncLog')
    `;
    const names = tables.map((t) => t.table_name).sort();
    expect(names).toEqual(['CompanyWatch', 'CompanyWatchEvent', 'CompanyWatchSyncLog']);
  });

  it('creates, reads, updates, and deletes a CompanyWatch row', async () => {
    const repository = new PrismaCompanyWatchRepository();
    const data: CompanyWatchData = {
      id: crypto.randomUUID(),
      name: `Integration Test Co ${crypto.randomUUID()}`,
      aliases: ['ITC'],
      languages: ['en'],
      tags: ['remote-first'],
      atsType: 'GREENHOUSE',
      careerUrl: 'https://example.test/careers',
      pollingInterval: 3600,
      active: true,
      workspaceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const created = await repository.create(data);
    expect(created.name).toBe(data.name);

    const found = await repository.findById(created.id);
    expect(found?.atsType).toBe('GREENHOUSE');
    expect(found?.careerUrl).toBe('https://example.test/careers');

    const updated = await repository.update({ ...created, active: false });
    expect(updated.active).toBe(false);

    await repository.delete(created.id);
    await expect(repository.findById(created.id)).resolves.toBeNull();
  });

  it('creates and lists CompanyWatchEvent and CompanyWatchSyncLog rows for a CompanyWatch', async () => {
    const watchRepository = new PrismaCompanyWatchRepository();
    const eventRepository = new PrismaCompanyWatchEventRepository();
    const syncLogRepository = new PrismaCompanyWatchSyncLogRepository();

    const watch = await watchRepository.create({
      id: crypto.randomUUID(),
      name: `Integration Test Co ${crypto.randomUUID()}`,
      aliases: [],
      languages: [],
      tags: [],
      atsType: 'LEVER',
      careerUrl: 'https://example.test/careers-2',
      pollingInterval: 3600,
      active: true,
      workspaceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const event = await eventRepository.create({
      id: crypto.randomUUID(),
      type: 'NEW_JOB',
      title: 'New Senior Engineer Role',
      technologies: ['typescript'],
      salary: { min: 90000, max: 130000, currency: 'USD' },
      detectedAt: new Date(),
      processed: false,
      companyWatchId: watch.id,
    });
    expect(event.salary).toEqual({ min: 90000, max: 130000, currency: 'USD' });

    const events = await eventRepository.findAllByCompanyWatch(watch.id);
    expect(events).toHaveLength(1);

    const syncLog = await syncLogRepository.create({
      id: crypto.randomUUID(),
      status: 'SUCCESS',
      jobsFound: 5,
      newJobs: 1,
      removedJobs: 0,
      changedJobs: 0,
      startedAt: new Date(),
      companyWatchId: watch.id,
    });
    expect(syncLog.status).toBe('SUCCESS');

    const latest = await syncLogRepository.findLatestByCompanyWatch(watch.id);
    expect(latest?.id).toBe(syncLog.id);

    await watchRepository.delete(watch.id);
  });
});
