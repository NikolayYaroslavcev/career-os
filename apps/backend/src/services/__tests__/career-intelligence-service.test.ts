import { describe, it, expect, beforeEach } from 'vitest';
import { createMatchResult } from '@careeros/ai';
import {
  ApplicationServiceImpl,
  ApplicationStatus,
  Vacancy,
  Company,
  Location,
  Salary,
  Technology,
  ExperienceLevel,
  createVacancyId,
  createCompanyId,
} from '@careeros/career';
import type { ApplicationService } from '@careeros/career';
import { CareerIntelligenceService } from '../career-intelligence-service.js';
import { ApplicationCreationService } from '../application-creation-service.js';
import {
  InMemoryApplicationRepository,
  InMemoryVacancyRepository,
  InMemoryVacancySourceRepository,
  InMemoryCompanyRepository,
  InMemoryMatchResultRepository,
  InMemoryAnalyticsEventRepository,
  InMemoryCareerInsightRepository,
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
    technologies: (overrides.technologies ?? ['TypeScript']).map((t) => Technology.create(t, 'language')),
  });
}

function buildCompany(id: string, size = 'large'): Company {
  return Company.create({ id: createCompanyId(id), name: `Company ${id}`, size, industry: 'fintech' });
}

function buildMatchResult(vacancyId: string, overallScore: number): ReturnType<typeof createMatchResult> {
  return createMatchResult({
    searchProfileId: 'profile-1',
    resumeId: 'resume-1',
    vacancyId,
    userId,
    overallScore,
    confidence: 0.8,
    recommendation: overallScore >= 80 ? 'StrongApply' : 'Apply',
    summary: 'Good fit',
    strengths: [],
    weaknesses: [],
    requiredSkills: [],
    missingSkills: [],
    seniorityEstimation: 'Senior',
    remotePolicy: 'Remote',
    salaryObservations: null,
    salaryFit: { score: 70, confidence: 0.6, reasoning: 'ok' },
    locationFit: { score: 90, confidence: 0.9, reasoning: 'remote' },
    experienceFit: { score: overallScore, confidence: 0.7, reasoning: 'match' },
    careerGrowthFit: { score: 60, confidence: 0.5, reasoning: 'growth' },
    reasoning: 'Good fit',
    model: 'mock-model',
    provider: 'mock',
    promptVersion: '1.0.0',
    promptId: 'vacancy-analysis',
    matchingAlgorithmVersion: '1.0.0',
    inputHash: `hash-${vacancyId}`,
    tokenUsage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
    latencyMs: 100,
    estimatedCostUsd: 0.001,
  });
}

