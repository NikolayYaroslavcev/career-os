/**
 * Extracted from packages/providers/src/deduplication/deduplication-engine.ts
 * (ADR-035 §5: company-watch's candidate deduplication needs the same
 * Levenshtein matcher without copying it — this is the shared home both
 * packages import from instead of maintaining two copies).
 */
export function normalizeForMatching(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

export function computeLevenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0]![j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost
      );
    }
  }

  const maxLen = Math.max(a.length, b.length);
  return 1 - matrix[a.length]![b.length]! / maxLen;
}
