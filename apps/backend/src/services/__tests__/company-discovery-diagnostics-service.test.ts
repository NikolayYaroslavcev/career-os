import { describe, it, expect } from 'vitest';
import type { CompanyCandidateRepository, CompanyCandidateStatus } from '@careeros/company-watch';
import { CompanyDiscoveryDiagnosticsService } from '../company-discovery-diagnostics-service.js';

function fakeRepo(counts: Partial<Record<CompanyCandidateStatus, number>>): CompanyCandidateRepository {
  return {
    findById: async () => null,
    findByCareerUrl: async () => null,
    findByCompanyName: async () => null,
    findAllByStatus: async () => [],
    create: async (data) => data,
    update: async (data) => data,
    getStatusCounts: async () => ({
      DISCOVERED: 0,
      AUTO_APPROVED: 0,
      REVIEW_REQUIRED: 0,
      REJECTED: 0,
      CONVERTED: 0,
      ...counts,
    }),
  };
}

describe('CompanyDiscoveryDiagnosticsService', () => {
  it('reports zeroed counts and a zero conversion rate with no candidates', async () => {
    const service = new CompanyDiscoveryDiagnosticsService(fakeRepo({}));
    const snapshot = await service.getSnapshot();
    expect(snapshot).toEqual({
      discovered: 0,
      autoApproved: 0,
      reviewRequired: 0,
      rejected: 0,
      converted: 0,
      total: 0,
      conversionRate: 0,
    });
  });

  it('computes total and conversion rate from per-status counts', async () => {
    const service = new CompanyDiscoveryDiagnosticsService(
      fakeRepo({ DISCOVERED: 2, AUTO_APPROVED: 1, REVIEW_REQUIRED: 3, REJECTED: 4, CONVERTED: 5 })
    );
    const snapshot = await service.getSnapshot();
    expect(snapshot.total).toBe(15);
    expect(snapshot.conversionRate).toBeCloseTo(5 / 15);
  });
});
