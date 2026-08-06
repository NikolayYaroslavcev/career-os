import { describe, it, expect, beforeEach } from 'vitest';
import { CompanyWatchService } from '../company-watch-service.js';
import { AtsAdapterRegistry } from '../../adapters/adapter-registry.js';
import { AtsHttpError } from '@careeros/ats-adapters';
import type { AtsAdapter, AtsJob } from '../../adapters/base-adapter.js';
import type { CompanyWatchRepository, CompanyWatchData } from '../../domain/repositories/index.js';
import type { CompanyWatchEventRepository, CompanyWatchEventData } from '../../domain/repositories/company-watch-event-repository.js';
import type { CompanyWatchSyncLogRepository, CompanyWatchSyncLogData } from '../../domain/repositories/company-watch-sync-log-repository.js';

class InMemoryCompanyWatchRepository implements CompanyWatchRepository {
  private readonly records = new Map<string, CompanyWatchData>();

  async findById(id: string): Promise<CompanyWatchData | null> {
    return this.records.get(id) ?? null;
  }

  async findByName(workspaceId: string, name: string): Promise<CompanyWatchData | null> {
    return (
      [...this.records.values()].find((c) => c.workspaceId === workspaceId && c.name === name) ?? null
    );
  }

  async findAllByWorkspace(workspaceId: string): Promise<CompanyWatchData[]> {
    return [...this.records.values()].filter((c) => c.workspaceId === workspaceId);
  }

  async findAllActive(): Promise<CompanyWatchData[]> {
    return [...this.records.values()].filter((c) => c.active);
  }

  async create(company: CompanyWatchData): Promise<CompanyWatchData> {
    this.records.set(company.id, company);
    return company;
  }

  async update(company: CompanyWatchData): Promise<CompanyWatchData> {
    this.records.set(company.id, company);
    return company;
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }

  async upsert(): Promise<CompanyWatchData> {
    throw new Error('not implemented in test double');
  }
}

const noopEventRepo = {} as CompanyWatchEventRepository;
const noopSyncLogRepo = {} as CompanyWatchSyncLogRepository;

describe('CompanyWatchService — ownership', () => {
  let repository: InMemoryCompanyWatchRepository;
  let service: CompanyWatchService;
  const workspaceId = 'workspace-1';
  const otherWorkspaceId = 'workspace-2';

  beforeEach(() => {
    repository = new InMemoryCompanyWatchRepository();
    service = new CompanyWatchService(repository, noopEventRepo, noopSyncLogRepo, new AtsAdapterRegistry());
  });

  async function createCompany(overrides: Partial<CompanyWatchData> = {}): Promise<CompanyWatchData> {
    return service.addCompany({
      name: 'Acme',
      aliases: [],
      languages: ['en'],
      tags: [],
      atsType: 'CUSTOM_HTML',
      careerUrl: 'https://93.184.216.34/careers',
      pollingInterval: 3600,
      active: true,
      workspaceId,
      ...overrides,
    });
  }

  it('getOwned returns null when the company belongs to a different workspace', async () => {
    const company = await createCompany();

    expect(await service.getOwned(company.id, otherWorkspaceId)).toBeNull();
    expect(await service.getOwned(company.id, workspaceId)).not.toBeNull();
  });

  it('updateCompany returns null (not the record) for a non-owning workspace', async () => {
    const company = await createCompany();

    const result = await service.updateCompany(company.id, otherWorkspaceId, { name: 'Hijacked' });
    expect(result).toBeNull();

    const stillThere = await repository.findById(company.id);
    expect(stillThere?.name).toBe('Acme');
  });

  it('updateCompany succeeds for the owning workspace', async () => {
    const company = await createCompany();

    const result = await service.updateCompany(company.id, workspaceId, { name: 'Acme Inc' });
    expect(result?.name).toBe('Acme Inc');
  });

  it('removeCompany returns false and does not delete for a non-owning workspace', async () => {
    const company = await createCompany();

    const result = await service.removeCompany(company.id, otherWorkspaceId);
    expect(result).toBe(false);
    expect(await repository.findById(company.id)).not.toBeNull();
  });

  it('removeCompany succeeds for the owning workspace', async () => {
    const company = await createCompany();

    const result = await service.removeCompany(company.id, workspaceId);
    expect(result).toBe(true);
    expect(await repository.findById(company.id)).toBeNull();
  });
});

