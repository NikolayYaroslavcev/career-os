import { describe, it, expect, beforeEach } from 'vitest';
import { CompanyWatchService } from '../company-watch-service.js';
import { AtsAdapterRegistry } from '../../adapters/adapter-registry.js';
import type { CompanyWatchRepository, CompanyWatchData } from '../../domain/repositories/index.js';
import type { CompanyWatchEventRepository } from '../../domain/repositories/company-watch-event-repository.js';
import type { CompanyWatchSyncLogRepository } from '../../domain/repositories/company-watch-sync-log-repository.js';

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
