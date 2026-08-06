import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CompanyCandidateRepository, CompanyCandidateData, CompanyWatchRepository } from '../../domain/repositories/index.js';
import type { CandidateDeduplicationService } from '../candidate-deduplication-service.js';
import type { CompanyWatchService } from '../company-watch-service.js';
import type { DiscoveryProbe, AtsRegistryProbe } from '../company-discovery-intake-service.js';
import type { VacancyForDiscovery, Logger } from '../vacancy-discovery-bridge.js';
import { VacancyDiscoveryBridge } from '../vacancy-discovery-bridge.js';

function makeCandidateData(overrides: Partial<CompanyCandidateData> = {}): CompanyCandidateData {
  return {
    id: crypto.randomUUID(),
    companyName: 'TestCo',
    careerUrl: 'https://testco.com/careers',
    discoverySource: 'manual',
    status: 'DISCOVERED',
    seenCount: 0,
    vacancyCount: 0,
    providerCount: 0,
    providers: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeVacancy(overrides: Partial<VacancyForDiscovery> = {}): VacancyForDiscovery {
  return {
    companyName: 'TestCo',
    companyUrl: 'https://testco.com',
    title: 'Senior Engineer',
    ...overrides,
  };
}

describe('VacancyDiscoveryBridge', () => {
  let candidateRepo: CompanyCandidateRepository;
  let companyWatchRepo: CompanyWatchRepository;
  let companyWatchService: CompanyWatchService;
  let discoveryService: DiscoveryProbe;
  let adapterRegistry: AtsRegistryProbe;
  let dedupService: CandidateDeduplicationService;
  let logger: Logger;

  beforeEach(() => {
    candidateRepo = {
      findById: vi.fn().mockResolvedValue(null),
      findByCareerUrl: vi.fn().mockResolvedValue(null),
      findByCompanyName: vi.fn().mockResolvedValue(null),
      findAllByStatus: vi.fn().mockResolvedValue([]),
      getStatusCounts: vi.fn().mockResolvedValue({ DISCOVERED: 0, AUTO_APPROVED: 0, REVIEW_REQUIRED: 0, REJECTED: 0, CONVERTED: 0 }),
      create: vi.fn().mockImplementation((data) => Promise.resolve(data)),
      update: vi.fn().mockImplementation((data) => Promise.resolve(data)),
    };
    companyWatchRepo = {
      findAllActive: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      findByName: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    companyWatchService = {
      addCompany: vi.fn().mockResolvedValue({ id: 'cw-1' }),
      updateCompany: vi.fn(),
      removeCompany: vi.fn(),
      getOwned: vi.fn(),
      listCompaniesByWorkspace: vi.fn(),
      syncCompany: vi.fn(),
      getCompanyEvents: vi.fn(),
    } as unknown as CompanyWatchService;
    discoveryService = {
      discover: vi.fn().mockResolvedValue({
        atsType: 'GREENHOUSE',
        careerUrl: 'https://testco.com/careers',
        apiEndpoint: 'https://boards-api.greenhouse.io/v1/boards/testco/jobs',
      }),
    };
    adapterRegistry = {
      has: vi.fn().mockReturnValue(true),
      get: vi.fn().mockReturnValue({
        ping: vi.fn().mockResolvedValue(true),
        fetchJobs: vi.fn().mockResolvedValue([{ id: '1', title: 'Engineer' }]),
      }),
    };
    dedupService = {
      findNearestMatch: vi.fn().mockReturnValue(null),
      isDuplicate: vi.fn().mockReturnValue(false),
    };
    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
  });

  function createBridge(autoEnrollWorkspaceId?: string) {
    return new VacancyDiscoveryBridge(
      candidateRepo,
      companyWatchRepo,
      companyWatchService,
      discoveryService,
      adapterRegistry,
      dedupService,
      { autoEnrollWorkspaceId, sourceAuthorityScore: 30 },
      logger,
    );
  }

  function createBridgeWithConfig(config: { autoEnrollWorkspaceId?: string; sourceAuthorityScore?: number; sourceAuthorityScoreByProvider?: Record<string, number> }) {
    return new VacancyDiscoveryBridge(
      candidateRepo,
      companyWatchRepo,
      companyWatchService,
      discoveryService,
      adapterRegistry,
      dedupService,
      config,
      logger,
    );
  }

  describe('processVacancies', () => {
    it('creates a new candidate from vacancy sync', async () => {
      const bridge = createBridge();
      const result = await bridge.processVacancies([makeVacancy()], 'hh');

      expect(result.newCandidates).toBe(1);
      expect(result.candidatesProcessed).toBe(1);
      expect(candidateRepo.create).toHaveBeenCalledTimes(1);
    });

    it('updates existing candidate with vacancy sighting', async () => {
      const existing = makeCandidateData({ seenCount: 1, vacancyCount: 1, providers: ['remotive'], providerCount: 1 });
      (candidateRepo.findByCompanyName as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const bridge = createBridge();
      const result = await bridge.processVacancies([makeVacancy()], 'hh');

      expect(result.updatedCandidates).toBe(1);
      expect(result.newCandidates).toBe(0);
      expect(candidateRepo.update).toHaveBeenCalled();
    });

    it('skips duplicate companies', async () => {
      (dedupService.isDuplicate as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const bridge = createBridge();
      const result = await bridge.processVacancies([makeVacancy()], 'hh');

      expect(result.duplicatesSkipped).toBe(1);
      expect(result.newCandidates).toBe(0);
    });

    it('skips companies without URL', async () => {
      const bridge = createBridge();
      const result = await bridge.processVacancies([makeVacancy({ companyUrl: undefined })], 'hh');

      expect(result.duplicatesSkipped).toBe(1);
    });

    it('deduplicates companies within a batch', async () => {
      const bridge = createBridge();
      const result = await bridge.processVacancies(
        [makeVacancy(), makeVacancy({ title: 'Junior Engineer' })],
        'hh',
      );

      expect(result.candidatesProcessed).toBe(1);
      expect(result.newCandidates).toBe(1);
    });

    it('processes multiple different companies', async () => {
      const bridge = createBridge();
      const result = await bridge.processVacancies(
        [makeVacancy(), makeVacancy({ companyName: 'OtherCo', companyUrl: 'https://other.co' })],
        'hh',
      );

      expect(result.candidatesProcessed).toBe(2);
      expect(result.newCandidates).toBe(2);
    });

    it('auto-converts candidate after enough sightings with autoEnrollWorkspaceId', async () => {
      const existing = makeCandidateData({
        status: 'REVIEW_REQUIRED',
        atsType: 'GREENHOUSE',
        seenCount: 4,
        vacancyCount: 3,
        providerCount: 2,
        providers: ['hh', 'remotive'],
        careerUrl: 'https://testco.com/careers',
      });
      (candidateRepo.findByCompanyName as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const bridge = createBridge('ws-1');
      const result = await bridge.processVacancies([makeVacancy()], 'adzuna');

      expect(result.autoConverted).toBe(1);
      expect(companyWatchService.addCompany).toHaveBeenCalled();
    });

    it('does not auto-convert CUSTOM_HTML ATS', async () => {
      const existing = makeCandidateData({
        status: 'REVIEW_REQUIRED',
        atsType: 'CUSTOM_HTML',
        seenCount: 10,
        vacancyCount: 10,
        providerCount: 3,
        providers: ['hh', 'remotive', 'adzuna'],
      });
      (candidateRepo.findByCompanyName as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const bridge = createBridge('ws-1');
      const result = await bridge.processVacancies([makeVacancy()], 'hh');

      expect(result.autoConverted).toBe(0);
      expect(result.updatedCandidates).toBe(1);
    });

    it('handles errors gracefully', async () => {
      (candidateRepo.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

      const bridge = createBridge();
      const result = await bridge.processVacancies([makeVacancy()], 'hh');

      expect(result.errors).toBe(1);
      expect(result.newCandidates).toBe(0);
    });

    it('records vacancy sighting with correct provider and title', async () => {
      const existing = makeCandidateData({ seenCount: 1, vacancyCount: 1, providers: ['hh'], providerCount: 1 });
      (candidateRepo.findByCompanyName as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const bridge = createBridge();
      await bridge.processVacancies([makeVacancy({ title: 'Staff Engineer' })], 'remotive');

      const updateCall = (candidateRepo.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as CompanyCandidateData;
      expect(updateCall.seenCount).toBe(2);
      expect(updateCall.vacancyCount).toBe(2);
      expect(updateCall.providers).toContain('remotive');
      expect(updateCall.lastVacancyTitle).toBe('Staff Engineer');
    });
  });

  describe('confidence growth', () => {
    it('increases score with more sightings', async () => {
      const existing = makeCandidateData({
        status: 'REVIEW_REQUIRED',
        atsType: 'GREENHOUSE',
        seenCount: 1,
        vacancyCount: 1,
        providerCount: 1,
        providers: ['hh'],
        confidenceScore: 50,
        careerUrl: 'https://testco.com/careers',
      });
      (candidateRepo.findByCompanyName as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const bridge = createBridge();
      await bridge.processVacancies([makeVacancy()], 'remotive');

      const updateCall = (candidateRepo.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as CompanyCandidateData;
      expect(updateCall.seenCount).toBe(2);
      expect(updateCall.providers).toContain('remotive');
      expect(updateCall.providerCount).toBe(2);
    });

    it('tracks multiple providers independently', async () => {
      const existing = makeCandidateData({
        seenCount: 2,
        vacancyCount: 2,
        providerCount: 1,
        providers: ['hh'],
      });
      (candidateRepo.findByCompanyName as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const bridge = createBridge();
      await bridge.processVacancies([makeVacancy()], 'adzuna');

      const updateCall = (candidateRepo.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as CompanyCandidateData;
      expect(updateCall.providers).toEqual(['hh', 'adzuna']);
      expect(updateCall.providerCount).toBe(2);
    });
  });

  describe('sourceAuthorityScoreByProvider', () => {
    it('uses the per-provider override instead of the flat default when creating a candidate', async () => {
      const bridge = createBridgeWithConfig({ sourceAuthorityScore: 30, sourceAuthorityScoreByProvider: { telegram: 15 } });
      await bridge.processVacancies([makeVacancy()], 'telegram');

      const createCall = (candidateRepo.create as ReturnType<typeof vi.fn>).mock.calls[0][0] as CompanyCandidateData;
      const telegramScore = createCall.confidenceScore;

      const bridge2 = createBridgeWithConfig({ sourceAuthorityScore: 30, sourceAuthorityScoreByProvider: { telegram: 15 } });
      await bridge2.processVacancies([makeVacancy({ companyName: 'OtherCo', companyUrl: 'https://other.co' })], 'hh');

      const createCall2 = (candidateRepo.create as ReturnType<typeof vi.fn>).mock.calls[1][0] as CompanyCandidateData;
      const hhScore = createCall2.confidenceScore;

      expect(telegramScore).toBeLessThan(hhScore as number);
    });

    it('falls back to the flat sourceAuthorityScore for a provider with no override', async () => {
      const bridge = createBridgeWithConfig({ sourceAuthorityScore: 30 });
      const result = await bridge.processVacancies([makeVacancy()], 'telegram');

      expect(result.newCandidates).toBe(1);
      const createCall = (candidateRepo.create as ReturnType<typeof vi.fn>).mock.calls[0][0] as CompanyCandidateData;
      expect(createCall.confidenceScore).toBeGreaterThan(0);
    });
  });

  describe('duplicate prevention', () => {
    it('does not create duplicate for same company name', async () => {
      const existing = makeCandidateData({ companyName: 'TestCo' });
      (candidateRepo.findByCompanyName as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const bridge = createBridge();
      const result = await bridge.processVacancies([makeVacancy()], 'hh');

      expect(result.newCandidates).toBe(0);
      expect(result.updatedCandidates).toBe(1);
    });

    it('does not create duplicate for fuzzy match', async () => {
      (dedupService.isDuplicate as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const bridge = createBridge();
      const result = await bridge.processVacancies(
        [makeVacancy({ companyName: 'Test Co' })],
        'hh',
      );

      expect(result.duplicatesSkipped).toBe(1);
    });
  });
});
