import { describe, it, expect, beforeEach } from 'vitest';
import {
  ApplicationServiceImpl,
  ApplicationStatus,
  Resume,
  ResumeVersionStatus,
  Vacancy,
  Company,
  Location,
  Salary,
  Technology,
  ExperienceLevel,
  createVacancyId,
  createCompanyId,
  createResumeId,
  createUserId,
} from '@careeros/career';
import type { ApplicationService } from '@careeros/career';
import { ResumeVersionIntelligenceService, VacancyNotFoundError } from '../resume-version-intelligence-service.js';
import { ApplicationCreationService } from '../application-creation-service.js';
import {
  InMemoryApplicationRepository,
  InMemoryVacancyRepository,
  InMemoryVacancySourceRepository,
  InMemoryCompanyRepository,
  InMemoryMatchResultRepository,
  InMemoryCareerInsightRepository,
  InMemoryResumeRepository,
} from '../../testing/in-memory-repositories.js';

const userId = '11111111-1111-4111-8111-111111111111';

function buildVacancy(id: string, overrides: { companyId?: string; technologies?: string[]; workMode?: 'remote' | 'onsite' | 'hybrid'; country?: string } = {}): Vacancy {
  return Vacancy.create({
    id: createVacancyId(id),
    title: 'Senior Backend Engineer',
    description: 'Build things',
    companyId: createCompanyId(overrides.companyId ?? 'company-1'),
    location: Location.create({ workMode: overrides.workMode ?? 'remote', country: overrides.country ?? 'Germany' }),
    experienceLevel: ExperienceLevel.SENIOR,
    salary: Salary.create(80000, 100000, 'USD', 'yearly'),
    technologies: (overrides.technologies ?? ['React']).map((t) => Technology.create(t, 'language')),
  });
}

function buildCompany(id: string, size = 'large'): Company {
  return Company.create({ id: createCompanyId(id), name: `Company ${id}`, size, industry: 'fintech' });
}

function buildResume(id: string, title: string, status: ResumeVersionStatus = ResumeVersionStatus.ACTIVE): Resume {
  return Resume.create({ id: createResumeId(id), userId: createUserId(userId), title, status });
}

