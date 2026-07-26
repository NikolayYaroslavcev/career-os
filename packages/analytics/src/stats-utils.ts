/** Shared numeric helpers for the analytics package's pure computation functions. */

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    const lower = sorted[mid - 1] ?? 0;
    const upper = sorted[mid] ?? 0;
    return (lower + upper) / 2;
  }

  return sorted[mid] ?? 0;
}

/**
 * Pearson correlation coefficient between a numeric variable and a binary
 * (0/1) outcome. Returns a value in [-1, 1]; 0 when there's no variance in
 * either series (e.g. fewer than 2 samples, or every outcome identical).
 */
export function pearsonCorrelation(xs: readonly number[], ys: readonly number[]): number {
  const n = xs.length;
  if (n < 2 || ys.length !== n) return 0;

  const meanX = mean(xs);
  const meanY = mean(ys);

  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;

  for (let i = 0; i < n; i++) {
    const dx = (xs[i] ?? 0) - meanX;
    const dy = (ys[i] ?? 0) - meanY;
    covariance += dx * dy;
    varianceX += dx * dx;
    varianceY += dy * dy;
  }

  if (varianceX === 0 || varianceY === 0) return 0;

  return covariance / Math.sqrt(varianceX * varianceY);
}
