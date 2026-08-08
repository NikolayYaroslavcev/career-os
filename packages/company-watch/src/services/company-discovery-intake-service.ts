import type { CompanyCandidateRepository, CompanyCandidateData, CompanyWatchRepository, CompanyWatchData } from '../domain/repositories/index.js';
import { CompanyCandidate } from '../domain/entities/company-candidate.js';
import {
  classifyAtsTypeCertainty,
  computeDiscoveryConfidence,
  deriveCandidateStatusFromScore,
  SINGLE_SHOT_SOURCE_AUTHORITY_SCORE,
} from '../domain/discovery-confidence.js';
import type { AtsType } from '../domain/value-objects/ats-type.js';
import type { AtsAdapter, AtsConfig } from '../adapters/base-adapter.js';
import type { DiscoveryResult } from './company-discovery-service.js';
import type { CandidateDeduplicationService } from './candidate-deduplication-service.js';
import type { CompanyWatchService } from './company-watch-service.js';
import { assertSafeUrl, isDeniedDiscoveryHostname } from '../utils/url-safety.js';

/** Structural — CompanyDiscoveryService satisfies this as-is; tests can supply a fake with no network I/O. */
export interface DiscoveryProbe {
  discover(url: string): Promise<DiscoveryResult>;
}

/** Structural subset of AtsAdapterRegistry this service needs — same reasoning as DiscoveryProbe. */
export interface AtsRegistryProbe {
  has(atsType: AtsType): boolean;
  get(atsType: AtsType): Pick<AtsAdapter, 'ping' | 'fetchJobs'>;
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface DiscoverCandidateInput {
  readonly companyName: string;
  readonly url: string;
  readonly discoverySource?: string;
  /**
   * ADR-035 §2 "source authority" category. Defaults to
   * SINGLE_SHOT_SOURCE_AUTHORITY_SCORE (100) — a human explicitly supplying
   * this exact URL is the highest-trust source there is. Phase 4 bulk
   * DiscoverySources (packages/discovery-sources) pass their own,
   * lower/varying score here instead (YC/CNCF-class curated sources score
   * higher than a bare Common Crawl domain hit, per ADR §2).
   */
  readonly sourceAuthorityScore?: number;
}

export type DiscoverCandidateOutcome =
  | { readonly outcome: 'DUPLICATE'; readonly nearestMatchName: string; readonly similarity: number }
  | { readonly outcome: 'BLOCKED'; readonly reason: string }
  | { readonly outcome: 'SCORED'; readonly candidate: CompanyCandidateData };

/**
 * ADR-035 §1/§2/§4 orchestrator: single-shot discovery only (Phase 2 has no
 * bulk DiscoverySource yet, per the ADR's phasing table) — dedup -> reuse
 * CompanyDiscoveryService's existing fingerprint -> score -> route to
 * AUTO_APPROVED/REVIEW_REQUIRED/REJECTED, auto-converting AUTO_APPROVED
 * candidates into CompanyWatch immediately when a discovery workspace is
 * configured (ADR §4's DISCOVERY_WORKSPACE_ID).
 */
export class CompanyDiscoveryIntakeService {
  constructor(
    private readonly candidateRepo: CompanyCandidateRepository,
    private readonly companyWatchRepo: CompanyWatchRepository,
    private readonly companyWatchService: CompanyWatchService,
    private readonly discoveryService: DiscoveryProbe,
    private readonly adapterRegistry: AtsRegistryProbe,
    private readonly dedupService: CandidateDeduplicationService,
    /** ADR §4: single system workspace auto-enrolled candidates land in. Unset = auto-enrollment stays AUTO_APPROVED but unconverted until a human approves it with an explicit workspace. */
    private readonly autoEnrollWorkspaceId?: string
  ) {}

  async discover(input: DiscoverCandidateInput): Promise<DiscoverCandidateOutcome> {
    const discoverySource = input.discoverySource ?? 'manual';

    const existing = await this.candidateRepo.findByCareerUrl(input.url);
    if (existing) {
      return { outcome: 'SCORED', candidate: existing };
    }

    const knownNames = await this.getKnownCompanyNames();
    const nearestMatch = this.dedupService.findNearestMatch(input.companyName, knownNames);
    if (nearestMatch && this.dedupService.isDuplicate(input.companyName, knownNames)) {
      return { outcome: 'DUPLICATE', nearestMatchName: nearestMatch.name, similarity: nearestMatch.similarity };
    }

    if (isDeniedDiscoveryHostname(input.url)) {
      return { outcome: 'BLOCKED', reason: `'${input.url}' is on the discovery denylist` };
    }

    const candidate = CompanyCandidate.create({
      id: generateId(),
      companyName: input.companyName,
      careerUrl: input.url,
      discoverySource,
    });
    await this.candidateRepo.create(candidate.toProps());

    const discovery = await this.discoveryService.discover(input.url);
    candidate.applyFingerprint({
      atsType: discovery.atsType ?? undefined,
      careerUrl: discovery.careerUrl ?? input.url,
      atsEndpoint: discovery.apiEndpoint ?? undefined,
    });

    const { reachable, jobSignalFound } = await this.probeAts(discovery.atsType, candidate.careerUrl, candidate.atsEndpoint, discovery.careerUrl !== null);

    const scoreResult = computeDiscoveryConfidence({
      atsTypeCertainty: classifyAtsTypeCertainty({ atsType: discovery.atsType, apiEndpoint: discovery.apiEndpoint }),
      reachable,
      jobSignalFound,
      sourceAuthorityScore: input.sourceAuthorityScore ?? SINGLE_SHOT_SOURCE_AUTHORITY_SCORE,
      nearestKnownNameSimilarity: nearestMatch?.similarity ?? 0,
    });
    const status = deriveCandidateStatusFromScore(scoreResult.score, candidate.atsType);
    candidate.applyScore({ score: scoreResult.score, status, breakdown: scoreResult.breakdown });
    await this.candidateRepo.update(candidate.toProps());

    if (status === 'AUTO_APPROVED' && this.autoEnrollWorkspaceId) {
      await this.convertToCompanyWatch(candidate, this.autoEnrollWorkspaceId);
    }

    return { outcome: 'SCORED', candidate: candidate.toProps() };
  }

