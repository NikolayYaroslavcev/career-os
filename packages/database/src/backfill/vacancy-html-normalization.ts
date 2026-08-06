import { decodeHtmlEntities } from '@careeros/providers';

const TAG_PATTERN = /<[^>]*>/g;
const WHITESPACE_PATTERN = /\s+/g;

/**
 * Matches the normalizeTitle/normalizeCompanyName convention used by
 * provider mappers (e.g. hh-mapper.ts): decode entities, collapse
 * whitespace, trim. No tag-stripping — these fields aren't expected to
 * contain markup.
 */
export function normalizePlainText(text: string): string {
  return decodeHtmlEntities(text).replace(WHITESPACE_PATTERN, ' ').trim();
}

/**
 * Matches the normalizeDescription convention used by provider mappers:
 * strip tags first, then decode entities, then collapse whitespace/trim.
 */
export function normalizeHtmlText(text: string): string {
  return decodeHtmlEntities(text.replace(TAG_PATTERN, '')).replace(WHITESPACE_PATTERN, ' ').trim();
}

export interface VacancyTextFields {
  title: string;
  description: string;
}

export interface VacancyTextUpdate {
  title?: string;
  description?: string;
}

/**
 * Returns only the fields that actually change under normalization, or
 * null if the record is already normalized. Since decodeHtmlEntities is
 * non-double-decoding, re-running this against already-normalized text
 * always yields null — making the backfill safe to run repeatedly.
 */
export function computeVacancyTextUpdate(fields: VacancyTextFields): VacancyTextUpdate | null {
  const update: VacancyTextUpdate = {};

  const title = normalizePlainText(fields.title);
  if (title !== fields.title) {
    update.title = title;
  }

  const description = normalizeHtmlText(fields.description);
  if (description !== fields.description) {
    update.description = description;
  }

  return Object.keys(update).length > 0 ? update : null;
}

/** Returns the normalized company name, or null if already normalized. */
export function computeCompanyNameUpdate(name: string): string | null {
  const normalized = normalizePlainText(name);
  return normalized !== name ? normalized : null;
}
