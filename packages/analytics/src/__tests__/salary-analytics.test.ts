import { describe, it, expect } from 'vitest';
import { computeAverageSalary } from '../salary-analytics.js';

describe('computeAverageSalary', () => {
  it('returns null when there is no salary data', () => {
    const result = computeAverageSalary([{ salaryMin: null, salaryMax: null, currency: null }]);
    expect(result).toEqual({ avgSalary: null, currency: null });
  });

  it('averages salary midpoints when all entries share one currency', () => {
    const result = computeAverageSalary([
      { salaryMin: 80000, salaryMax: 100000, currency: 'USD' },
      { salaryMin: 60000, salaryMax: 80000, currency: 'USD' },
    ]);
    // midpoints: 90000, 70000 -> avg 80000
    expect(result).toEqual({ avgSalary: 80000, currency: 'USD' });
  });

  it('refuses to average across mixed currencies', () => {
    const result = computeAverageSalary([
      { salaryMin: 80000, salaryMax: 100000, currency: 'USD' },
      { salaryMin: 60000, salaryMax: 80000, currency: 'EUR' },
    ]);
    expect(result).toEqual({ avgSalary: null, currency: null });
  });

  it('handles entries with only salaryMin or only salaryMax', () => {
    const result = computeAverageSalary([
      { salaryMin: 100000, salaryMax: null, currency: 'USD' },
      { salaryMin: null, salaryMax: 100000, currency: 'USD' },
    ]);
    expect(result).toEqual({ avgSalary: 100000, currency: 'USD' });
  });

  it('ignores entries with an unknown currency when checking for a single currency', () => {
    const result = computeAverageSalary([
      { salaryMin: 80000, salaryMax: 100000, currency: null },
    ]);
    // a single entry with unknown currency contributes no known currency at all
    expect(result).toEqual({ avgSalary: null, currency: null });
  });
});
