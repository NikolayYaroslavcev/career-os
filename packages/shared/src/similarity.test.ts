import { describe, it, expect } from 'vitest';
import { normalizeForMatching, computeLevenshteinSimilarity } from './similarity.js';

describe('normalizeForMatching', () => {
  it('lowercases, trims, strips punctuation, and collapses whitespace', () => {
    expect(normalizeForMatching('  Acme, Inc.  ')).toBe('acme inc');
  });
});

describe('computeLevenshteinSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(computeLevenshteinSimilarity('acme', 'acme')).toBe(1);
  });

  it('returns 0 when either string is empty', () => {
    expect(computeLevenshteinSimilarity('', 'acme')).toBe(0);
    expect(computeLevenshteinSimilarity('acme', '')).toBe(0);
  });

  it('scores near-identical strings highly', () => {
    expect(computeLevenshteinSimilarity('acme inc', 'acme incorporated')).toBeGreaterThan(0.4);
  });

  it('scores unrelated strings low', () => {
    expect(computeLevenshteinSimilarity('acme', 'zzzzzzzz')).toBeLessThan(0.2);
  });
});
