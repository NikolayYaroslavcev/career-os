'use client';

import { Globe } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
      <Select value={locale} onValueChange={(value) => value && setLocale(value as Locale)}>
        <SelectTrigger id="language-switcher" aria-label={t('language.label')} className="h-8 min-w-24">
          <SelectValue>
            {(value: Locale) => t(`language.${value}`)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
        {locales.map((l) => (
          <SelectItem key={l} value={l}>
            {t(`language.${l}`)}
          </SelectItem>
        ))}
        </SelectContent>
      </Select>
    </div>
  );
}
