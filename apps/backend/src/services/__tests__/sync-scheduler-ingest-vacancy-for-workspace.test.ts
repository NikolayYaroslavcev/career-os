import { describe, it, expect, vi } from 'vitest';
import { NoopLogger, NoopMetricsCollector } from '@careeros/providers';
import type { ProviderRegistry, NormalizedVacancy } from '@careeros/providers';
import type { VacancyRepository, VacancySourceRepository, CompanyRepository } from '@careeros/career';
import { Company, createCompanyId } from '@careeros/career';
import { SyncSchedulerService } from '../sync-scheduler-service.js';

// Public counterpart to the private ingestVacancy() the periodic ProviderRegistry
// sync loop already uses (see sync-scheduler-merge-workspace.test.ts) — this is
// the seam LinkedIn Feed discovery calls one NormalizedVacancy at a time through
// (linkedin-feed-discovery-service.ts), so it needs the same dedup guarantee.
function normalizedVacancy(overrides: Partial<NormalizedVacancy> = {}): NormalizedVacancy {
  return {
    id: 'linkedin_feed:urn:li:activity:555',
    source: 'linkedin_feed',
    sourceId: 'urn:li:activity:555',
    title: 'Senior Backend Engineer',
    description: 'We are hiring a Senior Backend Engineer, remote.',
    companyName: 'Acme Corp',
    location: { raw: 'Remote', remoteEligible: true },
    technologies: ['typescript'],
    url: 'https://example.com/careers/backend-engineer',
    publishedAt: new Date('2026-08-20T10:00:00Z'),
    fetchedAt: new Date(),
    remote: { level: 'remote_only', explicit: true },
    normalizedAt: new Date(),
    contentHash: 'hash-1',
    ...overrides,
  };
}

function buildScheduler() {
  const company = Company.create({ id: createCompanyId('company-1'), name: 'Acme Corp' });
  const vacancySourceRows = new Map<string, unknown>();

  const vacancySourceRepository = {
    findByProviderAndExternalId: vi.fn(async (_providerId: string, externalId: string, workspaceId: string) =>
      vacancySourceRows.get(`${workspaceId}:${externalId}`) ?? null,
    ),
    save: vi.fn(async (source: { vacancyId: string; providerId: string; externalId: string } , opts?: { workspaceId: string }) => {
      if (opts) vacancySourceRows.set(`${opts.workspaceId}:${source.externalId}`, source);
    }),
    findByVacancyId: vi.fn().mockResolvedValue([]),
  } as unknown as VacancySourceRepository;

  const vacancyRepository = {
    findByTitleAndCompany: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
  } as unknown as VacancyRepository;

  const companyRepository = {
    findByName: vi.fn().mockResolvedValue(company),
  } as unknown as CompanyRepository;

  const scheduler = new SyncSchedulerService(
    {} as ProviderRegistry,
    vacancyRepository,
    vacancySourceRepository,
    companyRepository,
    new NoopLogger(),
    new NoopMetricsCollector(),
  );

  return { scheduler, vacancyRepository, vacancySourceRepository, companyRepository };
}

describe('SyncSchedulerService.ingestVacancyForWorkspace', () => {
  it('creates a Vacancy + VacancySource for a new LinkedIn-derived NormalizedVacancy', async () => {
    const { scheduler, vacancyRepository, vacancySourceRepository } = buildScheduler();

    const created = await scheduler.ingestVacancyForWorkspace(normalizedVacancy(), 'ws-1');

    expect(created).toBe(true);
    expect(vacancyRepository.save).toHaveBeenCalledTimes(1);
    expect(vacancySourceRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'linkedin_feed', externalId: 'urn:li:activity:555', sourceUrl: 'https://example.com/careers/backend-engineer' }),
      { workspaceId: 'ws-1' },
    );
  });

  it('does not create a duplicate VacancySource when the same LinkedIn post is ingested again', async () => {
    const { scheduler, vacancyRepository, vacancySourceRepository } = buildScheduler();
    const normalized = normalizedVacancy();

    const first = await scheduler.ingestVacancyForWorkspace(normalized, 'ws-1');
    const second = await scheduler.ingestVacancyForWorkspace(normalized, 'ws-1');

    expect(first).toBe(true);
    // Second call finds the existing source and only refreshes its
    // lastSeen timestamp (an update, not a new row) — that's why save() is
    // called again but findByProviderAndExternalId is what actually gates
    // creation: `second` being false is the real "no duplicate" signal.
    expect(second).toBe(false);
    expect(vacancyRepository.save).toHaveBeenCalledTimes(1);
    expect(vacancySourceRepository.findByProviderAndExternalId).toHaveBeenCalledTimes(2);
  });

  it('keeps two different workspaces isolated for the same externalId', async () => {
    const { scheduler, vacancySourceRepository } = buildScheduler();
    const normalized = normalizedVacancy();

    await scheduler.ingestVacancyForWorkspace(normalized, 'ws-1');
    const createdForOtherWorkspace = await scheduler.ingestVacancyForWorkspace(normalized, 'ws-2');

    expect(createdForOtherWorkspace).toBe(true);
    expect(vacancySourceRepository.save).toHaveBeenCalledTimes(2);
  });
});
