/**
 * Decodes HTML entities in provider-sourced text (titles, descriptions,
 * company names scraped or fetched from job boards). Consolidates the
 * ad-hoc `.replace(/&amp;/g, '&')...` chains that were duplicated (and
 * inconsistently incomplete — most only handled &amp;/&nbsp;, none handled
 * hex numeric refs like &#x27;) across every provider mapper.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  // Typographic punctuation commonly found in scraped job postings (e.g.
  // "We&rsquo;re transforming...").
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  ndash: '–',
  mdash: '—',
  hellip: '…',
};

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const isHex = entity[1]?.toLowerCase() === 'x';
      const code = isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}
