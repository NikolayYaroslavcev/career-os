import { describe, it, expect } from 'vitest';
import {
  normalizePlainText,
  normalizeHtmlText,
  computeVacancyTextUpdate,
  computeCompanyNameUpdate,
} from '../vacancy-html-normalization.js';

describe('normalizePlainText', () => {
  it('decodes entities and collapses whitespace', () => {
    expect(normalizePlainText('R&amp;D  Engineer')).toBe('R&D Engineer');
    expect(normalizePlainText('  Acme &amp; Co  ')).toBe('Acme & Co');
  });
});

describe('normalizeHtmlText', () => {
  it('strips tags, decodes entities, and collapses whitespace', () => {
    expect(normalizeHtmlText('<p>We build &amp; ship</p>')).toBe('We build & ship');
    expect(normalizeHtmlText('<ul><li>Node.js</li>\n<li>React</li></ul>')).toBe('Node.js React');
  });
});

describe('computeVacancyTextUpdate', () => {
  it('returns changed fields when normalization changes the text', () => {
    const update = computeVacancyTextUpdate({
      title: 'Senior Engineer &amp; Lead',
      description: '<p>Build &amp; ship things</p>',
    });
    expect(update).toEqual({
      title: 'Senior Engineer & Lead',
      description: 'Build & ship things',
    });
  });

  it('returns null (idempotent no-op) when text is already normalized', () => {
    const update = computeVacancyTextUpdate({
      title: 'Senior Engineer & Lead',
      description: 'Build & ship things',
    });
    expect(update).toBeNull();
  });

  it('re-running against already-normalized output is still a no-op', () => {
    const first = computeVacancyTextUpdate({
      title: 'Senior Engineer &amp; Lead',
      description: '<p>Build &amp; ship things</p>',
    });
    expect(first).not.toBeNull();
    if (!first) throw new Error('expected an update');

    const second = computeVacancyTextUpdate({
      title: first.title ?? 'Senior Engineer &amp; Lead',
      description: first.description ?? '<p>Build &amp; ship things</p>',
    });
    expect(second).toBeNull();
  });

  it('only includes the field that actually changed', () => {
    const update = computeVacancyTextUpdate({
      title: 'Already Clean Title',
      description: '<p>Needs &amp; cleanup</p>',
    });
    expect(update).toEqual({ description: 'Needs & cleanup' });
  });
});

describe('computeCompanyNameUpdate', () => {
  it('returns the normalized name when it differs', () => {
    expect(computeCompanyNameUpdate('Acme &amp; Co')).toBe('Acme & Co');
  });

  it('returns null when the name is already normalized', () => {
    expect(computeCompanyNameUpdate('Acme & Co')).toBeNull();
  });
});
