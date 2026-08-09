import type { Locale } from './i18n/config';

// toLocaleString()/toLocaleDateString() with no locale argument formats using
// the browser's default locale, which differs from user to user (and from
// this app's own ru/en locale setting) — pin formatting to the app's active
// locale instead so numbers/dates render consistently for everyone.
const INTL_LOCALE: Record<Locale, string> = {
  ru: 'ru-RU',
  en: 'en-US',
};

function toDate(value: Date | string): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

export function formatDate(value: Date | string, locale: Locale): string {
  return toDate(value).toLocaleDateString(INTL_LOCALE[locale]);
}

export function formatShortDate(value: Date | string, locale: Locale): string {
  return toDate(value).toLocaleDateString(INTL_LOCALE[locale], { month: 'short', day: 'numeric' });
}

export function formatTime(value: Date | string, locale: Locale): string {
  return toDate(value).toLocaleTimeString(INTL_LOCALE[locale]);
}

export function formatDateTime(value: Date | string, locale: Locale): string {
  return toDate(value).toLocaleString(INTL_LOCALE[locale]);
}

export function formatNumber(value: number, locale: Locale): string {
  return value.toLocaleString(INTL_LOCALE[locale]);
}
