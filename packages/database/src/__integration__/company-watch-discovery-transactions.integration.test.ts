import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import {
  CompanyDiscoveryIntakeService,
  CompanyWatchService,
  CandidateDeduplicationService,
  AtsAdapterRegistry,
  type CompanyCandidateRepository,
} from '@careeros/company-watch';
import { integrationTestsEnabled } from './db-guard.js';

const runIf = integrationTestsEnabled() ? describe : describe.skip;

const blankDiscoveryProbe = {
  discover: async () => ({ atsType: null, careerUrl: null, apiEndpoint: null, jsonLd: [], rss: null, sitemap: null, metadata: {} }),
};
const noAdapterRegistry = {
  has: () => false,
  get: (): never => {
    throw new Error('no fake adapter');
  },
};

/**
 * ADR-035 §4/§16 transaction-integrity coverage this phase's spec calls out
 * explicitly: no partial CompanyWatch creation, no partial CompanyCandidate
 * creation, no duplicate conversion. CompanyCandidate creation itself is
 * already a single INSERT (Postgres makes that atomic for free — nothing to
 * test there beyond the CRUD coverage in company-candidate-persistence).
 * What genuinely needed verifying: CompanyWatch and CompanyCandidate are
 * separate repositories/aggregates with no shared DB transaction spanning
 * them, so this suite exercises the two places that could leave partial
 * state — and the compensating-delete fix added to
 * CompanyDiscoveryIntakeService.convertToCompanyWatch()/
 * VacancyDiscoveryBridge.convertToCompanyWatch() for the second one.
 */
runIf('Company Watch / Discovery transaction boundaries (real Postgres)', () => {
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

  function buildIntakeService(): CompanyDiscoveryIntakeService {
    return new CompanyDiscoveryIntakeService(
      candidateRepo,
      companyWatchRepo,
      companyWatchService,
      blankDiscoveryProbe,
      noAdapterRegistry,
      new CandidateDeduplicationService()
    );
  }

  it('CompanyWatch.@@unique([workspaceId, name]) prevents a duplicate conversion: two concurrent approve() calls for the same candidate produce exactly one CompanyWatch row', async () => {
    const candidate = await candidateRepo.create({
      id: crypto.randomUUID(),
      companyName: `Race Co ${crypto.randomUUID()}`,
      careerUrl: `https://93.184.216.34/careers-${crypto.randomUUID()}`,
      atsType: 'GREENHOUSE',
      discoverySource: 'manual',
      status: 'REVIEW_REQUIRED',
      confidenceScore: 60,
      seenCount: 0,
      vacancyCount: 0,
      providerCount: 0,
      providers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    createdCandidateIds.push(candidate.id);

    const service = buildIntakeService();
    const results = await Promise.allSettled([
      service.approve(candidate.id, workspaceId),
      service.approve(candidate.id, workspaceId),
    ]);

    const fulfilled = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof service.approve>>> => r.status === 'fulfilled');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    for (const r of fulfilled) createdCompanyWatchIds.push(r.value.id);

    const rows = await prisma.companyWatch.findMany({ where: { workspaceId, name: candidate.companyName } });
    expect(rows).toHaveLength(1);
  });

  it('does not leave an orphaned CompanyWatch row when marking the candidate CONVERTED fails after the CompanyWatch row was created', async () => {
    const candidate = await candidateRepo.create({
      id: crypto.randomUUID(),
      companyName: `Orphan Guard Co ${crypto.randomUUID()}`,
      careerUrl: `https://93.184.216.34/careers-${crypto.randomUUID()}`,
      atsType: 'GREENHOUSE',
      discoverySource: 'manual',
      status: 'REVIEW_REQUIRED',
      confidenceScore: 60,
      seenCount: 0,
      vacancyCount: 0,
      providerCount: 0,
      providers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    createdCandidateIds.push(candidate.id);

    // A repo decorator that delegates every read/write to the real repo
    // untouched, except update() — which fails to simulate the exact
    // "CompanyWatch created, then the candidate-CONVERTED write fails"
    // scenario the compensating-delete fix guards against.
    const flakyCandidateRepo: CompanyCandidateRepository = {
      findById: (id) => candidateRepo.findById(id),
      findByCareerUrl: (careerUrl) => candidateRepo.findByCareerUrl(careerUrl),
      findByCompanyName: (companyName) => candidateRepo.findByCompanyName(companyName),
      findAllByStatus: (statuses, options) => candidateRepo.findAllByStatus(statuses, options),
      getStatusCounts: () => candidateRepo.getStatusCounts(),
      create: (data) => candidateRepo.create(data),
      update: async () => {
        throw new Error('simulated write failure after CompanyWatch creation');
      },
    };

    const service = new CompanyDiscoveryIntakeService(
      flakyCandidateRepo,
      companyWatchRepo,
      companyWatchService,
      blankDiscoveryProbe,
      noAdapterRegistry,
      new CandidateDeduplicationService()
    );

    await expect(service.approve(candidate.id, workspaceId)).rejects.toThrow('simulated write failure');

    const orphanCheck = await prisma.companyWatch.findMany({ where: { workspaceId, name: candidate.companyName } });
    expect(orphanCheck).toHaveLength(0);

    const persistedCandidate = await candidateRepo.findById(candidate.id);
    expect(persistedCandidate?.status).toBe('REVIEW_REQUIRED');
  });
});
