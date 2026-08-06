/**
 * Russian has 3 plural forms selected by count (not just singular/plural):
 * one (1, 21, 31...), few (2-4, 22-24...), many (0, 5-20, 25-30...).
 * English only distinguishes one vs. other.
 */
export function pluralize(
  locale: string,
  count: number,
  forms: { one: string; few: string; many: string }
): string {
  if (locale === 'en') {
    return count === 1 ? forms.one : forms.many;
  }

  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms.one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms.few;
  return forms.many;
}
