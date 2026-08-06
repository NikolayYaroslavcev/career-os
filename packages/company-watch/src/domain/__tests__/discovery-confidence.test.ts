import { describe, it, expect } from 'vitest';
import {
  computeDiscoveryConfidence,
  classifyAtsTypeCertainty,
  deriveCandidateStatusFromScore,
  DISCOVERY_AUTO_ENROLL_THRESHOLD,
  DISCOVERY_REVIEW_THRESHOLD,
  SINGLE_SHOT_SOURCE_AUTHORITY_SCORE,
} from '../discovery-confidence.js';

describe('classifyAtsTypeCertainty', () => {
  it('classifies a resolved apiEndpoint as STRUCTURED_MATCH', () => {
    expect(classifyAtsTypeCertainty({ atsType: 'GREENHOUSE', apiEndpoint: 'https://boards-api.greenhouse.io/v1/boards/acme/jobs' })).toBe(
      'STRUCTURED_MATCH'
    );
  });

  it('classifies a bare ATS type with no endpoint as HEURISTIC_MATCH', () => {
    expect(classifyAtsTypeCertainty({ atsType: 'LEVER', apiEndpoint: null })).toBe('HEURISTIC_MATCH');
  });

  it('classifies CUSTOM_HTML/JSON_LD as FALLBACK', () => {
    expect(classifyAtsTypeCertainty({ atsType: 'CUSTOM_HTML', apiEndpoint: null })).toBe('FALLBACK');
    expect(classifyAtsTypeCertainty({ atsType: 'JSON_LD', apiEndpoint: null })).toBe('FALLBACK');
  });

  it('classifies a total fingerprint failure (null atsType) as FALLBACK', () => {
    expect(classifyAtsTypeCertainty({ atsType: null, apiEndpoint: null })).toBe('FALLBACK');
  });
});

describe('computeDiscoveryConfidence', () => {
  it('is deterministic: same input always produces the same score', () => {
    const input = {
      atsTypeCertainty: 'STRUCTURED_MATCH' as const,
      reachable: true,
      jobSignalFound: true,
      sourceAuthorityScore: SINGLE_SHOT_SOURCE_AUTHORITY_SCORE,
      nearestKnownNameSimilarity: 0,
    };
    expect(computeDiscoveryConfidence(input).score).toBe(computeDiscoveryConfidence(input).score);
  });

  it('scores a fully-verified structured candidate above the review threshold (vacancy pipeline signals needed for auto-enroll)', () => {
    const result = computeDiscoveryConfidence({
      atsTypeCertainty: 'STRUCTURED_MATCH',
      reachable: true,
      jobSignalFound: true,
      sourceAuthorityScore: SINGLE_SHOT_SOURCE_AUTHORITY_SCORE,
      nearestKnownNameSimilarity: 0,
    });
    expect(result.score).toBeGreaterThanOrEqual(DISCOVERY_REVIEW_THRESHOLD);
    expect(result.score).toBeLessThan(DISCOVERY_AUTO_ENROLL_THRESHOLD);
  });

  it('reaches auto-enroll threshold with vacancy pipeline signals', () => {
    const result = computeDiscoveryConfidence({
      atsTypeCertainty: 'STRUCTURED_MATCH',
      reachable: true,
      jobSignalFound: true,
      sourceAuthorityScore: SINGLE_SHOT_SOURCE_AUTHORITY_SCORE,
      nearestKnownNameSimilarity: 0,
      vacancyPipelineSignals: {
        seenCount: 3,
        vacancyCount: 5,
        providerCount: 2,
        hasCareerUrl: true,
      },
    });
    expect(result.score).toBeGreaterThanOrEqual(DISCOVERY_AUTO_ENROLL_THRESHOLD);
  });

  it('scores a totally-failed fingerprint below the reject threshold', () => {
    const result = computeDiscoveryConfidence({
      atsTypeCertainty: 'FALLBACK',
      reachable: false,
      jobSignalFound: false,
      sourceAuthorityScore: 0,
      nearestKnownNameSimilarity: 0,
    });
    expect(result.score).toBeLessThan(DISCOVERY_REVIEW_THRESHOLD);
  });

  it('lowers the dedup-distance category as nearest-known-name similarity rises', () => {
    const near = computeDiscoveryConfidence({
      atsTypeCertainty: 'STRUCTURED_MATCH',
      reachable: true,
      jobSignalFound: true,
      sourceAuthorityScore: 100,
      nearestKnownNameSimilarity: 0.85,
    });
    const far = computeDiscoveryConfidence({
      atsTypeCertainty: 'STRUCTURED_MATCH',
      reachable: true,
      jobSignalFound: true,
      sourceAuthorityScore: 100,
      nearestKnownNameSimilarity: 0,
    });
    expect(near.breakdown.dedupDistance).toBeLessThan(far.breakdown.dedupDistance);
    expect(near.score).toBeLessThan(far.score);
  });

  it('clamps the final score to [0, 100]', () => {
    const result = computeDiscoveryConfidence({
      atsTypeCertainty: 'STRUCTURED_MATCH',
      reachable: true,
      jobSignalFound: true,
      sourceAuthorityScore: 999,
      nearestKnownNameSimilarity: 0,
    });
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('deriveCandidateStatusFromScore', () => {
  it('routes a high score with a structured ATS type to AUTO_APPROVED', () => {
    expect(deriveCandidateStatusFromScore(90, 'GREENHOUSE')).toBe('AUTO_APPROVED');
  });

  it('never auto-enrolls CUSTOM_HTML/JSON_LD regardless of score (ADR-035 §4)', () => {
    expect(deriveCandidateStatusFromScore(100, 'CUSTOM_HTML')).toBe('REVIEW_REQUIRED');
    expect(deriveCandidateStatusFromScore(100, 'JSON_LD')).toBe('REVIEW_REQUIRED');
  });

  it('routes a high score with no fingerprinted ATS type to REVIEW_REQUIRED', () => {
    expect(deriveCandidateStatusFromScore(95, undefined)).toBe('REVIEW_REQUIRED');
  });

  it('routes a mid-band score to REVIEW_REQUIRED', () => {
    expect(deriveCandidateStatusFromScore(60, 'GREENHOUSE')).toBe('REVIEW_REQUIRED');
  });

  it('routes a low score to REJECTED', () => {
    expect(deriveCandidateStatusFromScore(10, 'GREENHOUSE')).toBe('REJECTED');
  });

  it('treats the threshold boundaries as inclusive on the higher band', () => {
    expect(deriveCandidateStatusFromScore(DISCOVERY_REVIEW_THRESHOLD, 'GREENHOUSE')).toBe('REVIEW_REQUIRED');
    expect(deriveCandidateStatusFromScore(DISCOVERY_AUTO_ENROLL_THRESHOLD, 'GREENHOUSE')).toBe('AUTO_APPROVED');
  });
});
