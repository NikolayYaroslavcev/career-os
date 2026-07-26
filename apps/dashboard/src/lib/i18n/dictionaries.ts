import ru from '@/locales/ru.json';
import en from '@/locales/en.json';
import { defaultLocale, type Locale } from './config';

export const dictionaries = { ru, en } satisfies Record<Locale, unknown>;

export type TranslateVars = Record<string, string | number>;

export function resolvePath(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
}

export function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, token: string) =>
    Object.prototype.hasOwnProperty.call(vars, token) ? String(vars[token]) : match
  );
}

export function translateWithLocale(locale: Locale, key: string, vars?: TranslateVars): string {
  const value = resolvePath(dictionaries[locale], key);
  if (typeof value === 'string') return interpolate(value, vars);

  const fallbackLocale: Locale = locale === defaultLocale ? 'en' : defaultLocale;
  const fallback = resolvePath(dictionaries[fallbackLocale], key);
  if (typeof fallback === 'string') return interpolate(fallback, vars);

  return key;
}
