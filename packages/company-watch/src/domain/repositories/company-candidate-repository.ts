import type { AtsType } from '../value-objects/ats-type.js';
import type { CompanyCandidateStatus } from '../entities/company-candidate.js';

export interface CompanyCandidateData {
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

export interface CompanyCandidateRepository {
  findById(id: string): Promise<CompanyCandidateData | null>;
  /** Used by CandidateDeduplicationService's exact-URL idempotency check before a new row is created. */
  findByCareerUrl(careerUrl: string): Promise<CompanyCandidateData | null>;
  /** Find active candidates by company name (exact match, case-insensitive). */
  findByCompanyName(companyName: string): Promise<CompanyCandidateData | null>;
  findAllByStatus(
    statuses: readonly CompanyCandidateStatus[],
    options?: { limit?: number; offset?: number }
  ): Promise<CompanyCandidateData[]>;
  /** One query for CompanyDiscoveryDiagnosticsService (ADR-035 §11/§12) rather than one count per status. */
  getStatusCounts(): Promise<Record<CompanyCandidateStatus, number>>;
  create(data: CompanyCandidateData): Promise<CompanyCandidateData>;
  update(data: CompanyCandidateData): Promise<CompanyCandidateData>;
}
