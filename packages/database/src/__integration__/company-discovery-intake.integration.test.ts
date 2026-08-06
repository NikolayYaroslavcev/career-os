import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import {
  CompanyDiscoveryIntakeService,
  CompanyWatchService,
  CandidateDeduplicationService,
  AtsAdapterRegistry,
  type DiscoveryResult,
} from '@careeros/company-watch';
import type { AtsAdapter, AtsJob, AtsType } from '@careeros/company-watch';
import { integrationTestsEnabled } from './db-guard.js';

const runIf = integrationTestsEnabled() ? describe : describe.skip;

// DiscoveryProbe/AtsRegistryProbe are structural interfaces internal to
// company-discovery-intake-service.ts (not re-exported from the package
// root) — the plain objects below satisfy them by shape, same as the
// package's own unit tests do.
function discoveryProbe(result: Partial<DiscoveryResult>) {
  return {
    discover: async () => ({
      atsType: null,
      careerUrl: null,
      apiEndpoint: null,
      jsonLd: [],
      rss: null,
      sitemap: null,
      metadata: {},
      ...result,
    }),
  };
}

function fakeAdapter(jobs: AtsJob[]): Pick<AtsAdapter, 'ping' | 'fetchJobs'> {
  return { ping: async () => true, fetchJobs: async () => jobs };
}

/**
 * A single-character insertion at the start of the name — a fixed, small
 * Levenshtein edit distance that stays comfortably above
 * CANDIDATE_DUPLICATE_SIMILARITY_THRESHOLD (0.92) no matter how long the
 * rest of the (UUID-suffixed, per-test-unique) name is.
 */
function nearDuplicateName(name: string): string {
  return name.replace(/^(\w)/, '$1$1');
}

