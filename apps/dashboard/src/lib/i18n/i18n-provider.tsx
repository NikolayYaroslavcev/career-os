'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isLocale, localeCookieName, localeStorageKey, type Locale } from './config';
import { translateWithLocale, type TranslateVars } from './dictionaries';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: TranslateVars) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function persistLocale(locale: Locale): void {
  window.localStorage.setItem(localeStorageKey, locale);
  document.cookie = `${localeCookieName}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}): React.JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const stored = window.localStorage.getItem(localeStorageKey);
    if (isLocale(stored) && stored !== initialLocale) {
      setLocaleState(stored);
    }
    // Only reconcile against localStorage once, on mount.
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: TranslateVars): string => translateWithLocale(locale, key, vars),
    [locale]
  );

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return ctx;
}