describe('CareerIntelligenceService', () => {
  let applicationRepository: InMemoryApplicationRepository;
  let vacancyRepository: InMemoryVacancyRepository;
  let vacancySourceRepository: InMemoryVacancySourceRepository;
  let companyRepository: InMemoryCompanyRepository;
  let matchResultRepository: InMemoryMatchResultRepository;
  let analyticsEventRepository: InMemoryAnalyticsEventRepository;
  let careerInsightRepository: InMemoryCareerInsightRepository;
  let applicationService: ApplicationService;
  let creationService: ApplicationCreationService;
  let service: CareerIntelligenceService;

  beforeEach(async () => {
    applicationRepository = new InMemoryApplicationRepository();
    vacancyRepository = new InMemoryVacancyRepository();
    vacancySourceRepository = new InMemoryVacancySourceRepository();
    companyRepository = new InMemoryCompanyRepository();
    matchResultRepository = new InMemoryMatchResultRepository();
    analyticsEventRepository = new InMemoryAnalyticsEventRepository();
    careerInsightRepository = new InMemoryCareerInsightRepository();
    applicationService = new ApplicationServiceImpl(applicationRepository);
    creationService = new ApplicationCreationService(applicationService, analyticsEventRepository);

    service = new CareerIntelligenceService({
      applicationRepository,
      vacancyRepository,
      vacancySourceRepository,
      companyRepository,
      matchResultRepository,
      analyticsEventRepository,
      careerInsightRepository,
    });

    await vacancyRepository.save(buildVacancy('vacancy-1', { companyId: 'company-1' }), { workspaceId: 'ws-1' });
    await vacancyRepository.save(buildVacancy('vacancy-2', { companyId: 'company-2', workMode: 'onsite', country: 'Poland' }), { workspaceId: 'ws-1' });
    await companyRepository.save(buildCompany('company-1', 'large'), { workspaceId: 'ws-1' });
    await companyRepository.save(buildCompany('company-2', 'startup'), { workspaceId: 'ws-1' });
  });

  describe('getOverview', () => {
    it('counts applications by status', async () => {
      const app1 = await creationService.createFromIds({ userId, vacancyId: 'vacancy-1', workspaceId: 'ws-1' });
      await applicationService.changeStatus(app1.id, ApplicationStatus.SUBMITTED);
      await applicationService.changeStatus(app1.id, ApplicationStatus.HR_INTERVIEW);

      await creationService.createFromIds({ userId, vacancyId: 'vacancy-2', workspaceId: 'ws-1' });

      const overview = await service.getOverview(userId);
      expect(overview.applicationsSaved).toBe(1); // app2 is still 'saved'
      expect(overview.hrInterviews).toBe(1);
      expect(overview.applicationsSent).toBe(1); // only app1 moved past 'saved'
    });

    it('records an application_saved analytics event as a side effect', async () => {
      await creationService.createFromIds({ userId, vacancyId: 'vacancy-1', workspaceId: 'ws-1' });
      const events = await analyticsEventRepository.findByUserId(userId, { eventType: 'application_saved' });
      expect(events).toHaveLength(1);
    });
  });

  describe('getFunnel', () => {
    it('falls back to the applied-set size when no vacancy_found events exist', async () => {
      await creationService.createFromIds({ userId, vacancyId: 'vacancy-1', workspaceId: 'ws-1' });
      const funnel = await service.getFunnel(userId);
      expect(funnel.totalFound).toBe(1);
    });

    it('uses the distinct vacancy_found event count when available', async () => {
      await analyticsEventRepository.recordMany([
        { userId, eventType: 'vacancy_found', entityType: 'vacancy', entityId: 'vacancy-1' },
        { userId, eventType: 'vacancy_found', entityType: 'vacancy', entityId: 'vacancy-2' },
        { userId, eventType: 'vacancy_found', entityType: 'vacancy', entityId: 'vacancy-1' }, // duplicate, not distinct
      ]);
      await creationService.createFromIds({ userId, vacancyId: 'vacancy-1', workspaceId: 'ws-1' });

      const funnel = await service.getFunnel(userId);
      expect(funnel.totalFound).toBe(2);
    });
  });

  describe('getFailureAnalysis', () => {
    it('attributes a rejection to the stage recorded in status-change history', async () => {
      const app = await creationService.createFromIds({ userId, vacancyId: 'vacancy-1', workspaceId: 'ws-1' });
      await applicationService.changeStatus(app.id, ApplicationStatus.SUBMITTED);
      await analyticsEventRepository.record({
        userId, eventType: 'status_changed', entityType: 'application', entityId: app.id,
        metadata: { from: 'saved', to: 'applied' },
      });
      await applicationService.changeStatus(app.id, ApplicationStatus.HR_INTERVIEW);
      await analyticsEventRepository.record({
        userId, eventType: 'status_changed', entityType: 'application', entityId: app.id,
        metadata: { from: 'applied', to: 'hr_interview' },
      });
      await applicationService.changeStatus(app.id, ApplicationStatus.REJECTED);
      await analyticsEventRepository.record({
        userId, eventType: 'status_changed', entityType: 'application', entityId: app.id,
        metadata: { from: 'hr_interview', to: 'rejected' },
      });

      const analysis = await service.getFailureAnalysis(userId);
      expect(analysis.totalRejected).toBe(1);
      const afterHr = analysis.stages.find((s) => s.stage === 'After HR');
      expect(afterHr?.count).toBe(1);
    });
  });

  describe('getPerformanceBreakdowns', () => {
    it('includes company-size and technology dimensions', async () => {
      const app = await creationService.createFromIds({ userId, vacancyId: 'vacancy-1', workspaceId: 'ws-1' });
      await applicationService.changeStatus(app.id, ApplicationStatus.SUBMITTED);

      const breakdowns = await service.getPerformanceBreakdowns(userId);
      const dimensions = breakdowns.map((b) => b.dimension);
      expect(dimensions).toContain('company_size');
      expect(dimensions).toContain('technology');

      const sizeBreakdown = breakdowns.find((b) => b.dimension === 'company_size');
      expect(sizeBreakdown?.segments.some((s) => s.label === 'large')).toBe(true);
    });
  });

  describe('getMatchAnalytics', () => {
    it('computes a positive correlation when high scores reach interviews and low scores are rejected', async () => {
      const app1 = await creationService.createFromIds({ userId, vacancyId: 'vacancy-1', workspaceId: 'ws-1' });
      await applicationService.changeStatus(app1.id, ApplicationStatus.SUBMITTED);
      await analyticsEventRepository.record({ userId, eventType: 'status_changed', entityType: 'application', entityId: app1.id, metadata: { from: 'saved', to: 'submitted' } });
      await applicationService.changeStatus(app1.id, ApplicationStatus.HR_INTERVIEW);

      const app2 = await creationService.createFromIds({ userId, vacancyId: 'vacancy-2', workspaceId: 'ws-1' });
      await applicationService.changeStatus(app2.id, ApplicationStatus.SUBMITTED);
      await analyticsEventRepository.record({ userId, eventType: 'status_changed', entityType: 'application', entityId: app2.id, metadata: { from: 'saved', to: 'submitted' } });
      await applicationService.changeStatus(app2.id, ApplicationStatus.REJECTED);
      await analyticsEventRepository.record({ userId, eventType: 'status_changed', entityType: 'application', entityId: app2.id, metadata: { from: 'submitted', to: 'rejected' } });

      await matchResultRepository.save(buildMatchResult('vacancy-1', 90));
      await matchResultRepository.save(buildMatchResult('vacancy-2', 20));

      const analytics = await service.getMatchAnalytics(userId);
      expect(analytics.correlationWithInterviewRate).toBeGreaterThan(0);
    });
  });

  describe('getInsights caching', () => {
    it('caches computed insights and serves the cached copy on the next call', async () => {
      const first = await service.getInsights(userId);
      expect(first.generatedAt).toBeInstanceOf(Date);

      const cached = await careerInsightRepository.get(userId, 'insights:all');
      expect(cached).not.toBeNull();

      const second = await service.getInsights(userId);
      expect(second.generatedAt).toBeInstanceOf(Date);
      expect(second.generatedAt.getTime()).toBe(first.generatedAt.getTime());
    });

    it('refreshInsights bypasses the cache and recomputes', async () => {
      await service.getInsights(userId);
      const refreshed = await service.refreshInsights(userId);
      expect(refreshed.generatedAt).toBeInstanceOf(Date);
    });
  });

  describe('getSuccessPatterns and getTrends', () => {
    it('returns an array (possibly empty) without throwing', async () => {
      await expect(service.getSuccessPatterns(userId)).resolves.toEqual(expect.any(Array));
    });

    it('computes trend metrics without throwing', async () => {
      await creationService.createFromIds({ userId, vacancyId: 'vacancy-1', workspaceId: 'ws-1' });
      const trends = await service.getTrends(userId);
      expect(trends.metrics.map((m) => m.name)).toContain('Applications');
    });
  });
});
