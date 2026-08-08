'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { getWatchedCompanies, type CompanyWatch } from '@/api/company-watch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Plus } from 'lucide-react';

export function CompanyWatchWidget(): React.JSX.Element {
  const { t } = useTranslation();
  const [companies, setCompanies] = useState<CompanyWatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getWatchedCompanies()
      .then(data => { if (!cancelled) setCompanies(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => {
      cancelled = true;
    };
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
        <CardTitle className="text-sm font-medium">{t('dashboardHome.sections.companyWatchSummary')}</CardTitle>
        <Building2 className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {companies.length > 0 ? (
          <div>
            <p className="text-2xl font-bold text-foreground">{companies.length}</p>
            <p className="text-xs text-muted-foreground">
              {t('dashboardHome.companyWatch.watching', { count: companies.length })}
            </p>
            <div className="mt-2 space-y-1">
              {companies.slice(0, 3).map(c => (
                <div key={c.id} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{c.name}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    c.healthStatus === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600' :
                    c.healthStatus === 'DEGRADED' ? 'bg-amber-500/10 text-amber-600' :
                    'bg-red-500/10 text-red-600'
                  }`}>
                    {c.healthStatus}
                  </span>
                </div>
              ))}
            </div>
            <Link href="/app/company-watch">
              <Button variant="ghost" size="sm" className="mt-2 px-0">
                {t('dashboardHome.resume.viewAll')}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{t('dashboardHome.companyWatch.notWatching')}</p>
            <Link href="/app/company-watch">
              <Button size="sm" className="mt-2">
                <Plus className="mr-2 h-3 w-3" />
                {t('dashboardHome.companyWatch.addCta')}
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
