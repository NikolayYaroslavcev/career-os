import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CompanyWatchService, AtsAdapterRegistry, type AtsAdapter, type AtsJob } from '@careeros/company-watch';
import { integrationTestsEnabled } from './db-guard.js';

const runIf = integrationTestsEnabled() ? describe : describe.skip;

function fakeAdapterRegistry(behavior: () => Promise<AtsJob[]>): AtsAdapterRegistry {
  const adapter: AtsAdapter = {
    atsType: 'CUSTOM_HTML',
    fetchJobs: behavior,
    fetchJob: async () => null,
    ping: async () => true,
  };
  return { get: () => adapter } as unknown as AtsAdapterRegistry;
}

// ADR-035 Phase 0/1 — CompanyWatchService.syncCompany() end-to-end against
// real Postgres: multi-sync job diffing (DeduplicationService reads back
// real CompanyWatchEvent/CompanyWatchSyncLog rows, unlike the unit suite's
// in-memory findLatestByCompanyWatch stub which always returns "no previous
// sync"), the full health state machine including RETIRED (never exercised
// anywhere else), and lastSuccessfulSyncAt persistence.
runIf('CompanyWatchService sync lifecycle (real Postgres)', () => {
  let prisma: import('@prisma/client').PrismaClient;
  let PrismaCompanyWatchRepository: typeof import('../infrastructure/prisma-company-watch-repository.js').PrismaCompanyWatchRepository;
  let PrismaCompanyWatchEventRepository: typeof import('../infrastructure/prisma-company-watch-event-repository.js').PrismaCompanyWatchEventRepository;
  let PrismaCompanyWatchSyncLogRepository: typeof import('../infrastructure/prisma-company-watch-sync-log-repository.js').PrismaCompanyWatchSyncLogRepository;

  let workspaceId: string;
  let companyWatchRepo: InstanceType<typeof PrismaCompanyWatchRepository>;
  let eventRepo: InstanceType<typeof PrismaCompanyWatchEventRepository>;
  let syncLogRepo: InstanceType<typeof PrismaCompanyWatchSyncLogRepository>;

  beforeAll(async () => {
    ({ prisma } = await import('../client.js'));
    ({ PrismaCompanyWatchRepository } = await import('../infrastructure/prisma-company-watch-repository.js'));
    ({ PrismaCompanyWatchEventRepository } = await import('../infrastructure/prisma-company-watch-event-repository.js'));
    ({ PrismaCompanyWatchSyncLogRepository } = await import('../infrastructure/prisma-company-watch-sync-log-repository.js'));

    const workspace = await prisma.workspace.create({ data: { name: `integration-test-${crypto.randomUUID()}` } });
    workspaceId = workspace.id;

    companyWatchRepo = new PrismaCompanyWatchRepository();
    eventRepo = new PrismaCompanyWatchEventRepository();
    syncLogRepo = new PrismaCompanyWatchSyncLogRepository();
  });

  afterAll(async () => {
    // Cascades away every CompanyWatch (+ its Events/SyncLogs) created under this workspace.
    await prisma.workspace.delete({ where: { id: workspaceId } });
  });

  async function createCompany() {
    const service = new CompanyWatchService(companyWatchRepo, eventRepo, syncLogRepo, new AtsAdapterRegistry());
    return service.addCompany({
      name: `Sync Lifecycle Co ${crypto.randomUUID()}`,
      aliases: [],
      languages: ['en'],
      tags: [],
      atsType: 'CUSTOM_HTML',
      careerUrl: 'https://93.184.216.34/careers',
      pollingInterval: 3600,
      active: true,
      workspaceId,
    });
  }

  it('detects NEW_JOB -> CHANGED_JOB -> REMOVED_JOB across three real syncs, persisting real CompanyWatchEvent rows', async () => {
    const company = await createCompany();

    const syncOnce = async (jobs: AtsJob[]) => {
      const service = new CompanyWatchService(companyWatchRepo, eventRepo, syncLogRepo, fakeAdapterRegistry(async () => jobs));
      return service.syncCompany(company.id);
    };

    const job: AtsJob = { externalId: 'job-1', title: 'Backend Engineer', description: 'Build APIs', url: 'https://example.com/jobs/1' };

    const first = await syncOnce([job]);
    expect(first.newJobs).toBe(1);
    expect(first.removedJobs).toBe(0);
    expect(first.changedJobs).toBe(0);

    const second = await syncOnce([{ ...job, title: 'Senior Backend Engineer' }]);
    expect(second.newJobs).toBe(0);
    expect(second.changedJobs).toBe(1);
    expect(second.removedJobs).toBe(0);

    const third = await syncOnce([]);
    expect(third.newJobs).toBe(0);
    expect(third.changedJobs).toBe(0);
    expect(third.removedJobs).toBe(1);

    const events = await eventRepo.findAllByCompanyWatch(company.id);
    const types = events.map((e) => e.type).sort();
    expect(types).toEqual(['CHANGED_JOB', 'NEW_JOB', 'REMOVED_JOB']);
  });

  it('persists lastSuccessfulSyncAt only on a successful sync, and it survives a subsequent failure', async () => {
    const company = await createCompany();
    expect(company.lastSuccessfulSyncAt).toBeUndefined();

    const okService = new CompanyWatchService(companyWatchRepo, eventRepo, syncLogRepo, fakeAdapterRegistry(async () => []));
    await okService.syncCompany(company.id);
    const afterSuccess = await companyWatchRepo.findById(company.id);
    expect(afterSuccess?.lastSuccessfulSyncAt).toBeInstanceOf(Date);
    const successAt = afterSuccess!.lastSuccessfulSyncAt!.getTime();

    const failingService = new CompanyWatchService(
      companyWatchRepo,
      eventRepo,
      syncLogRepo,
      fakeAdapterRegistry(async () => {
        throw new Error('rate limited');
      })
    );
    await failingService.syncCompany(company.id);
    const afterFailure = await companyWatchRepo.findById(company.id);
    expect(afterFailure?.lastSuccessfulSyncAt?.getTime()).toBe(successAt);
    expect(afterFailure?.healthStatus).toBe('DEGRADED');
  });

  it('retires a company whose health has been BROKEN for >= 14 days (RETIRED, active=false), excluding it from findAllActive()', async () => {
    const company = await createCompany();
    // Seed a state that already satisfies "continuously BROKEN for >= 14 days"
    // rather than driving real time forward — sets consecutiveFailureCount and
    // healthStatus/lastSuccessfulSyncAt directly on the real row.
    await companyWatchRepo.update({
      ...company,
      healthStatus: 'BROKEN',
      consecutiveFailureCount: 3,
      lastSuccessfulSyncAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    });

    const failingService = new CompanyWatchService(
      companyWatchRepo,
      eventRepo,
      syncLogRepo,
      fakeAdapterRegistry(async () => {
        throw new Error('still down');
      })
    );
    const result = await failingService.syncCompany(company.id);

    expect(result.success).toBe(false);
    const retired = await companyWatchRepo.findById(company.id);
    expect(retired?.healthStatus).toBe('RETIRED');
    expect(retired?.active).toBe(false);

    const active = await companyWatchRepo.findAllActive();
    expect(active.some((c) => c.id === company.id)).toBe(false);
  });

  it('a RETIRED company stays RETIRED even after a sync that would otherwise succeed (terminal state)', async () => {
    const company = await createCompany();
    await companyWatchRepo.update({ ...company, healthStatus: 'RETIRED', active: false });

    const okService = new CompanyWatchService(companyWatchRepo, eventRepo, syncLogRepo, fakeAdapterRegistry(async () => []));
    await okService.syncCompany(company.id);

    const stillRetired = await companyWatchRepo.findById(company.id);
    expect(stillRetired?.healthStatus).toBe('RETIRED');
  });
});
