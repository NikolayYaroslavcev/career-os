import type { CompanyCandidateRepository } from '@careeros/company-watch';

export interface CompanyDiscoveryDiagnostics {
  readonly discovered: number;
  readonly autoApproved: number;
  readonly reviewRequired: number;
  readonly rejected: number;
  readonly converted: number;
  readonly total: number;
  /** converted / total, 0 when there's nothing to divide by yet — the platform's "did this actually work" number (ADR-035 §12). */
  readonly conversionRate: number;
}

/**
 * ADR-035 §11: thin aggregator over CompanyCandidate rows, same role
 * ProviderDiagnosticsService plays for providers — not a parallel system of
 * record. Deliberately its own service (not folded into
 * ProviderDiagnosticsService) since Company Watch is a distinct bounded
 * context from Provider (ADR-033).
 */
export class CompanyDiscoveryDiagnosticsService {
  constructor(private readonly candidateRepo: CompanyCandidateRepository) {}

  async getSnapshot(): Promise<CompanyDiscoveryDiagnostics> {
    const counts = await this.candidateRepo.getStatusCounts();
    const total = counts.DISCOVERED + counts.AUTO_APPROVED + counts.REVIEW_REQUIRED + counts.REJECTED + counts.CONVERTED;

    return {
      discovered: counts.DISCOVERED,
      autoApproved: counts.AUTO_APPROVED,
      reviewRequired: counts.REVIEW_REQUIRED,
      rejected: counts.REJECTED,
      converted: counts.CONVERTED,
      total,
      conversionRate: total > 0 ? counts.CONVERTED / total : 0,
    };
  }
}
