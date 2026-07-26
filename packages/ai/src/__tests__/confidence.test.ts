import { describe, it, expect } from 'vitest';
import { rankFactorsByImpact, getPositiveFactors, getNegativeFactors } from '../matching/explainability.js';
import type { ExplainabilityFactor } from '../matching/explainability.js';

function createFactor(overrides: Partial<ExplainabilityFactor> = {}): ExplainabilityFactor {
  return {
    category: 'skill',
    label: 'TypeScript',
    impact: 10,
    explanation: 'Strong TypeScript experience',
    matched: true,
    ...overrides,
  };
}

describe('Explainability', () => {
  describe('rankFactorsByImpact', () => {
    it('sorts factors by absolute impact', () => {
      const factors: ExplainabilityFactor[] = [
        createFactor({ impact: 5 }),
        createFactor({ impact: -20 }),
        createFactor({ impact: 15 }),
      ];

      const ranked = rankFactorsByImpact(factors);
      expect(ranked[0]?.impact).toBe(-20);
      expect(ranked[1]?.impact).toBe(15);
      expect(ranked[2]?.impact).toBe(5);
    });
  });

  describe('getPositiveFactors', () => {
    it('returns only matched factors with positive impact', () => {
      const factors: ExplainabilityFactor[] = [
        createFactor({ matched: true, impact: 10 }),
        createFactor({ matched: false, impact: 5 }),
        createFactor({ matched: true, impact: -5 }),
      ];

      const positive = getPositiveFactors(factors);
      expect(positive).toHaveLength(1);
      expect(positive[0]?.impact).toBe(10);
    });
  });

  describe('getNegativeFactors', () => {
    it('returns unmatched factors or negative impact', () => {
      const factors: ExplainabilityFactor[] = [
        createFactor({ matched: true, impact: 10 }),
        createFactor({ matched: false, impact: 5 }),
        createFactor({ matched: true, impact: -5 }),
      ];

      const negative = getNegativeFactors(factors);
      expect(negative).toHaveLength(2);
    });
  });
});