  /** Review-queue approval (ADR §5) — also covers manually converting an AUTO_APPROVED candidate that had no configured auto-enroll workspace. */
  async approve(candidateId: string, workspaceId: string): Promise<CompanyWatchData> {
    const data = await this.candidateRepo.findById(candidateId);
    if (!data) throw new Error(`Company candidate not found: ${candidateId}`);
    if (data.status !== 'AUTO_APPROVED' && data.status !== 'REVIEW_REQUIRED') {
      throw new Error(`Company candidate ${candidateId} is not approvable from status ${data.status}`);
    }
    if (!data.atsType) {
      throw new Error(`Company candidate ${candidateId} has no fingerprinted ATS type — cannot enroll`);
    }

    const candidate = CompanyCandidate.reconstitute(data);
    return this.convertToCompanyWatch(candidate, workspaceId);
  }

  /** Review-queue rejection (ADR §5) — requires a reason, feeding the §10 feedback loop. */
  async reject(candidateId: string, reason: string): Promise<CompanyCandidateData> {
    const data = await this.candidateRepo.findById(candidateId);
    if (!data) throw new Error(`Company candidate not found: ${candidateId}`);

    const candidate = CompanyCandidate.reconstitute(data);
    candidate.reject(reason);
    return this.candidateRepo.update(candidate.toProps());
  }

  private async convertToCompanyWatch(candidate: CompanyCandidate, workspaceId: string): Promise<CompanyWatchData> {
    const atsType = candidate.atsType;
    if (!atsType) throw new Error(`Company candidate ${candidate.id} has no fingerprinted ATS type — cannot enroll`);

    const companyWatch = await this.companyWatchService.addCompany({
      name: candidate.companyName,
      aliases: [],
      languages: ['en'],
      tags: [],
      atsType,
      careerUrl: candidate.careerUrl,
      atsEndpoint: candidate.atsEndpoint,
      pollingInterval: 3600,
      active: true,
      metadata: { discoverySource: candidate.discoverySource, confidenceScore: candidate.confidenceScore },
      workspaceId,
    });

    try {
      candidate.markConverted(companyWatch.id);
      await this.candidateRepo.update(candidate.toProps());
    } catch (error) {
      // CompanyWatch and CompanyCandidate are separate aggregates/repositories
      // (no cross-repo DB transaction spans them) — if marking the candidate
      // CONVERTED fails after the CompanyWatch row was already created,
      // compensate by removing it rather than leaving an orphaned row with no
      // corresponding CONVERTED candidate. Reuses the same delete path ADR-035
      // §16 already established as the one way a CompanyWatch row is removed.
      await this.companyWatchRepo.delete(companyWatch.id).catch(() => {});
      throw error;
    }

    return companyWatch;
  }

  private async probeAts(
    atsType: AtsType | null,
    careerUrl: string,
    atsEndpoint: string | undefined,
    fingerprintFetchSucceeded: boolean
  ): Promise<{ reachable: boolean; jobSignalFound: boolean }> {
    if (!atsType || !this.adapterRegistry.has(atsType)) {
      return { reachable: fingerprintFetchSucceeded, jobSignalFound: false };
    }

    // careerUrl at this point may be a link scraped verbatim from the
    // discovered page's own HTML (CompanyDiscoveryService.findCareersPage),
    // not the URL the caller originally submitted — that first hop was
    // validated, this second one wasn't. Same SSRF surface assertSafeUrl
    // already closes for CompanyWatchService; fail closed like the other
    // error paths in this method rather than let the adapter fetch it.
    try {
      await assertSafeUrl(careerUrl);
      if (atsEndpoint) await assertSafeUrl(atsEndpoint);
    } catch {
      return { reachable: false, jobSignalFound: false };
    }

    const adapter = this.adapterRegistry.get(atsType);
    const config: AtsConfig = { careerUrl, atsEndpoint, metadata: {} };

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