describe('CompanyWatchService — SSRF protection', () => {
  let repository: InMemoryCompanyWatchRepository;
  let service: CompanyWatchService;
  const workspaceId = 'workspace-1';

  beforeEach(() => {
    repository = new InMemoryCompanyWatchRepository();
    service = new CompanyWatchService(repository, noopEventRepo, noopSyncLogRepo, new AtsAdapterRegistry());
  });

  it('rejects addCompany with an unsafe careerUrl', async () => {
    await expect(
      service.addCompany({
        name: 'Evil Corp',
        aliases: [],
        languages: ['en'],
        tags: [],
        atsType: 'CUSTOM_HTML',
        careerUrl: 'http://169.254.169.254/latest/meta-data/',
        pollingInterval: 3600,
        active: true,
        workspaceId,
      })
    ).rejects.toThrow();
  });

  it('rejects updateCompany when the new careerUrl is unsafe', async () => {
    const company = await service.addCompany({
      name: 'Acme',
      aliases: [],
      languages: ['en'],
      tags: [],
      atsType: 'CUSTOM_HTML',
      careerUrl: 'https://93.184.216.34/careers',
      pollingInterval: 3600,
      active: true,
      workspaceId,
    });

    await expect(
      service.updateCompany(company.id, workspaceId, { careerUrl: 'https://127.0.0.1/careers' })
    ).rejects.toThrow();
  });
});

class InMemoryCompanyWatchEventRepository implements CompanyWatchEventRepository {
  private readonly records = new Map<string, CompanyWatchEventData>();

  async findById(id: string): Promise<CompanyWatchEventData | null> {
    return this.records.get(id) ?? null;
  }

  async findAllByCompanyWatch(
    companyWatchId: string,
    options?: { type?: string; limit?: number; offset?: number }
  ): Promise<CompanyWatchEventData[]> {
    return [...this.records.values()].filter(
      (e) => e.companyWatchId === companyWatchId && (!options?.type || e.type === options.type)
    );
  }

  async create(event: CompanyWatchEventData): Promise<CompanyWatchEventData> {
    this.records.set(event.id, event);
    return event;
  }

  async update(event: CompanyWatchEventData): Promise<CompanyWatchEventData> {
    this.records.set(event.id, event);
    return event;
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }

  async countByCompanyWatch(companyWatchId: string, type?: string, since?: Date): Promise<number> {
    return [...this.records.values()].filter(
      (e) =>
        e.companyWatchId === companyWatchId &&
        (!type || e.type === type) &&
        (!since || e.detectedAt >= since)
    ).length;
  }
}

class InMemoryCompanyWatchSyncLogRepository implements CompanyWatchSyncLogRepository {
  private readonly records = new Map<string, CompanyWatchSyncLogData>();

  async findById(id: string): Promise<CompanyWatchSyncLogData | null> {
    return this.records.get(id) ?? null;
  }

  async findAllByCompanyWatch(companyWatchId: string): Promise<CompanyWatchSyncLogData[]> {
    return [...this.records.values()].filter((l) => l.companyWatchId === companyWatchId);
  }

  async create(log: CompanyWatchSyncLogData): Promise<CompanyWatchSyncLogData> {
    this.records.set(log.id, log);
    return log;
  }

  async update(log: CompanyWatchSyncLogData): Promise<CompanyWatchSyncLogData> {
    this.records.set(log.id, log);
    return log;
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }

  async findLatestByCompanyWatch(): Promise<CompanyWatchSyncLogData | null> {
    // Every test in this suite only ever runs one sync per company, so "no
    // previous sync" (all jobs treated as NEW_JOB) is always the right answer.
    return null;
  }
}

function makeFakeAdapterRegistry(behavior: () => Promise<AtsJob[]>): AtsAdapterRegistry {
  const adapter: AtsAdapter = {
    atsType: 'CUSTOM_HTML',
    fetchJobs: behavior,
    fetchJob: async () => null,
    ping: async () => true,
  };
  return { get: () => adapter } as unknown as AtsAdapterRegistry;
}

