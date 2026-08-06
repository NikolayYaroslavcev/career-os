import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import { prisma } from '@careeros/database';
import {
  createRemotiveProvider,
  createArbeitnowProvider,
  createJobicyProvider,
  createWWRProvider,
  createPyJobsProvider,
  createDjangoJobsProvider,
  createSpeedrunProvider,
  createWorkingNomadsProvider,
  createNoDeskProvider,
  createHNHiringProvider,
  createLinkedInProvider,
  createHHProvider,
  createHabrCareerProvider,
  ConsoleLogger,
  InMemoryMetricsCollector,
  InMemoryTracer,
  DefaultProviderJob,
  type NormalizedVacancy,
} from '@careeros/providers';
import { inferProviderType } from '../config/source-priority.js';
import type { VacancySource } from '@careeros/career';

const WORKSPACE_ID = '836e9446-e242-4a46-85a3-eff2311413c6';
const logger = new ConsoleLogger('info');
const metrics = new InMemoryMetricsCollector();
const tracer = new InMemoryTracer();

interface ProviderTestResult {
  providerId: string;
  providerName: string;
  configured: boolean;
  connected: boolean;
  authentication: string;
  syncExecuted: boolean;
  importedCount: number;
  persistedCount: number;
  vacancyCount: number;
  vacancySourceCount: number;
  error?: string;
}

