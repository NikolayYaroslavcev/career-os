import { describe, it, expect, vi } from 'vitest';
import { NoopLogger, NoopMetricsCollector } from '@careeros/providers';
import type { ProviderRegistry, NormalizedVacancy } from '@careeros/providers';
import type { VacancyRepository, VacancySourceRepository, CompanyRepository } from '@careeros/career';
import { Vacancy, Company, Location, ExperienceLevel, createVacancyId, createCompanyId } from '@careeros/career';
import { SyncSchedulerService } from '../sync-scheduler-service.js';

// Regression test for a bug where ingesting a vacancy that matches an existing
// canonical vacancy (by title + company) triggered a merge-and-save with a
// hardcoded workspaceId: '' instead of the real workspace, which fails the
// Vacancy_workspaceId_fkey constraint in Postgres (surfaced in production logs
// as "Foreign key constraint violated on the constraint: Vacancy_workspaceId_fkey").
describe('SyncSchedulerService merge path workspaceId', () => {
  it('saves the merged vacancy with the real workspaceId, not an empty string', async () => {
    const workspaceId = 'workspace-123';

    const company = Company.create({ id: createCompanyId('company-1'), name: 'Acme' });
    const canonicalVacancy = Vacancy.create({
      id: createVacancyId('vacancy-1'),
      title: 'Backend Engineer',
      description: 'desc',
      companyId: company.id,
      location: Location.create({ workMode: 'remote' }),
      experienceLevel: ExperienceLevel.SENIOR,
    });

    const normalized: NormalizedVacancy = {
      id: 'norm-1',
      source: 'remotive',
      sourceId: 'ext-1',
      title: 'Backend Engineer',
      description: 'desc',
      companyName: 'Acme',
      location: { raw: 'Berlin', city: 'Berlin', country: 'DE', remoteEligible: true },
      technologies: [],
      url: 'https://example.com/job',
      publishedAt: new Date(),
      fetchedAt: new Date(),
      remote: { level: 'remote_only', explicit: true },
      normalizedAt: new Date(),
      contentHash: 'hash',
    };

    const registry = {
      get: vi.fn().mockReturnValue({
        info: { id: 'remotive' },
        sync: vi.fn().mockResolvedValue({ ok: true, data: { imported: [normalized], metrics: { failed: 0 } } }),
      }),
    } as unknown as ProviderRegistry;

    const vacancySave = vi.fn().mockResolvedValue(undefined);
    const vacancyRepository = {
      findByTitleAndCompany: vi.fn().mockResolvedValue(canonicalVacancy),
      findById: vi.fn().mockResolvedValue(canonicalVacancy),
      save: vacancySave,
    } as unknown as VacancyRepository;

    const vacancySourceRepository = {
      findByProviderAndExternalId: vi.fn().mockResolvedValue(null),
      findByVacancyId: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
    } as unknown as VacancySourceRepository;

    const companyRepository = {
      findByName: vi.fn().mockResolvedValue(company),
    } as unknown as CompanyRepository;

    const scheduler = new SyncSchedulerService(
      registry,
      vacancyRepository,
      vacancySourceRepository,
      companyRepository,
      new NoopLogger(),
      new NoopMetricsCollector(),
      60 * 60 * 1000,
    );

    const result = await scheduler.syncProvider('remotive', workspaceId);

    expect(result.status).toBe('success');
    expect(vacancySave).toHaveBeenCalledWith(canonicalVacancy, { workspaceId });
    expect(vacancySave).not.toHaveBeenCalledWith(canonicalVacancy, { workspaceId: '' });
  });
});
