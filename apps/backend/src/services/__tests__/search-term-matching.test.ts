import { describe, expect, it } from 'vitest';
import { containsSearchTerm, extractMeaningfulPositionKeywords } from '../search-term-matching.js';

describe('search-term-matching', () => {
  it('matches whole technology terms without matching unrelated substrings', () => {
    expect(containsSearchTerm('We use Go and PostgreSQL in production.', 'go')).toBe(true);
    expect(containsSearchTerm('Experience with Django and PostgreSQL.', 'go')).toBe(false);
  });

  it('keeps meaningful role keywords and drops generic hiring words', () => {
    expect(extractMeaningfulPositionKeywords(['Frontend Developer', 'Senior React Engineer'])).toEqual([
      'frontend',
      'react',
    ]);
  });
});
