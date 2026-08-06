import { describe, it, expect } from 'vitest';
import { decodeHtmlEntities } from '../html-entities.js';

describe('decodeHtmlEntities', () => {
  it('decodes named entities', () => {
    expect(decodeHtmlEntities('R&amp;D')).toBe('R&D');
    expect(decodeHtmlEntities('&lt;script&gt;')).toBe('<script>');
    expect(decodeHtmlEntities('say &quot;hi&quot;')).toBe('say "hi"');
    expect(decodeHtmlEntities('a&nbsp;b')).toBe('a b');
  });

  it('decodes common typographic entities', () => {
    expect(decodeHtmlEntities('We&rsquo;re hiring')).toBe('We’re hiring');
    expect(decodeHtmlEntities('&lsquo;quoted&rsquo;')).toBe('‘quoted’');
    expect(decodeHtmlEntities('&ldquo;quoted&rdquo;')).toBe('“quoted”');
    expect(decodeHtmlEntities('9am&ndash;5pm')).toBe('9am–5pm');
    expect(decodeHtmlEntities('remote&mdash;first')).toBe('remote—first');
    expect(decodeHtmlEntities('wait&hellip;')).toBe('wait…');
  });

  it('decodes decimal and hex numeric entities, including apostrophes', () => {
    expect(decodeHtmlEntities('that&#x27;s')).toBe("that's");
    expect(decodeHtmlEntities('that&#39;s')).toBe("that's");
    expect(decodeHtmlEntities('&#036;100')).toBe('$100');
    expect(decodeHtmlEntities('&#8381;')).toBe('₽');
  });

  it('leaves unmatched/unknown entities untouched', () => {
    expect(decodeHtmlEntities('&unknown;')).toBe('&unknown;');
    expect(decodeHtmlEntities('plain text')).toBe('plain text');
  });

  it('does not double-decode &amp;lt; into <', () => {
    expect(decodeHtmlEntities('&amp;lt;')).toBe('&lt;');
  });
});