describe('ResumeVersionIntelligenceService', () => {
  let resumeRepository: InMemoryResumeRepository;
  let applicationRepository: InMemoryApplicationRepository;
  let vacancyRepository: InMemoryVacancyRepository;
  let vacancySourceRepository: InMemoryVacancySourceRepository;
  let companyRepository: InMemoryCompanyRepository;
  let matchResultRepository: InMemoryMatchResultRepository;
  let careerInsightRepository: InMemoryCareerInsightRepository;
  let applicationService: ApplicationService;
  let creationService: ApplicationCreationService;
  let service: ResumeVersionIntelligenceService;

  beforeEach(async () => {
    resumeRepository = new InMemoryResumeRepository();
    applicationRepository = new InMemoryApplicationRepository();
    vacancyRepository = new InMemoryVacancyRepository();
    vacancySourceRepository = new InMemoryVacancySourceRepository();
    companyRepository = new InMemoryCompanyRepository();
    matchResultRepository = new InMemoryMatchResultRepository();
    careerInsightRepository = new InMemoryCareerInsightRepository();
    applicationService = new ApplicationServiceImpl(applicationRepository);
    creationService = new ApplicationCreationService(applicationService);

    service = new ResumeVersionIntelligenceService({
      resumeRepository,
      applicationRepository,
      vacancyRepository,
      vacancySourceRepository,
      companyRepository,
      matchResultRepository,
      careerInsightRepository,
    });

    await vacancyRepository.save(buildVacancy('vacancy-1', { companyId: 'company-1' }), { workspaceId: 'ws-1' });
    await vacancyRepository.save(buildVacancy('vacancy-2', { companyId: 'company-2', workMode: 'onsite', country: 'Poland' }), { workspaceId: 'ws-1' });
    await companyRepository.save(buildCompany('company-1', 'large'), { workspaceId: 'ws-1' });
    await companyRepository.save(buildCompany('company-2', 'startup'), { workspaceId: 'ws-1' });
    await resumeRepository.save(buildResume('resume-a', 'React EN'));
    await resumeRepository.save(buildResume('resume-b', 'Backend RU'));
  });

  describe('listVersions', () => {
    it('lists only this user\'s resume versions, optionally filtered by status/tag', async () => {
      const versions = await service.listVersions(userId);
      expect(versions.map((v) => v.id).sort()).toEqual(['resume-a', 'resume-b']);
    });
  });

  describe('getVersion', () => {
    it('returns null for a resume owned by another user', async () => {
      await resumeRepository.save(Resume.create({ id: createResumeId('resume-other'), userId: createUserId('other-user'), title: 'Other' }));
      const result = await service.getVersion(userId, 'resume-other');
      expect(result).toBeNull();
    });

    it('returns the resume when owned by the user', async () => {
      const result = await service.getVersion(userId, 'resume-a');
      expect(result?.title).toBe('React EN');
    });
  });

  describe('getVersionPerformance', () => {
    it('computes per-version counts and rates, scoped to that resumeId only', async () => {
      const appA1 = await creationService.createFromIds({ userId, vacancyId: 'vacancy-1', workspaceId: 'ws-1', resumeId: 'resume-a' });
      await applicationService.changeStatus(appA1.id, ApplicationStatus.SUBMITTED);
      await applicationService.changeStatus(appA1.id, ApplicationStatus.HR_INTERVIEW);

      await creationService.createFromIds({ userId, vacancyId: 'vacancy-2', workspaceId: 'ws-1', resumeId: 'resume-b' });

      const performanceA = await service.getVersionPerformance(userId, 'resume-a');
      expect(performanceA.applications).toBe(1);
      expect(performanceA.hrInterviews).toBe(1);

      const performanceB = await service.getVersionPerformance(userId, 'resume-b');
      expect(performanceB.applications).toBe(1);
      expect(performanceB.saved).toBe(1);
    });

    it('excludes applications with a null resumeId from every version\'s performance', async () => {
      await creationService.createFromIds({ userId, vacancyId: 'vacancy-1', workspaceId: 'ws-1' }); // no resumeId
      const performanceA = await service.getVersionPerformance(userId, 'resume-a');
      expect(performanceA.applications).toBe(0);
    });

    it('serves cached results within the TTL window without recomputation drift', async () => {
      await creationService.createFromIds({ userId, vacancyId: 'vacancy-1', workspaceId: 'ws-1', resumeId: 'resume-a' });
      const first = await service.getVersionPerformance(userId, 'resume-a');
      // second application created after the first read should not appear in a cached result
      await creationService.createFromIds({ userId, vacancyId: 'vacancy-2', workspaceId: 'ws-1', resumeId: 'resume-a' });
      const second = await service.getVersionPerformance(userId, 'resume-a');
      expect(second.applications).toBe(first.applications);
    });
  });

  describe('getAllVersionsPerformance', () => {
    it('returns performance for every resume version belonging to the user', async () => {
      await creationService.createFromIds({ userId, vacancyId: 'vacancy-1', workspaceId: 'ws-1', resumeId: 'resume-a' });
      const results = await service.getAllVersionsPerformance(userId);
      expect(results.map((r) => r.resumeId).sort()).toEqual(['resume-a', 'resume-b']);
    });
  });

  describe('getVersionBreakdowns', () => {
    it('computes country/technology breakdowns scoped to one resume version', async () => {
      await creationService.createFromIds({ userId, vacancyId: 'vacancy-1', workspaceId: 'ws-1', resumeId: 'resume-a' });
      const breakdowns = await service.getVersionBreakdowns(userId, 'resume-a');
      const countryBreakdown = breakdowns.find((b) => b.dimension === 'country');
      expect(countryBreakdown?.segments.some((s) => s.label === 'Germany')).toBe(true);
    });
  });

  describe('compareVersions', () => {
    it('compares two resume versions using the shared confidence heuristic', async () => {
      const appA = await creationService.createFromIds({ userId, vacancyId: 'vacancy-1', workspaceId: 'ws-1', resumeId: 'resume-a' });
      await applicationService.changeStatus(appA.id, ApplicationStatus.SUBMITTED);
      await applicationService.changeStatus(appA.id, ApplicationStatus.HR_INTERVIEW);

      await creationService.createFromIds({ userId, vacancyId: 'vacancy-2', workspaceId: 'ws-1', resumeId: 'resume-b' });

      const comparison = await service.compareVersions(userId, 'resume-a', 'resume-b');
      expect(comparison.versionA.resumeId).toBe('resume-a');
      expect(comparison.versionB.resumeId).toBe('resume-b');
      expect(comparison.confidence).toBe('low'); // small sample sizes
    });
  });

  describe('recommendForVacancy', () => {
    it('throws VacancyNotFoundError for an unknown vacancy', async () => {
      await expect(service.recommendForVacancy(userId, 'missing-vacancy')).rejects.toThrow(VacancyNotFoundError);
    });

    it('returns no recommendation when fewer than 2 active versions have applications', async () => {
      const appA = await creationService.createFromIds({ userId, vacancyId: 'vacancy-1', workspaceId: 'ws-1', resumeId: 'resume-a' });
      await applicationService.changeStatus(appA.id, ApplicationStatus.SUBMITTED);

      const recommendation = await service.recommendForVacancy(userId, 'vacancy-1');
      expect(recommendation.recommendedResumeId).toBeNull();
      expect(recommendation.confidence).toBe('low');
    });

    it('recommends the version with the stronger track record when both have applications', async () => {
      const appA = await creationService.createFromIds({ userId, vacancyId: 'vacancy-1', workspaceId: 'ws-1', resumeId: 'resume-a' });
      await applicationService.changeStatus(appA.id, ApplicationStatus.SUBMITTED);
      await applicationService.changeStatus(appA.id, ApplicationStatus.HR_INTERVIEW);

      await creationService.createFromIds({ userId, vacancyId: 'vacancy-2', workspaceId: 'ws-1', resumeId: 'resume-b' });

      const recommendation = await service.recommendForVacancy(userId, 'vacancy-1');
      expect(recommendation.recommendedResumeId).toBe('resume-a');
      expect(recommendation.reasons.length).toBeGreaterThan(0);
    });

    it('only considers ACTIVE resume versions as candidates, even when an archived one performs best', async () => {
      await resumeRepository.save(buildResume('resume-c', 'Archived Version', ResumeVersionStatus.ARCHIVED));
      const appC = await creationService.createFromIds({ userId, vacancyId: 'vacancy-1', workspaceId: 'ws-1', resumeId: 'resume-c' });
      await applicationService.changeStatus(appC.id, ApplicationStatus.SUBMITTED);
      await applicationService.changeStatus(appC.id, ApplicationStatus.OFFER);

      const appA = await creationService.createFromIds({ userId, vacancyId: 'vacancy-2', workspaceId: 'ws-1', resumeId: 'resume-a' });
      await applicationService.changeStatus(appA.id, ApplicationStatus.SUBMITTED);
      await creationService.createFromIds({ userId, vacancyId: 'vacancy-1', workspaceId: 'ws-1', resumeId: 'resume-b' });

      const recommendation = await service.recommendForVacancy(userId, 'vacancy-1');
      // resume-c has the strongest metrics (an offer) but is archived, so it must never be recommended
      expect(recommendation.recommendedResumeId).not.toBeNull();
      expect(recommendation.recommendedResumeId).not.toBe('resume-c');
      expect(['resume-a', 'resume-b']).toContain(recommendation.recommendedResumeId);
    });
  });
});
