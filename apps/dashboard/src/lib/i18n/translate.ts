import { defaultLocale, isLocale, localeCookieName, localeStorageKey, type Locale } from './config';
import { translateWithLocale, type TranslateVars } from './dictionaries';

function readCookieLocale(): string | undefined {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${localeCookieName}=`))
    ?.split('=')[1];
}

function getClientLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale;
  const stored = window.localStorage.getItem(localeStorageKey) ?? readCookieLocale();
  return isLocale(stored) ? stored : defaultLocale;
}

/**
 * Translation helper for use outside React components (e.g. stores).
 * Reads the current locale synchronously from localStorage/cookie.
 */
export function translate(key: string, vars?: TranslateVars): string {
  return translateWithLocale(getClientLocale(), key, vars);
}
