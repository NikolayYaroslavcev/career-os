const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
]);

const GENERIC_POSITION_KEYWORDS = new Set([
  'developer',
  'engineer',
  'programmer',
  'specialist',
  'manager',
  'lead',
  'senior',
  'middle',
  'mid',
  'junior',
  'intern',
  'staff',
  'principal',
  'architect',
  'разработчик',
  'инженер',
  'специалист',
  'менеджер',
  'лид',
  'старший',
  'младший',
  'стажер',
  'стажёр',
  'архитектор',
]);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function containsSearchTerm(text: string, term: string): boolean {
  const normalizedText = text.trim().toLowerCase();
  const normalizedTerm = term.trim().toLowerCase();
  if (!normalizedText || !normalizedTerm) return false;

  const escapedTerm = escapeRegex(normalizedTerm).replace(/\s+/g, '\\s+');
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapedTerm}(?=$|[^\\p{L}\\p{N}])`, 'iu');
  return pattern.test(normalizedText);
}

export function extractMeaningfulPositionKeywords(positions: readonly string[]): string[] {
  const keywords: string[] = [];

  for (const position of positions) {
    for (const word of position.split(/\s+/)) {
      const normalized = word.toLowerCase().trim();
      if (!normalized) continue;
      if (normalized.length <= 1) continue;
      if (STOP_WORDS.has(normalized)) continue;
      if (GENERIC_POSITION_KEYWORDS.has(normalized)) continue;
      keywords.push(normalized);
    }
  }

  return [...new Set(keywords)];
}
