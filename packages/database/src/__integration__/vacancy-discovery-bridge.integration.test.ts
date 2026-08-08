import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import {
  VacancyDiscoveryBridge,
  CompanyWatchService,
  CandidateDeduplicationService,
  AtsAdapterRegistry,
  type VacancyForDiscovery,
  type VacancyDiscoveryLogger,
} from '@careeros/company-watch';
import { integrationTestsEnabled } from './db-guard.js';

const runIf = integrationTestsEnabled() ? describe : describe.skip;

const noopLogger: VacancyDiscoveryLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

function vacancy(overrides: Partial<VacancyForDiscovery> = {}): VacancyForDiscovery {
  return {
    companyName: `Bridge Co ${crypto.randomUUID()}`,
    companyUrl: 'https://93.184.216.34',
    title: 'Senior Engineer',
    ...overrides,
  };
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

// ADR-035 Phase 3 — VacancyDiscoveryBridge orchestrating real
// CompanyCandidateRepository/CompanyWatchRepository/CompanyWatchService
// against real Postgres. Unit tests (vacancy-discovery-bridge.test.ts) cover
// the routing/scoring logic against mocks; this suite verifies the same
// flows actually persist correctly (increments, timestamps, conversion)
// through the real Prisma mapping.
runIf('VacancyDiscoveryBridge (real Postgres)', () => {
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

  // No-fingerprint discovery probe: bridge candidates in these tests stay
  // unfingerprinted (atsType undefined) unless a test overrides it — mirrors
  // "no discovery service reachable" as the conservative default.
  const blankDiscoveryProbe = { discover: async () => ({ atsType: null, careerUrl: null, apiEndpoint: null, jsonLd: [], rss: null, sitemap: null, metadata: {} }) };
  const noAdapterRegistry = { has: () => false, get: () => { throw new Error('no fake adapter'); } };

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

  function buildBridge(autoEnrollWorkspaceId?: string): VacancyDiscoveryBridge {
    return new VacancyDiscoveryBridge(
      candidateRepo,
      companyWatchRepo,
      companyWatchService,
      blankDiscoveryProbe,
      noAdapterRegistry,
      new CandidateDeduplicationService(),
      { autoEnrollWorkspaceId, sourceAuthorityScore: 30 },
      noopLogger
    );
  }

  it('creates a new CompanyCandidate row from a provider vacancy, with firstSeenAt/lastSeenAt/seenCount/companyUrl persisted', async () => {
    const bridge = buildBridge();
    const v = vacancy();

    const result = await bridge.processVacancies([v], 'hh');
    expect(result.newCandidates).toBe(1);

    const persisted = await candidateRepo.findByCompanyName(v.companyName);
    if (!persisted) throw new Error('candidate not persisted');
    createdCandidateIds.push(persisted.id);

    expect(persisted.careerUrl).toBe(v.companyUrl);
    expect(persisted.seenCount).toBe(1);
    expect(persisted.vacancyCount).toBe(1);
    expect(persisted.providerCount).toBe(1);
    expect(persisted.providers).toEqual(['hh']);
    expect(persisted.lastVacancyTitle).toBe(v.title);
    expect(persisted.firstSeenAt).toBeInstanceOf(Date);
    expect(persisted.lastSeenAt).toBeInstanceOf(Date);
  });

  it('accumulates seenCount/vacancyCount/providerCount across multiple provider syncs for the same company, keeping firstSeenAt stable while lastSeenAt advances', async () => {
    // Seeded directly at REVIEW_REQUIRED (rather than created via a first
    // processVacancies() call) so this test isolates pure accumulation
    // behaviour without depending on the first-sighting scoring path, which
    // a brand-new candidate would start well below (see the "re-discovery
    // after rejection" test below for that path).
    const name = `Multi Sync Co ${crypto.randomUUID()}`;
    const firstSeenAt = new Date(Date.now() - 60_000);
    const seed = await candidateRepo.create({
      id: crypto.randomUUID(),
      companyName: name,
      careerUrl: 'https://93.184.216.34/careers',
      discoverySource: 'vacancy_sync:hh',
      status: 'REVIEW_REQUIRED',
      confidenceScore: 55,
      firstSeenAt,
      lastSeenAt: firstSeenAt,
      seenCount: 1,
      vacancyCount: 1,
      providerCount: 1,
      providers: ['hh'],
      lastVacancyTitle: 'Backend Engineer',
      createdAt: firstSeenAt,
      updatedAt: firstSeenAt,
    });
    createdCandidateIds.push(seed.id);

    const bridge = buildBridge();
    await bridge.processVacancies([vacancy({ companyName: name, title: 'Frontend Engineer' })], 'remotive');
    const afterSecond = await candidateRepo.findByCompanyName(name);

    expect(afterSecond?.id).toBe(seed.id);
    expect(afterSecond?.seenCount).toBe(2);
    expect(afterSecond?.vacancyCount).toBe(2);
    expect(afterSecond?.providerCount).toBe(2);
    expect(afterSecond?.providers).toEqual(['hh', 'remotive']);
    expect(afterSecond?.lastVacancyTitle).toBe('Frontend Engineer');
    expect(afterSecond?.firstSeenAt?.getTime()).toBe(firstSeenAt.getTime());
    expect(afterSecond?.lastSeenAt?.getTime() ?? 0).toBeGreaterThan(firstSeenAt.getTime());
  });

  it('accumulates sightings on the same row across syncs even after the first sighting scored REJECTED, instead of inserting a duplicate row', async () => {
    // A brand-new company with no ATS fingerprint, no reachability, and no
    // job signal scores well under 50 on its very first vacancy sighting, so
    // it starts life REJECTED. findByCompanyName() must still find that row
    // on the next sync (it only excludes CONVERTED) — otherwise every
    // provider sync that resurfaces the company's vacancy re-runs discovery
    // and inserts another REJECTED row for the same company/URL, which is
    // exactly what was observed in production for repeat vacancy_sync
    // submissions of the same homepage URL.
    const bridge = buildBridge();
    const name = `Cold Start Co ${crypto.randomUUID()}`;

    await bridge.processVacancies([vacancy({ companyName: name })], 'hh');
    const rejectedRow = await prisma.companyCandidate.findFirst({ where: { companyName: name } });
    expect(rejectedRow?.status).toBe('REJECTED');
    if (rejectedRow) createdCandidateIds.push(rejectedRow.id);

    const foundByName = await candidateRepo.findByCompanyName(name);
    expect(foundByName?.id).toBe(rejectedRow?.id);

    await bridge.processVacancies([vacancy({ companyName: name })], 'remotive');
    const allRows = await prisma.companyCandidate.findMany({ where: { companyName: name } });
    createdCandidateIds.push(...allRows.map((r) => r.id));

    expect(allRows.length).toBe(1);
    expect(allRows[0]?.seenCount).toBe(2);
    expect(allRows[0]?.providers).toEqual(['hh', 'remotive']);
    expect(allRows[0]?.status).toBe('REJECTED');
  });

  it('auto-converts to a real CompanyWatch row once seenCount/vacancyCount thresholds are crossed with an auto-enroll workspace configured', async () => {
    const name = `Auto Convert Bridge Co ${crypto.randomUUID()}`;
    // Seed a candidate already past VACANCY_PIPELINE_MIN_SEEN_COUNT (3) /
    // VACANCY_PIPELINE_MIN_VACANCY_COUNT (2) with a real, auto-enrollable ATS type.
    const seed = await candidateRepo.create({
      id: crypto.randomUUID(),
      companyName: name,
      careerUrl: 'https://93.184.216.34/careers',
      atsType: 'GREENHOUSE',
      discoverySource: 'vacancy_sync:hh',
      status: 'REVIEW_REQUIRED',
      confidenceScore: 60,
      seenCount: 3,
      vacancyCount: 2,
      providerCount: 2,
      providers: ['hh', 'remotive'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    createdCandidateIds.push(seed.id);

    const bridge = buildBridge(workspaceId);
    const result = await bridge.processVacancies([vacancy({ companyName: name, companyUrl: undefined })], 'adzuna');

    expect(result.autoConverted).toBe(1);
    const persisted = await candidateRepo.findById(seed.id);
    expect(persisted?.status).toBe('CONVERTED');
    const companyWatchId = persisted?.metadata?.companyWatchId as string;
    expect(companyWatchId).toBeTruthy();
    createdCompanyWatchIds.push(companyWatchId);
    const companyWatch = await companyWatchRepo.findById(companyWatchId);
    expect(companyWatch?.workspaceId).toBe(workspaceId);
    expect(companyWatch?.metadata?.vacancyPipeline).toBeDefined();
  });

  it('does not create a duplicate candidate row for a fuzzy-matching company name already known to CompanyWatch', async () => {
    const existing = await companyWatchService.addCompany({
      name: `Known Bridge Co ${crypto.randomUUID()}`,
      aliases: [],
      languages: ['en'],
      tags: [],
      atsType: 'CUSTOM_HTML',
      careerUrl: `https://93.184.216.34/careers-${crypto.randomUUID()}`,
      pollingInterval: 3600,
      active: true,
      workspaceId,
    });
    createdCompanyWatchIds.push(existing.id);

    const bridge = buildBridge();
    const result = await bridge.processVacancies(
      [vacancy({ companyName: nearDuplicateName(existing.name) })],
      'hh'
    );

    expect(result.duplicatesSkipped).toBe(1);
    expect(result.newCandidates).toBe(0);
  });
});
