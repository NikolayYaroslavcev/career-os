import { describe, it, expect } from 'vitest';
import { buildCompactResumeContext, estimateTokens } from '../resume-context-builder.js';

describe('estimateTokens', () => {
  it('estimates Cyrillic text as far more token-dense than equivalent-length Latin text', () => {
    const latin = 'a'.repeat(400);
    const cyrillic = 'а'.repeat(400); // Cyrillic "а", not Latin "a"

    expect(estimateTokens(cyrillic)).toBeGreaterThan(estimateTokens(latin));
  });
});

describe('buildCompactResumeContext', () => {
  it('returns short resumes unchanged', () => {
    const text = 'Senior Backend Engineer with TypeScript and Node.js experience.';
    expect(buildCompactResumeContext(text, 1800, 8000)).toBe(text);
  });

  it('falls back to a plain token-aware truncate when no sections are recognized', () => {
    const unstructured = 'Senior Backend Engineer with TypeScript experience. '.repeat(1000);
    const result = buildCompactResumeContext(unstructured, 1800, 8000);

    expect(result.length).toBeLessThan(unstructured.length);
    expect(estimateTokens(result)).toBeLessThanOrEqual(1800 + 50); // small slack for the truncation notice
  });

  it('keeps the Skills section even when the resume is too long to include in full and Skills is the last section', () => {
    const filler = 'Delivered large-scale backend systems serving millions of requests per day. '.repeat(200);
    const longResume = [
      'Experience',
      filler,
      'Education',
      'Some University, Computer Science, 2010-2015',
      'Skills',
      'TypeScript, Node.js, Kubernetes, PostgreSQL, GraphQL',
    ].join('\n\n');

    expect(estimateTokens(longResume)).toBeGreaterThan(1800);

    const result = buildCompactResumeContext(longResume, 1800, 8000);

    expect(result).toContain('TypeScript');
    expect(result).toContain('Kubernetes');
    expect(result.length).toBeLessThan(longResume.length);
  });

  it('respects the overall token budget after combining sections', () => {
    const filler = 'Built and maintained distributed systems at scale. '.repeat(300);
    const longResume = ['Experience', filler, 'Skills', 'TypeScript, Node.js, PostgreSQL'].join('\n\n');

    const result = buildCompactResumeContext(longResume, 1800, 8000);

    expect(estimateTokens(result)).toBeLessThanOrEqual(1800 + 50);
  });
});
