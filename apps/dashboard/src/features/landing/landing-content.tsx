'use client';

import Link from 'next/link';
import { Search, ListChecks, BellRing, TrendingUp } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { cn } from '@/lib/utils';

const features = [
  { icon: Search, key: 'search' },
  { icon: ListChecks, key: 'applications' },
  { icon: BellRing, key: 'followUps' },
  { icon: TrendingUp, key: 'progress' },
] as const;

export function LandingContent(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <main className="relative min-h-screen bg-muted">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <div className="mx-auto flex max-w-3xl flex-col items-center gap-10 px-4 pb-16 pt-24 text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">{t('landing.hero.title')}</span>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {t('landing.hero.subtitle')}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">{t('landing.hero.description')}</p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/register" className={cn(buttonVariants({ size: 'lg' }))}>
            {t('landing.cta.getStarted')}
          </Link>
          <Link href="/login" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>
            {t('landing.cta.login')}
          </Link>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-2">
          {features.map(({ icon: Icon, key }) => (
            <Card key={key}>
              <CardHeader>
                <Icon className="h-5 w-5 text-primary" />
                <CardTitle>{t(`landing.features.${key}.title`)}</CardTitle>
                <CardDescription>{t(`landing.features.${key}.description`)}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
