import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import type { CompanyCandidateData } from '@careeros/company-watch';
import { integrationTestsEnabled } from './db-guard.js';

const runIf = integrationTestsEnabled() ? describe : describe.skip;

runIf('CompanyCandidate persistence (real Postgres)', () => {
  let prisma: import('@prisma/client').PrismaClient;
  let PrismaCompanyCandidateRepository: typeof import('../infrastructure/prisma-company-candidate-repository.js').PrismaCompanyCandidateRepository;
  const createdIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import('../client.js'));
    ({ PrismaCompanyCandidateRepository } = await import('../infrastructure/prisma-company-candidate-repository.js'));
  });

  afterEach(async () => {
    if (createdIds.length === 0) return;
    await prisma.companyCandidate.deleteMany({ where: { id: { in: createdIds.splice(0) } } });
  });

  it('confirms the CompanyCandidate table exists (migration ran)', async () => {
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'CompanyCandidate'
    `;
    expect(tables.map((t) => t.table_name)).toEqual(['CompanyCandidate']);
  });

  it('creates, reads, updates a CompanyCandidate row through its full lifecycle', async () => {
    const repository = new PrismaCompanyCandidateRepository();
    const id = crypto.randomUUID();
    createdIds.push(id);

    const data: CompanyCandidateData = {
      id,
      companyName: `Integration Test Co ${id}`,
      careerUrl: `https://example.test/careers-${id}`,
      discoverySource: 'manual',
      status: 'DISCOVERED',
      seenCount: 0,
      vacancyCount: 0,
      providerCount: 0,
      providers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const created = await repository.create(data);
    expect(created.status).toBe('DISCOVERED');

    const scored = await repository.update({
      ...created,
      atsType: 'GREENHOUSE',
      atsEndpoint: 'https://boards-api.greenhouse.io/v1/boards/acme/jobs',
      confidenceScore: 92,
      status: 'AUTO_APPROVED',
      metadata: { confidenceBreakdown: { atsTypeCertainty: 100 } },
    });
    expect(scored.atsType).toBe('GREENHOUSE');
    expect(scored.confidenceScore).toBe(92);
    expect(scored.metadata).toEqual({ confidenceBreakdown: { atsTypeCertainty: 100 } });

    const found = await repository.findByCareerUrl(data.careerUrl);
    expect(found?.id).toBe(id);
  });

  it('persists a WORKABLE-fingerprinted candidate (AtsType enum gap fix)', async () => {
    const repository = new PrismaCompanyCandidateRepository();
    const id = crypto.randomUUID();
    createdIds.push(id);

    const created = await repository.create({
      id,
      companyName: `Workable Test Co ${id}`,
      careerUrl: `https://example.test/careers-workable-${id}`,
      atsType: 'WORKABLE',
      discoverySource: 'manual',
      status: 'REVIEW_REQUIRED',
      seenCount: 0,
      vacancyCount: 0,
      providerCount: 0,
      providers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(created.atsType).toBe('WORKABLE');
  });

  it('getStatusCounts aggregates by status', async () => {
    const repository = new PrismaCompanyCandidateRepository();
    const id = crypto.randomUUID();
    createdIds.push(id);
    await repository.create({
      id,
      companyName: `Count Test Co ${id}`,
      careerUrl: `https://example.test/careers-count-${id}`,
      discoverySource: 'manual',
      status: 'REJECTED',
      seenCount: 0,
      vacancyCount: 0,
      providerCount: 0,
      providers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const counts = await repository.getStatusCounts();
    expect(counts.REJECTED).toBeGreaterThanOrEqual(1);
  });
});
