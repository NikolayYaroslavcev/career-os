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
    it('sorts by absolute impact descending', () => {
      const factors = [
        createFactor({ impact: 5 }),
        createFactor({ impact: -20 }),
        createFactor({ impact: 15 }),
        createFactor({ impact: -3 }),
      ];

      const ranked = rankFactorsByImpact(factors);
      expect(ranked.map((f) => f.impact)).toEqual([-20, 15, 5, -3]);
    });

    it('handles empty array', () => {
      expect(rankFactorsByImpact([])).toEqual([]);
    });
  });

  describe('getPositiveFactors', () => {
    it('returns matched factors with positive impact', () => {
      const factors = [
        createFactor({ matched: true, impact: 10 }),
        createFactor({ matched: false, impact: 10 }),
        createFactor({ matched: true, impact: -5 }),
        createFactor({ matched: true, impact: 20 }),
      ];

      const positive = getPositiveFactors(factors);
      expect(positive).toHaveLength(2);
      expect(positive.every((f) => f.matched && f.impact > 0)).toBe(true);
    });
  });

  describe('getNegativeFactors', () => {
    it('returns unmatched or negative impact factors', () => {
      const factors = [
        createFactor({ matched: true, impact: 10 }),
        createFactor({ matched: false, impact: 5 }),
        createFactor({ matched: true, impact: -5 }),
        createFactor({ matched: false, impact: -10 }),
      ];

      const negative = getNegativeFactors(factors);
      expect(negative).toHaveLength(3);
    });
  });

  describe('factor categories', () => {
    it('supports all factor categories', () => {
      const categories: ExplainabilityFactor['category'][] = [
        'skill', 'experience', 'salary', 'location', 'growth', 'culture',
      ];

      for (const category of categories) {
        const factor = createFactor({ category });
        expect(factor.category).toBe(category);
      }
    });
  });
});
