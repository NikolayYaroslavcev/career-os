import { describe, it, expect, beforeEach } from 'vitest';
import { CompanyDiscoveryIntakeService, type DiscoveryProbe, type AtsRegistryProbe } from '../company-discovery-intake-service.js';
import { CandidateDeduplicationService } from '../candidate-deduplication-service.js';
import { CompanyWatchService } from '../company-watch-service.js';
import { AtsAdapterRegistry } from '../../adapters/adapter-registry.js';
import type { AtsAdapter, AtsJob } from '../../adapters/base-adapter.js';
import type { AtsType } from '../../domain/value-objects/ats-type.js';
import type {
  CompanyCandidateRepository,
  CompanyCandidateData,
  CompanyWatchRepository,
  CompanyWatchData,
  CompanyWatchEventRepository,
  CompanyWatchSyncLogRepository,
} from '../../domain/repositories/index.js';
import type { CompanyCandidateStatus } from '../../domain/entities/company-candidate.js';
import type { DiscoveryResult } from '../company-discovery-service.js';

const CAREER_URL = 'https://93.184.216.34/careers';

class InMemoryCompanyCandidateRepository implements CompanyCandidateRepository {
  private readonly records = new Map<string, CompanyCandidateData>();

  async findById(id: string): Promise<CompanyCandidateData | null> {
    return this.records.get(id) ?? null;
  }

  async findByCareerUrl(careerUrl: string): Promise<CompanyCandidateData | null> {
    return [...this.records.values()].find((c) => c.careerUrl === careerUrl) ?? null;
  }

  async findAllByStatus(statuses: readonly CompanyCandidateStatus[]): Promise<CompanyCandidateData[]> {
    return [...this.records.values()].filter((c) => statuses.includes(c.status));
  }

  async getStatusCounts(): Promise<Record<CompanyCandidateStatus, number>> {
    const counts: Record<CompanyCandidateStatus, number> = {
      DISCOVERED: 0,
      AUTO_APPROVED: 0,
      REVIEW_REQUIRED: 0,
      REJECTED: 0,
      CONVERTED: 0,
    };
    for (const record of this.records.values()) counts[record.status]++;
    return counts;
  }

  async create(data: CompanyCandidateData): Promise<CompanyCandidateData> {
    this.records.set(data.id, data);
    return data;
  }

  async update(data: CompanyCandidateData): Promise<CompanyCandidateData> {
    this.records.set(data.id, data);
    return data;
  }
}

class InMemoryCompanyWatchRepository implements CompanyWatchRepository {
  private readonly records = new Map<string, CompanyWatchData>();

  async findById(id: string): Promise<CompanyWatchData | null> {
    return this.records.get(id) ?? null;
  }

  async findByName(workspaceId: string, name: string): Promise<CompanyWatchData | null> {
    return [...this.records.values()].find((c) => c.workspaceId === workspaceId && c.name === name) ?? null;
  }

  async findAllByWorkspace(workspaceId: string): Promise<CompanyWatchData[]> {
    return [...this.records.values()].filter((c) => c.workspaceId === workspaceId);
  }

  async findAllActive(): Promise<CompanyWatchData[]> {
    return [...this.records.values()].filter((c) => c.active);
  }

  async create(data: CompanyWatchData): Promise<CompanyWatchData> {
    this.records.set(data.id, data);
    return data;
  }

  async update(data: CompanyWatchData): Promise<CompanyWatchData> {
    this.records.set(data.id, data);
    return data;
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }

  async upsert(): Promise<CompanyWatchData> {
    throw new Error('not implemented in test double');
  }
}

function discoveryResult(overrides: Partial<DiscoveryResult> = {}): DiscoveryResult {
  return {
    atsType: null,
    careerUrl: null,
    apiEndpoint: null,
    jsonLd: [],
    rss: null,
    sitemap: null,
    metadata: {},
    ...overrides,
  };
}

function fakeAdapter(overrides: Partial<Pick<AtsAdapter, 'ping' | 'fetchJobs'>>): Pick<AtsAdapter, 'ping' | 'fetchJobs'> {
  return {
    ping: async () => true,
    fetchJobs: async () => [{ externalId: '1', title: 'Engineer', description: '', url: CAREER_URL }] as AtsJob[],
    ...overrides,
  };
}

class FakeAtsRegistry implements AtsRegistryProbe {
  constructor(private readonly adapters: Partial<Record<AtsType, Pick<AtsAdapter, 'ping' | 'fetchJobs'>>>) {}
  has(atsType: AtsType): boolean {
    return atsType in this.adapters;
  }
  get(atsType: AtsType): Pick<AtsAdapter, 'ping' | 'fetchJobs'> {
    const adapter = this.adapters[atsType];
    if (!adapter) throw new Error(`No fake adapter for ${atsType}`);
    return adapter;
  }
}