describe('CompanyWatchService — sync health lifecycle (ADR-035 Phase 1)', () => {
  let repository: InMemoryCompanyWatchRepository;
  let eventRepo: InMemoryCompanyWatchEventRepository;
  let syncLogRepo: InMemoryCompanyWatchSyncLogRepository;
  const workspaceId = 'workspace-1';

  async function createCompany(): Promise<CompanyWatchData> {
    const service = new CompanyWatchService(repository, eventRepo, syncLogRepo, new AtsAdapterRegistry());
    return service.addCompany({
      name: 'Acme',
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

  beforeEach(() => {
    repository = new InMemoryCompanyWatchRepository();
    eventRepo = new InMemoryCompanyWatchEventRepository();
    syncLogRepo = new InMemoryCompanyWatchSyncLogRepository();
  });

  it('a successful sync keeps healthStatus ACTIVE and resets consecutiveFailureCount', async () => {
    const company = await createCompany();
    const service = new CompanyWatchService(
      repository,
      eventRepo,
      syncLogRepo,
      makeFakeAdapterRegistry(async () => [])
    );

    const result = await service.syncCompany(company.id);

    expect(result.success).toBe(true);
    const updated = await repository.findById(company.id);
    expect(updated?.healthStatus).toBe('ACTIVE');
    expect(updated?.consecutiveFailureCount).toBe(0);
  });

  it('a transient (AtsHttpError) failure moves ACTIVE -> DEGRADED on the first occurrence', async () => {
    const company = await createCompany();
    const service = new CompanyWatchService(
      repository,
      eventRepo,
      syncLogRepo,
      makeFakeAdapterRegistry(async () => {
        throw new AtsHttpError('rate limited', 429, 'Too Many Requests');
      })
    );

    const result = await service.syncCompany(company.id);

    expect(result.success).toBe(false);
    const updated = await repository.findById(company.id);
    expect(updated?.consecutiveFailureCount).toBe(1);
    expect(updated?.healthStatus).toBe('DEGRADED');
  });

  it('3 consecutive transient failures move DEGRADED -> BROKEN', async () => {
    const company = await createCompany();
    const service = new CompanyWatchService(
      repository,
      eventRepo,
      syncLogRepo,
      makeFakeAdapterRegistry(async () => {
        throw new AtsHttpError('server error', 500, 'Internal Server Error');
      })
    );

    await service.syncCompany(company.id);
    await service.syncCompany(company.id);
    const result = await service.syncCompany(company.id);

    expect(result.success).toBe(false);
    const updated = await repository.findById(company.id);
    expect(updated?.consecutiveFailureCount).toBe(3);
    expect(updated?.healthStatus).toBe('BROKEN');
  });

  it('a structural (non-AtsHttpError) failure fast-tracks to BROKEN on the 2nd occurrence, not the 3rd', async () => {
    const company = await createCompany();
    const service = new CompanyWatchService(
      repository,
      eventRepo,
      syncLogRepo,
      makeFakeAdapterRegistry(async () => {
        throw new TypeError('could not parse ATS response shape');
      })
    );

    await service.syncCompany(company.id);
    const result = await service.syncCompany(company.id);

    expect(result.success).toBe(false);
    const updated = await repository.findById(company.id);
    expect(updated?.consecutiveFailureCount).toBe(2);
    expect(updated?.healthStatus).toBe('BROKEN');
  });

  it('a success after being BROKEN recovers to ACTIVE and resets the failure count', async () => {
    const company = await createCompany();
    const failingService = new CompanyWatchService(
      repository,
      eventRepo,
      syncLogRepo,
      makeFakeAdapterRegistry(async () => {
        throw new AtsHttpError('server error', 500, 'Internal Server Error');
      })
    );
    await failingService.syncCompany(company.id);
    await failingService.syncCompany(company.id);
    await failingService.syncCompany(company.id);
    const broken = await repository.findById(company.id);
    expect(broken?.healthStatus).toBe('BROKEN');

    const recoveringService = new CompanyWatchService(
      repository,
      eventRepo,
      syncLogRepo,
      makeFakeAdapterRegistry(async () => [])
    );
    await recoveringService.syncCompany(company.id);

    const recovered = await repository.findById(company.id);
    expect(recovered?.healthStatus).toBe('ACTIVE');
    expect(recovered?.consecutiveFailureCount).toBe(0);
  });

  it('priorityScore/pollingInterval increase when a sync finds NEW_JOB events, vs. a quiet sync', async () => {
    const quietCompany = await createCompany();
    const quietService = new CompanyWatchService(
      repository,
      eventRepo,
      syncLogRepo,
      makeFakeAdapterRegistry(async () => [])
    );
    await quietService.syncCompany(quietCompany.id);
    const quiet = await repository.findById(quietCompany.id);

    const busyCompany = await createCompany();
    const busyService = new CompanyWatchService(
      repository,
      eventRepo,
      syncLogRepo,
      makeFakeAdapterRegistry(async () => [
        {
          externalId: 'job-1',
          title: 'Engineer',
          description: 'Build things',
          url: 'https://example.com/jobs/1',
        },
      ])
    );
    await busyService.syncCompany(busyCompany.id);
    const busy = await repository.findById(busyCompany.id);

    expect(busy!.priorityScore).toBeGreaterThan(quiet!.priorityScore);
    expect(busy!.pollingInterval).toBeLessThan(quiet!.pollingInterval);
  });
});