class FakeAtsRegistry {
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

// ADR-035 Phase 2 — CompanyDiscoveryIntakeService orchestrating real
// CompanyCandidateRepository/CompanyWatchRepository/CompanyWatchService
// against real Postgres. Unit tests (company-discovery-intake-service.test.ts)
// already cover this same logic against in-memory repositories — this suite
// exists to catch anything that only breaks against the real Prisma mapping
// (unique constraints, JSON columns, enum round-tripping), not to re-litigate
// the routing rules themselves.
runIf('CompanyDiscoveryIntakeService (real Postgres)', () => {
  let prisma: import('@prisma/client').PrismaClient;
  let PrismaCompanyCandidateRepository: typeof import('../infrastructure/prisma-company-candidate-repository.js').PrismaCompanyCandidateRepository;
  let PrismaCompanyWatchRepository: typeof import('../infrastructure/prisma-company-watch-repository.js').PrismaCompanyWatchRepository;
  let PrismaCompanyWatchEventRepository: typeof import('../infrastructure/prisma-company-watch-event-repository.js').PrismaCompanyWatchEventRepository;
  let PrismaCompanyWatchSyncLogRepository: typeof import('../infrastructure/prisma-company-watch-sync-log-repository.js').PrismaCompanyWatchSyncLogRepository;

  let workspaceId: string;
  let candidateRepo: InstanceType<typeof PrismaCompanyCandidateRepository>;
  let companyWatchRepo: InstanceType<typeof PrismaCompanyWatchRepository>;
  let companyWatchService: CompanyWatchService;
  const createdCandidateIds: string[] = [];
  const createdCompanyWatchIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import('../client.js'));
    ({ PrismaCompanyCandidateRepository } = await import('../infrastructure/prisma-company-candidate-repository.js'));
    ({ PrismaCompanyWatchRepository } = await import('../infrastructure/prisma-company-watch-repository.js'));
    ({ PrismaCompanyWatchEventRepository } = await import('../infrastructure/prisma-company-watch-event-repository.js'));
    ({ PrismaCompanyWatchSyncLogRepository } = await import('../infrastructure/prisma-company-watch-sync-log-repository.js'));

    const workspace = await prisma.workspace.create({ data: { name: `integration-test-${crypto.randomUUID()}` } });
    workspaceId = workspace.id;

    candidateRepo = new PrismaCompanyCandidateRepository();
    companyWatchRepo = new PrismaCompanyWatchRepository();
    companyWatchService = new CompanyWatchService(
      companyWatchRepo,
      new PrismaCompanyWatchEventRepository(),
      new PrismaCompanyWatchSyncLogRepository(),
      new AtsAdapterRegistry()
    );
  });

  afterAll(async () => {
    await prisma.workspace.delete({ where: { id: workspaceId } });
  });

  afterEach(async () => {
    if (createdCompanyWatchIds.length) {
      await prisma.companyWatch.deleteMany({ where: { id: { in: createdCompanyWatchIds.splice(0) } } });
    }
    if (createdCandidateIds.length) {
      await prisma.companyCandidate.deleteMany({ where: { id: { in: createdCandidateIds.splice(0) } } });
    }
  });

  function buildService(opts: {
    discovery: Partial<DiscoveryResult>;
    adapters?: Partial<Record<AtsType, Pick<AtsAdapter, 'ping' | 'fetchJobs'>>>;
    autoEnrollWorkspaceId?: string;
  }): CompanyDiscoveryIntakeService {
    return new CompanyDiscoveryIntakeService(
      candidateRepo,
      companyWatchRepo,
      companyWatchService,
      discoveryProbe(opts.discovery),
      new FakeAtsRegistry(opts.adapters ?? {}),
      new CandidateDeduplicationService(),
      opts.autoEnrollWorkspaceId
    );
  }

  it('persists a DISCOVERED -> REJECTED candidate through real Postgres when fingerprinting finds nothing', async () => {
    const url = `https://93.184.216.34/careers-${crypto.randomUUID()}`;
    const service = buildService({ discovery: {} });

    const outcome = await service.discover({ companyName: `Ghost Co ${crypto.randomUUID()}`, url });
    if (outcome.outcome !== 'SCORED') throw new Error('unreachable');
    createdCandidateIds.push(outcome.candidate.id);

    const persisted = await candidateRepo.findByCareerUrl(url);
    expect(persisted?.status).toBe('REJECTED');
    expect(persisted?.metadata?.confidenceBreakdown).toBeDefined();
  });

  it('short-circuits as DUPLICATE (Levenshtein) against a real, already-enrolled CompanyWatch, without creating a candidate row', async () => {
    const existing = await companyWatchService.addCompany({
      name: `Acme Incorporated ${crypto.randomUUID()}`,
      aliases: [],
      languages: ['en'],
      tags: [],
      atsType: 'GREENHOUSE',
      careerUrl: `https://93.184.216.34/careers-${crypto.randomUUID()}`,
      pollingInterval: 3600,
      active: true,
      workspaceId,
    });
    createdCompanyWatchIds.push(existing.id);

    const service = buildService({ discovery: {} });
    const url = `https://93.184.216.34/careers-${crypto.randomUUID()}`;
    // Near-miss name (not an exact string match) — must be caught by
    // Levenshtein similarity, not an exact-string comparison.
    const outcome = await service.discover({ companyName: nearDuplicateName(existing.name), url });

    expect(outcome.outcome).toBe('DUPLICATE');
    expect(await candidateRepo.findByCareerUrl(url)).toBeNull();
  });

  it('routes a structured+reachable+job-signal GREENHOUSE fingerprint through scoring, and approve() converts it into a real CompanyWatch row', async () => {
    const url = `https://93.184.216.34/careers-${crypto.randomUUID()}`;
    const service = buildService({
      discovery: {
        atsType: 'GREENHOUSE',
        careerUrl: url,
        apiEndpoint: 'https://boards-api.greenhouse.io/v1/boards/acme/jobs',
      },
      adapters: { GREENHOUSE: fakeAdapter([{ externalId: '1', title: 'Engineer', description: '', url }]) },
    });

    const outcome = await service.discover({ companyName: `Acme Discover Co ${crypto.randomUUID()}`, url });
    if (outcome.outcome !== 'SCORED') throw new Error('unreachable');
    createdCandidateIds.push(outcome.candidate.id);
    expect(outcome.candidate.status).toBe('REVIEW_REQUIRED');

    const companyWatch = await service.approve(outcome.candidate.id, workspaceId);
    createdCompanyWatchIds.push(companyWatch.id);

    expect(companyWatch.workspaceId).toBe(workspaceId);
    expect(companyWatch.atsType).toBe('GREENHOUSE');
    const persistedCandidate = await candidateRepo.findById(outcome.candidate.id);
    expect(persistedCandidate?.status).toBe('CONVERTED');
    expect(persistedCandidate?.metadata?.companyWatchId).toBe(companyWatch.id);
    const persistedWatch = await companyWatchRepo.findById(companyWatch.id);
    expect(persistedWatch).not.toBeNull();
  });

  it('reject() persists REJECTED with the reason through real Postgres', async () => {
    const url = `https://93.184.216.34/careers-${crypto.randomUUID()}`;
    const service = buildService({ discovery: { atsType: 'CUSTOM_HTML', careerUrl: url } });
    const outcome = await service.discover({ companyName: `Reject Me Co ${crypto.randomUUID()}`, url });
    if (outcome.outcome !== 'SCORED') throw new Error('unreachable');
    createdCandidateIds.push(outcome.candidate.id);

    const rejected = await service.reject(outcome.candidate.id, 'not a real hiring page');
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.metadata?.rejectionReason).toBe('not a real hiring page');

    const persisted = await candidateRepo.findById(outcome.candidate.id);
    expect(persisted?.status).toBe('REJECTED');
  });

  it('finding: single-shot discovery cannot reach AUTO_APPROVED even with a maximally-verified fingerprint — the vacancyPipeline category (20% weight) is structurally unreachable outside VacancyDiscoveryBridge, capping single-shot score at 80 < the 85 auto-enroll threshold', async () => {
    const url = `https://93.184.216.34/careers-${crypto.randomUUID()}`;
    // Best possible single-shot signals: STRUCTURED_MATCH ATS type (30%),
    // reachable (15%), job signal found (20%), max source authority (10%),
    // zero dedup distance (5%) = 80% of the weighted total. computeDiscoveryConfidence's
    // vacancyPipeline category (20% weight) is only ever populated by
    // VacancyDiscoveryBridge (see vacancy-discovery-bridge.integration.test.ts) —
    // CompanyDiscoveryIntakeService.discover() never passes vacancyPipelineSignals,
    // so single-shot discovery cannot structurally cross the 85 AUTO_APPROVED band.
    const service = buildService({
      discovery: {
        atsType: 'GREENHOUSE',
        careerUrl: url,
        apiEndpoint: 'https://boards-api.greenhouse.io/v1/boards/acme/jobs',
      },
      adapters: { GREENHOUSE: fakeAdapter([{ externalId: '1', title: 'Engineer', description: '', url }]) },
      autoEnrollWorkspaceId: workspaceId,
    });

    const outcome = await service.discover({ companyName: `Auto Enroll Co ${crypto.randomUUID()}`, url });
    if (outcome.outcome !== 'SCORED') throw new Error('unreachable');
    createdCandidateIds.push(outcome.candidate.id);

    expect(outcome.candidate.confidenceScore).toBeLessThan(85);
    expect(outcome.candidate.status).toBe('REVIEW_REQUIRED');
    // Not auto-converted — stays a standalone candidate until a human approves it.
    const persistedCandidate = await candidateRepo.findById(outcome.candidate.id);
    expect(persistedCandidate?.status).toBe('REVIEW_REQUIRED');
  });

  it('is idempotent for repeated discovery of the same URL against real Postgres — returns the existing row, does not create a second one', async () => {
    const url = `https://93.184.216.34/careers-${crypto.randomUUID()}`;
    const service = buildService({ discovery: { atsType: 'GREENHOUSE', careerUrl: url } });

    const first = await service.discover({ companyName: `Idempotent Co ${crypto.randomUUID()}`, url });
    if (first.outcome !== 'SCORED') throw new Error('unreachable');
    createdCandidateIds.push(first.candidate.id);
    const second = await service.discover({ companyName: 'Idempotent Co (retry)', url });

    if (second.outcome !== 'SCORED') throw new Error('unreachable');
    expect(second.candidate.id).toBe(first.candidate.id);

    const all = await prisma.companyCandidate.findMany({ where: { careerUrl: url } });
    expect(all).toHaveLength(1);
  });
});
