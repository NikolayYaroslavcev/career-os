import type { CompanyCandidateRepository, CompanyCandidateData, CompanyWatchRepository } from '../domain/repositories/index.js';
import type { AtsType } from '../domain/value-objects/ats-type.js';
import {
  classifyAtsTypeCertainty,
  computeDiscoveryConfidence,
  deriveCandidateStatusFromScore,
  VACANCY_PIPELINE_MIN_SEEN_COUNT,
  VACANCY_PIPELINE_MIN_VACANCY_COUNT,
  VACANCY_PIPELINE_AUTO_ENROLL_SCORE,
} from '../domain/discovery-confidence.js';
import type { CandidateDeduplicationService } from './candidate-deduplication-service.js';
import type { CompanyWatchService } from './company-watch-service.js';
import type { DiscoveryProbe } from './company-discovery-intake-service.js';
import type { AtsRegistryProbe } from './company-discovery-intake-service.js';
import { CompanyCandidate } from '../domain/entities/company-candidate.js';
import { assertSafeUrl } from '../utils/url-safety.js';

/**
 * Minimal shape of a normalized vacancy this bridge needs — decoupled from
 * @careeros/providers to avoid a circular dependency.
 */
export interface VacancyForDiscovery {
  readonly companyName: string;
  readonly companyUrl?: string;
  readonly title: string;
}

export interface VacancyDiscoveryBridgeConfig {
  readonly autoEnrollWorkspaceId?: string;
  readonly sourceAuthorityScore?: number;
  /**
   * Per-provider override of sourceAuthorityScore, checked first. Lets a
   * community/crowd-sourced provider (e.g. Telegram) carry less trust than
   * an ATS API or job-board listing without changing the default for every
   * other provider — additive, backward compatible (omit to keep every
   * provider on the flat sourceAuthorityScore default).
   */
  readonly sourceAuthorityScoreByProvider?: Readonly<Record<string, number>>;
}

export interface VacancyDiscoveryResult {
  candidatesProcessed: number;
  newCandidates: number;
  updatedCandidates: number;
  autoConverted: number;
  duplicatesSkipped: number;
  errors: number;
}

export interface Logger {
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, err?: Error, ctx?: Record<string, unknown>): void;
  debug(msg: string, ctx?: Record<string, unknown>): void;
}

/**
 * ADR-035 Phase 3: Automatic Company Discovery from the Vacancy Pipeline.
 *
 * After each provider sync, this service processes the synced vacancies
 * and creates/updates CompanyCandidate records. Companies that accumulate
 * enough signals (seenCount, vacancyCount, providerCount) are auto-converted
 * to CompanyWatch.
 *
 * Reuses: CompanyCandidateRepository, CandidateDeduplicationService,
 * CompanyDiscoveryService (fingerprint), CompanyWatchService (enrollment),
 * confidence scoring.
 */
export class VacancyDiscoveryBridge {
  constructor(
    private readonly candidateRepo: CompanyCandidateRepository,
    private readonly companyWatchRepo: CompanyWatchRepository,
    private readonly companyWatchService: CompanyWatchService,
    private readonly discoveryService: DiscoveryProbe,
    private readonly adapterRegistry: AtsRegistryProbe,
    private readonly dedupService: CandidateDeduplicationService,
    private readonly config: VacancyDiscoveryBridgeConfig,
    private readonly logger: Logger,
  ) {}

