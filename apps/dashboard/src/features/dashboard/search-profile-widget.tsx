'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { listSearchProfiles, type SearchProfile } from '@/api/search-profiles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Plus } from 'lucide-react';

export function SearchProfileWidget(): React.JSX.Element {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<SearchProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    listSearchProfiles()
      .then(data => {
        const active = data.searchProfiles.find(p => p.isActive) ?? data.searchProfiles[0];
        if (active) setProfile(active);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{t('dashboardHome.sections.searchProfileStatus')}</CardTitle>
        <Search className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {profile ? (
          <div>
            <p className="text-2xl font-bold text-foreground">{profile.name}</p>
            <p className="text-xs text-muted-foreground">
              {t('dashboardHome.profile.active', { name: profile.name })}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {profile.desiredTechnologies.slice(0, 5).map(tech => (
                <span key={tech} className="rounded-full bg-muted px-2 py-0.5 text-xs">{tech}</span>
              ))}
            </div>
            <Link href="/app/search-profiles">
              <Button variant="ghost" size="sm" className="mt-2 px-0">
                {t('dashboardHome.resume.viewAll')}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{t('dashboardHome.profile.noProfile')}</p>
            <Link href="/app/search-profiles">
              <Button size="sm" className="mt-2">
                <Plus className="mr-2 h-3 w-3" />
                {t('dashboardHome.profile.createCta')}
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