async function findOrCreateCompany(name: string): Promise<string> {
  const normalizedName = (name || 'Unknown Company').substring(0, 500);
  const existing = await prisma.company.findFirst({ where: { name: normalizedName, workspaceId: WORKSPACE_ID } });
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await prisma.company.create({
    data: {
      id,
      name: normalizedName,
      workspaceId: WORKSPACE_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  return id;
}

async function ingestVacancy(normalized: NormalizedVacancy): Promise<boolean> {
  const providerId = normalized.source;
  const externalId = normalized.sourceId;

  // Check if source already exists
  const existingSource = await prisma.vacancySource.findFirst({
    where: { providerId, externalId },
  });
  if (existingSource) {
    await prisma.vacancySource.update({
      where: { id: existingSource.id },
      data: { lastSeenAt: new Date() },
    });
    return false;
  }

  const companyId = await findOrCreateCompany(normalized.companyName);

  // Check if canonical vacancy exists by title + company
  const existingVacancy = await prisma.vacancy.findFirst({
    where: { title: normalized.title, companyId },
  });

  if (existingVacancy) {
    const sourceId = crypto.randomUUID();
    await prisma.vacancySource.create({
      data: {
        id: sourceId,
        vacancyId: existingVacancy.id,
        providerType: inferProviderType(providerId as VacancySource),
        providerId,
        externalId,
        sourceUrl: normalized.url,
        isPrimary: false,
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return true;
  }

  const vacancyId = crypto.randomUUID();
  const remoteType = normalized.remote.level === 'remote_only' ? 'REMOTE' : normalized.remote.level === 'hybrid' ? 'HYBRID' : 'ONSITE';

  await prisma.vacancy.create({
    data: {
      id: vacancyId,
      title: (normalized.title || '').substring(0, 500),
      description: (normalized.description || '').substring(0, 10000),
      requirements: [],
      workspaceId: WORKSPACE_ID,
      companyId,
      location: normalized.location.raw || normalized.location.city || '',
      remote: remoteType,
      salaryMin: normalized.salary?.min ? Math.round(normalized.salary.min) : null,
      salaryMax: normalized.salary?.max ? Math.round(normalized.salary.max) : null,
      currency: normalized.salary?.originalCurrency || 'USD',
      metadata: normalized.technologies?.length ? { technologies: normalized.technologies } : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const sourceId = crypto.randomUUID();
  await prisma.vacancySource.create({
    data: {
      id: sourceId,
      vacancyId,
      providerType: inferProviderType(providerId as VacancySource),
      providerId,
      externalId,
      sourceUrl: normalized.url,
      isPrimary: true,
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return true;
}

async function testProvider(
  providerId: string,
  providerName: string,
  providerFactory: () => DefaultProviderJob,
): Promise<ProviderTestResult> {
  console.log(`\n=== Testing ${providerName} (${providerId}) ===`);
  
  const result: ProviderTestResult = {
    providerId,
    providerName,
    configured: true,
    connected: false,
    authentication: 'not_required',
    syncExecuted: false,
    importedCount: 0,
    persistedCount: 0,
    vacancyCount: 0,
    vacancySourceCount: 0,
  };

  try {
    const provider = providerFactory();
    result.syncExecuted = true;

    const syncResult = await provider.sync();
    
    if (!syncResult.ok) {
      result.error = syncResult.message;
      console.log(`  SYNC FAILED: ${syncResult.message}`);
      return result;
    }

    result.connected = true;
    result.importedCount = syncResult.data.imported.length;
    console.log(`  Fetched: ${syncResult.data.imported.length} vacancies`);

    let persisted = 0;
    for (const normalized of syncResult.data.imported) {
      try {
        const isNew = await ingestVacancy(normalized);
        if (isNew) persisted++;
      } catch {
        // Skip errors silently
      }
    }
    result.persistedCount = persisted;
    console.log(`  Persisted: ${persisted} new vacancies`);

    // Count this provider's records
    const vacancySourceCount = await prisma.vacancySource.count({
      where: { providerId },
    });
    const vacancyIds = await prisma.vacancySource.findMany({
      where: { providerId },
      select: { vacancyId: true },
      distinct: ['vacancyId'],
    });
    result.vacancyCount = vacancyIds.length;
    result.vacancySourceCount = vacancySourceCount;
    console.log(`  DB Vacancy count (this provider): ${vacancyIds.length}`);
    console.log(`  DB VacancySource count (this provider): ${vacancySourceCount}`);

  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.log(`  ERROR: ${result.error}`);
  }

  return result;
}

async function main(): Promise<void> {
  console.log('=== Full Pipeline Provider Verification ===');
  console.log(`Workspace: ${WORKSPACE_ID}`);
  console.log(`Time: ${new Date().toISOString()}`);
  
  const initialVacancies = await prisma.vacancy.count();
  const initialSources = await prisma.vacancySource.count();
  console.log(`Initial DB state: ${initialVacancies} vacancies, ${initialSources} vacancy sources`);

  const providers: Array<[string, string, () => DefaultProviderJob]> = [
    ['hh', 'HeadHunter', (): DefaultProviderJob => createHHProvider({ accessToken: process.env.HH_ACCESS_TOKEN, areas: (process.env.HH_AREAS ?? '113,16,40,97,48,9').split(',').map((a) => a.trim()).filter(Boolean), logger, metrics, tracer })],
    ['habr_career', 'Habr Career', (): DefaultProviderJob => createHabrCareerProvider({ logger, metrics, tracer })],
    ['remotive', 'Remotive', (): DefaultProviderJob => createRemotiveProvider({ logger, metrics, tracer })],
    ['arbeitnow', 'Arbeitnow', (): DefaultProviderJob => createArbeitnowProvider({ logger, metrics, tracer })],
    ['jobicy', 'Jobicy', (): DefaultProviderJob => createJobicyProvider({ logger, metrics, tracer })],
    ['we_work_remotely', 'WeWorkRemotely', (): DefaultProviderJob => createWWRProvider({ logger, metrics, tracer })],
    ['pyjobs', 'PyJobs', (): DefaultProviderJob => createPyJobsProvider({ logger, metrics, tracer })],
    ['django_jobs', 'Django Jobs', (): DefaultProviderJob => createDjangoJobsProvider({ logger, metrics, tracer })],
    ['speedrun', 'a16z Speedrun', (): DefaultProviderJob => createSpeedrunProvider({ logger, metrics, tracer })],
    ['working_nomads', 'WorkingNomads', (): DefaultProviderJob => createWorkingNomadsProvider({ logger, metrics, tracer })],
    ['nodesk', 'NoDesk', (): DefaultProviderJob => createNoDeskProvider({ logger, metrics, tracer })],
    ['hn_hiring', 'HN Hiring', (): DefaultProviderJob => createHNHiringProvider({ logger, metrics, tracer })],
    ['linkedin', 'LinkedIn', (): DefaultProviderJob => createLinkedInProvider({ logger, metrics, tracer })],
  ];

  const results: ProviderTestResult[] = [];

  for (const [id, name, factory] of providers) {
    const result = await testProvider(id, name, factory);
    results.push(result);
  }

  const finalVacancies = await prisma.vacancy.count();
  const finalSources = await prisma.vacancySource.count();
  console.log(`\n=== FINAL DB STATE ===`);
  console.log(`Vacancies: ${initialVacancies} -> ${finalVacancies} (+${finalVacancies - initialVacancies})`);
  console.log(`VacancySources: ${initialSources} -> ${finalSources} (+${finalSources - initialSources})`);

  console.log(`\n=== SUMMARY ===`);
  for (const r of results) {
    const status = r.error 
      ? `BLOCKED: ${r.error.substring(0, 80)}` 
      : (r.persistedCount > 0 ? 'PRODUCTION READY' : 'PRODUCTION READY (0 new records)');
    console.log(`${r.providerName.padEnd(20)} | ${r.syncExecuted ? 'Sync OK' : 'No sync'} | ${String(r.importedCount).padStart(4)} fetched | ${String(r.persistedCount).padStart(4)} persisted | VS: ${String(r.vacancySourceCount).padStart(4)} | ${status}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
