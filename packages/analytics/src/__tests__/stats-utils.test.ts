import { describe, it, expect } from 'vitest';
import { mean, median, pearsonCorrelation } from '../stats-utils.js';

describe('mean', () => {
  it('returns 0 for an empty array', () => {
    expect(mean([])).toBe(0);
  });

  it('computes the arithmetic mean', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
  });
});

describe('median', () => {
  it('returns 0 for an empty array', () => {
    expect(median([])).toBe(0);
  });

  it('returns the middle value for an odd-length array', () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it('averages the two middle values for an even-length array', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('does not mutate the input array', () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe('pearsonCorrelation', () => {
  it('returns 0 for fewer than 2 samples', () => {
    expect(pearsonCorrelation([1], [1])).toBe(0);
  });

  it('returns 0 when the arrays have mismatched lengths', () => {
    expect(pearsonCorrelation([1, 2], [1])).toBe(0);
  });

  it('returns 1 for perfectly correlated series', () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 5);
  });

  it('returns -1 for perfectly inversely correlated series', () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1, 5);
  });

  it('returns 0 when one series has no variance', () => {
    expect(pearsonCorrelation([1, 1, 1], [1, 2, 3])).toBe(0);
  });
});
