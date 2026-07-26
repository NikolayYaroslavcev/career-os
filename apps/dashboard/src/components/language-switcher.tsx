'use client';

import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { locales, type Locale } from '@/lib/i18n/config';

export function LanguageSwitcher({ className }: { className?: string }): React.JSX.Element {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <Globe className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <label className="sr-only" htmlFor="language-switcher">
        {t('language.label')}
      </label>
      <select
        id="language-switcher"
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t('language.label')}
        className="rounded-lg border border-input bg-transparent py-1 pl-2 pr-6 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {locales.map((l) => (
          <option key={l} value={l}>
            {t(`language.${l}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
