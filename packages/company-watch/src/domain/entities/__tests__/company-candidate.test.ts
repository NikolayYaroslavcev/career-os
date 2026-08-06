import { describe, it, expect } from 'vitest';
import { CompanyCandidate } from '../company-candidate.js';

function createCandidate(): CompanyCandidate {
  return CompanyCandidate.create({
    id: 'candidate-1',
    companyName: 'Acme Inc',
    careerUrl: 'https://acme.example/careers',
    discoverySource: 'manual',
  });
}

describe('CompanyCandidate', () => {
  it('starts in DISCOVERED with no ATS type or score', () => {
    const candidate = createCandidate();
    expect(candidate.status).toBe('DISCOVERED');
    expect(candidate.atsType).toBeUndefined();
    expect(candidate.confidenceScore).toBeUndefined();
  });

  it('applyFingerprint sets atsType/careerUrl/atsEndpoint', () => {
    const candidate = createCandidate();
    candidate.applyFingerprint({
      atsType: 'GREENHOUSE',
      careerUrl: 'https://acme.example/careers',
      atsEndpoint: 'https://boards-api.greenhouse.io/v1/boards/acme/jobs',
    });
    expect(candidate.atsType).toBe('GREENHOUSE');
    expect(candidate.atsEndpoint).toBe('https://boards-api.greenhouse.io/v1/boards/acme/jobs');
  });

  it('applyScore sets confidenceScore/status and stores the breakdown in metadata', () => {
    const candidate = createCandidate();
    candidate.applyScore({ score: 90, status: 'AUTO_APPROVED', breakdown: { atsTypeCertainty: 100 } });
    expect(candidate.confidenceScore).toBe(90);
    expect(candidate.status).toBe('AUTO_APPROVED');
    expect(candidate.metadata?.confidenceBreakdown).toEqual({ atsTypeCertainty: 100 });
  });

  it('reject sets status REJECTED and stores the reason', () => {
    const candidate = createCandidate();
    candidate.reject('duplicate of an existing subsidiary');
    expect(candidate.status).toBe('REJECTED');
    expect(candidate.metadata?.rejectionReason).toBe('duplicate of an existing subsidiary');
  });

  it('markConverted sets status CONVERTED and stores the resulting CompanyWatch id', () => {
    const candidate = createCandidate();
    candidate.markConverted('company-watch-1');
    expect(candidate.status).toBe('CONVERTED');
    expect(candidate.metadata?.companyWatchId).toBe('company-watch-1');
  });

  it('reconstitute round-trips through toProps', () => {
    const candidate = createCandidate();
    candidate.applyFingerprint({ atsType: 'LEVER', careerUrl: 'https://acme.example/careers' });
    candidate.applyScore({ score: 70, status: 'REVIEW_REQUIRED', breakdown: {} });

    const rehydrated = CompanyCandidate.reconstitute(candidate.toProps());
    expect(rehydrated.toProps()).toEqual(candidate.toProps());
  });
});
