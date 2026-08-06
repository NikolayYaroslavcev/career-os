import type { AtsType } from '../value-objects/ats-type.js';

/**
 * ADR-035 Phase 2 lifecycle. Collapses the ADR §1 diagram's transient
 * FINGERPRINTED/SCORED steps (Phase 2 does single-shot, synchronous
 * fingerprint+score with no bulk queue yet) and drops DUPLICATE as a
 * persisted status — a duplicate is rejected at intake, before a
 * CompanyCandidate row is ever created (see CandidateDeduplicationService),
 * so there is nothing to persist that state onto.
 */
export type CompanyCandidateStatus =
  | 'DISCOVERED'
  | 'AUTO_APPROVED'
  | 'REVIEW_REQUIRED'
  | 'REJECTED'
  | 'CONVERTED';

export interface CompanyCandidateProps {
  id: string;
  companyName: string;
  careerUrl: string;
  atsType?: AtsType;
  atsEndpoint?: string;
  discoverySource: string;
  confidenceScore?: number;
  status: CompanyCandidateStatus;
  metadata?: Record<string, unknown>;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
  seenCount: number;
  vacancyCount: number;
  providerCount: number;
  providers: string[];
  lastVacancyTitle?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FingerprintResult {
  atsType?: AtsType;
  careerUrl: string;
  atsEndpoint?: string;
}

export interface ScoreResult {
  score: number;
  status: CompanyCandidateStatus;
  breakdown: Record<string, number>;
}

export class CompanyCandidate {
  private constructor(private readonly props: CompanyCandidateProps) {}

  static create(
    props: Pick<CompanyCandidateProps, 'id' | 'companyName' | 'careerUrl' | 'discoverySource'> &
      Partial<Pick<CompanyCandidateProps, 'metadata'>>
  ): CompanyCandidate {
    const now = new Date();
    return new CompanyCandidate({
      ...props,
      status: 'DISCOVERED',
      seenCount: 0,
      vacancyCount: 0,
      providerCount: 0,
      providers: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: CompanyCandidateProps): CompanyCandidate {
    return new CompanyCandidate(props);
  }

  get id(): string {
    return this.props.id;
  }

  get companyName(): string {
    return this.props.companyName;
  }

  get careerUrl(): string {
    return this.props.careerUrl;
  }

  get atsType(): AtsType | undefined {
    return this.props.atsType;
  }

  get atsEndpoint(): string | undefined {
    return this.props.atsEndpoint;
  }

  get discoverySource(): string {
    return this.props.discoverySource;
  }

  get confidenceScore(): number | undefined {
    return this.props.confidenceScore;
  }

  get status(): CompanyCandidateStatus {
    return this.props.status;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this.props.metadata;
  }

  get firstSeenAt(): Date | undefined {
    return this.props.firstSeenAt;
  }

  get lastSeenAt(): Date | undefined {
    return this.props.lastSeenAt;
  }

  get seenCount(): number {
    return this.props.seenCount;
  }

  get vacancyCount(): number {
    return this.props.vacancyCount;
  }

  get providerCount(): number {
    return this.props.providerCount;
  }

  get providers(): readonly string[] {
    return this.props.providers;
  }

  get lastVacancyTitle(): string | undefined {
    return this.props.lastVacancyTitle;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** ADR-035 §1 step 3: apply CompanyDiscoveryService's fingerprint result. */
  applyFingerprint(result: FingerprintResult): void {
    this.props.atsType = result.atsType;
    this.props.careerUrl = result.careerUrl;
    this.props.atsEndpoint = result.atsEndpoint;
    this.props.updatedAt = new Date();
  }

  /** ADR-035 §2/§4: apply the deterministic confidence score and its routed status. */
  applyScore(result: ScoreResult): void {
    this.props.confidenceScore = result.score;
    this.props.status = result.status;
    this.props.metadata = { ...this.props.metadata, confidenceBreakdown: result.breakdown };
    this.props.updatedAt = new Date();
  }

  /** Human rejection from the review queue (ADR-035 §5), distinct from the scorer's own REJECTED band. */
  reject(reason: string): void {
    this.props.status = 'REJECTED';
    this.props.metadata = { ...this.props.metadata, rejectionReason: reason };
    this.props.updatedAt = new Date();
  }

  /** ADR-035 §4/§5: candidate became a CompanyWatch row, either automatically or via review-queue approval. */
  markConverted(companyWatchId: string): void {
    this.props.status = 'CONVERTED';
    this.props.metadata = { ...this.props.metadata, companyWatchId };
    this.props.updatedAt = new Date();
  }

  /** ADR-035 Phase 3: record a vacancy sighting from the sync pipeline. */
  recordVacancySighting(providerId: string, vacancyTitle: string): void {
    const now = new Date();
    if (!this.props.firstSeenAt) this.props.firstSeenAt = now;
    this.props.lastSeenAt = now;
    this.props.seenCount++;
    this.props.vacancyCount++;
    this.props.lastVacancyTitle = vacancyTitle;
    if (!this.props.providers.includes(providerId)) {
      this.props.providers.push(providerId);
      this.props.providerCount = this.props.providers.length;
    }
    this.props.updatedAt = now;
  }

  toProps(): CompanyCandidateProps {
    return { ...this.props };
  }
}