describe('CompanyDiscoveryIntakeService', () => {
  let candidateRepo: InMemoryCompanyCandidateRepository;
  let companyWatchRepo: InMemoryCompanyWatchRepository;
  let companyWatchService: CompanyWatchService;

  beforeEach(() => {
    candidateRepo = new InMemoryCompanyCandidateRepository();
    companyWatchRepo = new InMemoryCompanyWatchRepository();
    companyWatchService = new CompanyWatchService(
      companyWatchRepo,
      {} as CompanyWatchEventRepository,
      {} as CompanyWatchSyncLogRepository,
      new AtsAdapterRegistry()
    );
  });

  function buildService(opts: {
    discovery: DiscoveryResult;
    adapters?: Partial<Record<AtsType, Pick<AtsAdapter, 'ping' | 'fetchJobs'>>>;
    autoEnrollWorkspaceId?: string;
  }): CompanyDiscoveryIntakeService {
    const discoveryProbe: DiscoveryProbe = { discover: async () => opts.discovery };
    const registry = new FakeAtsRegistry(opts.adapters ?? {});
    return new CompanyDiscoveryIntakeService(
      candidateRepo,
      companyWatchRepo,
      companyWatchService,
      discoveryProbe,
      registry,
      new CandidateDeduplicationService(),
      opts.autoEnrollWorkspaceId
    );
  }

  it('short-circuits as DUPLICATE against an existing active CompanyWatch, without creating a candidate row', async () => {
    await companyWatchRepo.create({
      id: 'cw-1',
      name: 'Acme Inc',
      aliases: [],
      languages: ['en'],
      tags: [],
      atsType: 'GREENHOUSE',
      careerUrl: CAREER_URL,
      pollingInterval: 3600,
      active: true,
      workspaceId: 'ws-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      consecutiveFailureCount: 0,
      healthStatus: 'ACTIVE',
      priorityScore: 50,
    });

    const service = buildService({ discovery: discoveryResult() });
    const outcome = await service.discover({ companyName: 'Acme, Inc.', url: 'https://acme.example/careers' });

    expect(outcome.outcome).toBe('DUPLICATE');
    expect(await candidateRepo.findByCareerUrl('https://acme.example/careers')).toBeNull();
  });

  it('routes a structured, reachable, job-signal-verified candidate to REVIEW_REQUIRED in single-shot mode (vacancy pipeline signals needed for auto-enroll)', async () => {
    const service = buildService({
      discovery: discoveryResult({
        atsType: 'GREENHOUSE',
        careerUrl: CAREER_URL,
        apiEndpoint: 'https://boards-api.greenhouse.io/v1/boards/acme/jobs',
      }),
      adapters: { GREENHOUSE: fakeAdapter({}) },
      autoEnrollWorkspaceId: 'discovery-ws',
    });

    const outcome = await service.discover({ companyName: 'Acme Inc', url: CAREER_URL });
    expect(outcome.outcome).toBe('SCORED');
    if (outcome.outcome !== 'SCORED') throw new Error('unreachable');
    expect(outcome.candidate.status).toBe('REVIEW_REQUIRED');
  });

  it('leaves an AUTO_APPROVED candidate unconverted when no discovery workspace is configured', async () => {
    const service = buildService({
      discovery: discoveryResult({
        atsType: 'GREENHOUSE',
        careerUrl: CAREER_URL,
        apiEndpoint: 'https://boards-api.greenhouse.io/v1/boards/acme/jobs',
      }),
      adapters: { GREENHOUSE: fakeAdapter({}) },
    });

    const outcome = await service.discover({ companyName: 'Acme Inc', url: CAREER_URL });
    if (outcome.outcome !== 'SCORED') throw new Error('unreachable');
    expect(outcome.candidate.status).toBe('REVIEW_REQUIRED');
  });

  it('routes a fully-verified CUSTOM_HTML fingerprint to REVIEW_REQUIRED, never AUTO_APPROVED (ADR-035 §4 — the never-auto-enroll rule is also unit-tested directly in discovery-confidence.test.ts)', async () => {
    const service = buildService({
      discovery: discoveryResult({ atsType: 'CUSTOM_HTML', careerUrl: CAREER_URL }),
      adapters: { CUSTOM_HTML: fakeAdapter({}) },
      autoEnrollWorkspaceId: 'discovery-ws',
    });

    const outcome = await service.discover({ companyName: 'Acme Inc', url: CAREER_URL });
    if (outcome.outcome !== 'SCORED') throw new Error('unreachable');
    expect(outcome.candidate.status).toBe('REVIEW_REQUIRED');
  });

  it('rejects a candidate whose fingerprinting fails entirely', async () => {
    const service = buildService({ discovery: discoveryResult() });
    const outcome = await service.discover({ companyName: 'Ghost Co', url: CAREER_URL });
    if (outcome.outcome !== 'SCORED') throw new Error('unreachable');
    expect(outcome.candidate.status).toBe('REJECTED');
  });

  it.each(['t.me', 'telegram.me', 'telegram.org', 'teletype.in', 'telegra.ph'])(
    'blocks a denylisted URL (%s) before creating a CompanyCandidate row',
    async (host) => {
      const service = buildService({ discovery: discoveryResult() });
      const outcome = await service.discover({ companyName: 'Acme Inc', url: `https://${host}/acmecorp` });

      expect(outcome.outcome).toBe('BLOCKED');
      expect(await candidateRepo.findByCareerUrl(`https://${host}/acmecorp`)).toBeNull();
    }
  );

  it('does not block a lookalike domain (evil-telegram.me)', async () => {
    const service = buildService({ discovery: discoveryResult() });
    const outcome = await service.discover({ companyName: 'Acme Inc', url: 'https://evil-telegram.me/careers' });

    expect(outcome.outcome).not.toBe('BLOCKED');
  });

  it('does not block an ordinary company homepage/root URL', async () => {
    const service = buildService({ discovery: discoveryResult() });
    const outcome = await service.discover({ companyName: 'Acme Inc', url: 'https://acme.example/' });

    expect(outcome.outcome).not.toBe('BLOCKED');
  });

  it('is idempotent for repeated discovery of the same URL — returns the existing candidate without re-fingerprinting', async () => {
    let discoverCalls = 0;
    const discoveryProbe: DiscoveryProbe = {
      discover: async () => {
        discoverCalls++;
        return discoveryResult({ atsType: 'GREENHOUSE', careerUrl: CAREER_URL });
      },
    };
    const service = new CompanyDiscoveryIntakeService(
      candidateRepo,
      companyWatchRepo,
      companyWatchService,
      discoveryProbe,
      new FakeAtsRegistry({ GREENHOUSE: fakeAdapter({}) }),
      new CandidateDeduplicationService()
    );

    const first = await service.discover({ companyName: 'Acme Inc', url: CAREER_URL });
    const second = await service.discover({ companyName: 'Acme Inc', url: CAREER_URL });

    expect(discoverCalls).toBe(1);
    if (first.outcome !== 'SCORED' || second.outcome !== 'SCORED') throw new Error('unreachable');
    expect(second.candidate.id).toBe(first.candidate.id);
  });

  describe('approve/reject', () => {
    it('approve() converts a REVIEW_REQUIRED candidate into a CompanyWatch row and marks it CONVERTED', async () => {
      const service = buildService({ discovery: discoveryResult() });
      await candidateRepo.create({
        id: 'cand-1',
        companyName: 'Acme Inc',
        careerUrl: CAREER_URL,
        atsType: 'CUSTOM_HTML',
        discoverySource: 'manual',
        status: 'REVIEW_REQUIRED',
        confidenceScore: 60,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const companyWatch = await service.approve('cand-1', 'ws-1');
      expect(companyWatch.workspaceId).toBe('ws-1');

      const candidate = await candidateRepo.findById('cand-1');
      expect(candidate?.status).toBe('CONVERTED');
      expect(candidate?.metadata?.companyWatchId).toBe(companyWatch.id);
    });

    it('approve() throws for a candidate that is not in an approvable status', async () => {
      const service = buildService({ discovery: discoveryResult() });
      await candidateRepo.create({
        id: 'cand-2',
        companyName: 'Acme Inc',
        careerUrl: CAREER_URL,
        discoverySource: 'manual',
        status: 'REJECTED',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(service.approve('cand-2', 'ws-1')).rejects.toThrow();
    });

    it('reject() sets status REJECTED and stores the reason', async () => {
      const service = buildService({ discovery: discoveryResult() });
      await candidateRepo.create({
        id: 'cand-3',
        companyName: 'Acme Inc',
        careerUrl: CAREER_URL,
        discoverySource: 'manual',
        status: 'REVIEW_REQUIRED',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const rejected = await service.reject('cand-3', 'not a real company');
      expect(rejected.status).toBe('REJECTED');
      expect(rejected.metadata?.rejectionReason).toBe('not a real company');
    });
  });
});
