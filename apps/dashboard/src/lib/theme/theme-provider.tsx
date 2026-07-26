'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const themeStorageKey = 'careeros_theme';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(theme: Theme): 'light' | 'dark' {
  const resolved = theme === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : theme;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  return resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = window.localStorage.getItem(themeStorageKey);
    const initial: Theme = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    setThemeState(initial);
    setResolvedTheme(applyTheme(initial));
  }, []);

  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (): void => setResolvedTheme(applyTheme('system'));
    media.addEventListener('change', onChange);
    return (): void => media.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    window.localStorage.setItem(themeStorageKey, next);
    setResolvedTheme(applyTheme(next));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}

export const themeInitScript = `(function(){try{var s=localStorage.getItem('${themeStorageKey}');var d=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