  /**
   * Process vacancies from a provider sync and discover new companies.
   * Called from onProviderSynced hook after each successful provider sync.
   */
  async processVacancies(
    vacancies: readonly VacancyForDiscovery[],
    providerId: string,
  ): Promise<VacancyDiscoveryResult> {
    const result: VacancyDiscoveryResult = {
      candidatesProcessed: 0,
      newCandidates: 0,
      updatedCandidates: 0,
      autoConverted: 0,
      duplicatesSkipped: 0,
      errors: 0,
    };

    const uniqueCompanies = this.extractUniqueCompanies(vacancies);
    this.logger.info('VacancyDiscoveryBridge: processing companies', {
      providerId,
      totalVacancies: vacancies.length,
      uniqueCompanies: uniqueCompanies.size,
    });

    for (const [companyName, companyData] of uniqueCompanies) {
      try {
        result.candidatesProcessed++;
        const outcome = await this.processCompany(companyName, companyData, providerId);
        switch (outcome) {
          case 'new':
            result.newCandidates++;
            break;
          case 'updated':
            result.updatedCandidates++;
            break;
          case 'auto_converted':
            result.autoConverted++;
            break;
          case 'duplicate':
            result.duplicatesSkipped++;
            break;
        }
      } catch (error) {
        result.errors++;
        this.logger.warn('VacancyDiscoveryBridge: failed to process company', {
          companyName,
          providerId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.info('VacancyDiscoveryBridge: completed', { providerId, ...result });
    return result;
  }

  private extractUniqueCompanies(
    vacancies: readonly VacancyForDiscovery[],
  ): Map<string, { companyUrl?: string; vacancyTitle: string }> {
    const companies = new Map<string, { companyUrl?: string; vacancyTitle: string }>();
    for (const vacancy of vacancies) {
      const name = vacancy.companyName.trim();
      if (!name) continue;
      const existing = companies.get(name);
      if (!existing) {
        companies.set(name, { companyUrl: vacancy.companyUrl, vacancyTitle: vacancy.title });
      } else if (!existing.companyUrl && vacancy.companyUrl) {
        existing.companyUrl = vacancy.companyUrl;
      }
    }
    return companies;
  }

  private async processCompany(
    companyName: string,
    data: { companyUrl?: string; vacancyTitle: string },
    providerId: string,
  ): Promise<'new' | 'updated' | 'auto_converted' | 'duplicate'> {
    const existing = await this.candidateRepo.findByCompanyName(companyName);
    if (existing) {
      return this.updateExistingCandidate(existing, providerId, data.vacancyTitle);
    }

    const knownNames = await this.getKnownCompanyNames();
    if (this.dedupService.isDuplicate(companyName, knownNames)) {
      return 'duplicate';
    }

    if (!data.companyUrl) {
      this.logger.debug('VacancyDiscoveryBridge: no company URL, skipping', { companyName });
      return 'duplicate';
    }

    return this.createNewCandidate(companyName, data.companyUrl, providerId, data.vacancyTitle);
  }

  private async updateExistingCandidate(
    existing: CompanyCandidateData,
    providerId: string,
    vacancyTitle: string,
  ): Promise<'updated' | 'auto_converted'> {
    const candidate = CompanyCandidate.reconstitute(existing);
    candidate.recordVacancySighting(providerId, vacancyTitle);
    await this.candidateRepo.update(candidate.toProps());

    if (candidate.status === 'REVIEW_REQUIRED' || candidate.status === 'AUTO_APPROVED') {
      const shouldConvert = this.shouldAutoConvertFromPipeline(candidate);
      if (shouldConvert && this.config.autoEnrollWorkspaceId) {
        await this.convertToCompanyWatch(candidate, this.config.autoEnrollWorkspaceId);
        return 'auto_converted';
      }

      const newScore = this.computePipelineConfidence(candidate, providerId);
      if (newScore >= VACANCY_PIPELINE_AUTO_ENROLL_SCORE && candidate.status === 'REVIEW_REQUIRED') {
        const isNeverAutoEnrollAts = !candidate.atsType || candidate.atsType === 'CUSTOM_HTML' || candidate.atsType === 'JSON_LD';
        if (!isNeverAutoEnrollAts) {
          const updated = CompanyCandidate.reconstitute(await this.candidateRepo.findById(candidate.id) ?? candidate.toProps());
          updated.applyScore({
            score: newScore,
            status: 'AUTO_APPROVED',
            breakdown: { vacancyPipeline: newScore },
          });
          await this.candidateRepo.update(updated.toProps());

          if (this.config.autoEnrollWorkspaceId) {
            await this.convertToCompanyWatch(updated, this.config.autoEnrollWorkspaceId);
            return 'auto_converted';
          }
        }
      }
    }

    return 'updated';
  }

  private async createNewCandidate(
    companyName: string,
    companyUrl: string,
    providerId: string,
    vacancyTitle: string,
  ): Promise<'new'> {
    const id = crypto.randomUUID();
    const candidate = CompanyCandidate.create({
      id,
      companyName,
      careerUrl: companyUrl,
      discoverySource: `vacancy_sync:${providerId}`,
    });
    candidate.recordVacancySighting(providerId, vacancyTitle);

    const discovery = await this.discoveryService.discover(companyUrl).catch(() => null);
    if (discovery) {
      candidate.applyFingerprint({
        atsType: discovery.atsType ?? undefined,
        careerUrl: discovery.careerUrl ?? companyUrl,
        atsEndpoint: discovery.apiEndpoint ?? undefined,
      });
    }

    const { reachable, jobSignalFound } = discovery
      ? await this.probeAts(discovery.atsType, candidate.careerUrl, candidate.atsEndpoint, discovery.careerUrl !== null).catch(() => ({ reachable: false, jobSignalFound: false }))
      : { reachable: false, jobSignalFound: false };

    const scoreResult = computeDiscoveryConfidence({
      atsTypeCertainty: classifyAtsTypeCertainty({ atsType: discovery?.atsType ?? null, apiEndpoint: discovery?.apiEndpoint ?? null }),
      reachable,
      jobSignalFound,
      sourceAuthorityScore: this.resolveSourceAuthorityScore(providerId),
      nearestKnownNameSimilarity: 0,
      vacancyPipelineSignals: {
        seenCount: candidate.seenCount,
        vacancyCount: candidate.vacancyCount,
        providerCount: candidate.providerCount,
        hasCareerUrl: !!candidate.careerUrl,
      },
    });
    const status = deriveCandidateStatusFromScore(scoreResult.score, candidate.atsType);
    candidate.applyScore({ score: scoreResult.score, status, breakdown: scoreResult.breakdown });

    await this.candidateRepo.create(candidate.toProps());

    if (status === 'AUTO_APPROVED' && this.config.autoEnrollWorkspaceId) {
      await this.convertToCompanyWatch(candidate, this.config.autoEnrollWorkspaceId);
    }

    return 'new';
  }

  private resolveSourceAuthorityScore(providerId: string): number {
    return this.config.sourceAuthorityScoreByProvider?.[providerId] ?? this.config.sourceAuthorityScore ?? 30;
  }

  private shouldAutoConvertFromPipeline(candidate: CompanyCandidate): boolean {
    return (
      candidate.seenCount >= VACANCY_PIPELINE_MIN_SEEN_COUNT &&
      candidate.vacancyCount >= VACANCY_PIPELINE_MIN_VACANCY_COUNT &&
      candidate.atsType !== undefined &&
      candidate.atsType !== 'CUSTOM_HTML' &&
      candidate.atsType !== 'JSON_LD'
    );
  }

  private computePipelineConfidence(candidate: CompanyCandidate, providerId: string): number {
    const result = computeDiscoveryConfidence({
      atsTypeCertainty: candidate.atsType ? 'HEURISTIC_MATCH' : 'FALLBACK',
      reachable: true,
      jobSignalFound: candidate.vacancyCount > 0,
      sourceAuthorityScore: this.resolveSourceAuthorityScore(providerId),
      nearestKnownNameSimilarity: 0,
      vacancyPipelineSignals: {
        seenCount: candidate.seenCount,
        vacancyCount: candidate.vacancyCount,
        providerCount: candidate.providerCount,
        hasCareerUrl: !!candidate.careerUrl,
      },
    });
    return result.score;
  }

  private async convertToCompanyWatch(candidate: CompanyCandidate, workspaceId: string): Promise<void> {
    const atsType = candidate.atsType;
    if (!atsType) return;

    let companyWatch;
    try {
      companyWatch = await this.companyWatchService.addCompany({
        name: candidate.companyName,
        aliases: [],
        languages: ['en'],
        tags: [],
        atsType,
        careerUrl: candidate.careerUrl,
        atsEndpoint: candidate.atsEndpoint,
        pollingInterval: 3600,
        active: true,
        metadata: {
          discoverySource: candidate.discoverySource,
          confidenceScore: candidate.confidenceScore,
          vacancyPipeline: {
            seenCount: candidate.seenCount,
            vacancyCount: candidate.vacancyCount,
            providerCount: candidate.providerCount,
            providers: candidate.providers,
          },
        },
        workspaceId,
      });
    } catch (error) {
      this.logger.warn('VacancyDiscoveryBridge: failed to convert company', {
        companyName: candidate.companyName,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    try {
      candidate.markConverted(companyWatch.id);
      await this.candidateRepo.update(candidate.toProps());
    } catch (error) {
      // CompanyWatch and CompanyCandidate are separate aggregates/repositories
      // (no cross-repo DB transaction spans them) — compensate by removing the
      // just-created CompanyWatch rather than leaving an orphaned row with no
      // corresponding CONVERTED candidate (same reversal path ADR-035 §16
      // already established).
      await this.companyWatchRepo.delete(companyWatch.id).catch(() => {});
      this.logger.warn('VacancyDiscoveryBridge: failed to mark candidate converted, rolled back CompanyWatch', {
        companyName: candidate.companyName,
        companyWatchId: companyWatch.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    this.logger.info('VacancyDiscoveryBridge: auto-converted company', {
      companyName: candidate.companyName,
      companyWatchId: companyWatch.id,
      score: candidate.confidenceScore,
      seenCount: candidate.seenCount,
      vacancyCount: candidate.vacancyCount,
    });
  }

  private async probeAts(
    atsType: AtsType | null,
    careerUrl: string,
    atsEndpoint: string | undefined,
    fingerprintFetchSucceeded: boolean,
  ): Promise<{ reachable: boolean; jobSignalFound: boolean }> {
    if (!atsType || !this.adapterRegistry.has(atsType)) {
      return { reachable: fingerprintFetchSucceeded, jobSignalFound: false };
    }

    // Same SSRF gap as CompanyDiscoveryIntakeService.probeAts: careerUrl may
    // be a link scraped verbatim from the discovered page's own HTML rather
    // than a URL a caller submitted directly, so it needs its own safety
    // check before being handed to the adapter's fetch.
    try {
      await assertSafeUrl(careerUrl);
      if (atsEndpoint) await assertSafeUrl(atsEndpoint);
    } catch {
      return { reachable: false, jobSignalFound: false };
    }

    const adapter = this.adapterRegistry.get(atsType);
    const config = { careerUrl, atsEndpoint, metadata: {} };

    const reachable = await adapter.ping(config).catch(() => false);
    const jobSignalFound = await adapter
      .fetchJobs(config)
      .then((jobs) => jobs.length >= 1)
      .catch(() => false);

    return { reachable, jobSignalFound };
  }

  private async getKnownCompanyNames(): Promise<string[]> {
    const [activeCompanies, activeCandidates] = await Promise.all([
      this.companyWatchRepo.findAllActive(),
      this.candidateRepo.findAllByStatus(['DISCOVERED', 'AUTO_APPROVED', 'REVIEW_REQUIRED', 'CONVERTED']),
    ]);

    const names = new Set<string>();
    for (const company of activeCompanies) {
      names.add(company.name);
      for (const alias of company.aliases) names.add(alias);
    }
    for (const candidate of activeCandidates) {
      names.add(candidate.companyName);
    }

    return [...names];
  }
}
