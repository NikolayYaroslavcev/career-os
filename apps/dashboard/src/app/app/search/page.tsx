'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { listVacancies, type VacancySummary, type VacancyListParams } from '@/api/sync';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { Search, ExternalLink, MapPin, DollarSign, Building2, Clock, Filter } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { formatDate, formatNumber } from '@/lib/format';

export default function SearchPage(): React.JSX.Element {
  const { t, locale } = useTranslation();
  const [vacancies, setVacancies] = useState<VacancySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [params, setParams] = useState<VacancyListParams>({
    query: '',
    limit: 20,
    offset: 0,
    sortBy: 'newest',
    sortOrder: 'desc',
  });

  const fetchVacancies = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const data = await listVacancies(params);
      setVacancies(data.vacancies);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to fetch vacancies:', error);
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchVacancies();
  }, [fetchVacancies]);

  const handleSearch = (query: string): void => {
    setParams((prev) => ({ ...prev, query, offset: 0 }));
  };

  const handleFilterChange = (key: string, value: string): void => {
    setParams((prev) => ({ ...prev, [key]: value || undefined, offset: 0 }));
  };

  const handlePageChange = (newOffset: number): void => {
    setParams((prev) => ({ ...prev, offset: newOffset }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('searchPage.title')}</h1>
        <Badge variant="secondary">{t('searchPage.jobsCount', { count: total })}</Badge>
      </div>

      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchPage.searchPlaceholder')}
            value={params.query ?? ''}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="mr-2 h-4 w-4" />
          {t('searchPage.filters')}
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t('searchPage.location')}</label>
                <Input
                  placeholder={t('searchPage.locationPlaceholder')}
                  value={params.location ?? ''}
                  onChange={(e) => handleFilterChange('location', e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t('searchPage.remote')}</label>
                <select
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={params.remote ?? ''}
                  onChange={(e) => handleFilterChange('remote', e.target.value)}
                >
                  <option value="">{t('searchPage.any')}</option>
                  <option value="remote">{t('searchPage.remote')}</option>
                  <option value="hybrid">{t('searchPage.hybrid')}</option>
                  <option value="onsite">{t('searchPage.onsite')}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t('searchPage.minSalary')}</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={params.salaryMin ?? ''}
                  onChange={(e) => handleFilterChange('salaryMin', e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t('searchPage.maxSalary')}</label>
                <Input
                  type="number"
                  placeholder="999999"
                  value={params.salaryMax ?? ''}
                  onChange={(e) => handleFilterChange('salaryMax', e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t('searchPage.company')}</label>
                <Input
                  placeholder={t('searchPage.companyPlaceholder')}
                  value={params.company ?? ''}
                  onChange={(e) => handleFilterChange('company', e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t('searchPage.source')}</label>
                <select
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={params.source ?? ''}
                  onChange={(e) => handleFilterChange('source', e.target.value)}
                >
                  <option value="">{t('searchPage.allProviders')}</option>
                  <option value="remote_ok">RemoteOK</option>
                  <option value="remotive">Remotive</option>
                  <option value="himalayas">Himalayas</option>
                  <option value="arbeitnow">Arbeitnow</option>
                  <option value="jobicy">Jobicy</option>
                  <option value="we_work_remotely">We Work Remotely</option>
                  <option value="working_nomads">Working Nomads</option>
                  <option value="nodesk">NoDesk</option>
                  <option value="hn_hiring">HN Who Is Hiring</option>
                  <option value="hh">HeadHunter</option>
                  <option value="habr_career">Habr Career</option>
                  <option value="telegram">Telegram</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t('searchPage.sortBy')}</label>
                <select
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={params.sortBy ?? 'newest'}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                >
                  <option value="newest">{t('searchPage.sortNewest')}</option>
                  <option value="salary">{t('searchPage.sortSalary')}</option>
                  <option value="company">{t('searchPage.sortCompany')}</option>
                  <option value="title">{t('searchPage.sortTitle')}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t('searchPage.technology')}</label>
                <Input
                  placeholder={t('searchPage.technologyPlaceholder')}
                  value={params.technology ?? ''}
                  onChange={(e) => handleFilterChange('technology', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {isLoading ? (
        <Loading />
      ) : vacancies.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('searchPage.empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {vacancies.map((vacancy) => (
            <Link key={vacancy.id} href={`/app/search/${vacancy.id}`}>
              <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground">{vacancy.title}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {vacancy.company}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {vacancy.location}
                        </span>
                        {vacancy.salaryMin && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5" />
                            ${formatNumber(vacancy.salaryMin, locale)} - ${vacancy.salaryMax !== undefined && vacancy.salaryMax !== null ? formatNumber(vacancy.salaryMax, locale) : 'N/A'}
                          </span>
                        )}
                        {vacancy.publishedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDate(vacancy.publishedAt, locale)}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-xs">{vacancy.remote}</Badge>
                        {vacancy.source && <Badge variant="outline" className="text-xs">{vacancy.source}</Badge>}
                        {vacancy.technologies.slice(0, 5).map((tech) => (
                          <Badge key={tech} variant="secondary" className="text-xs">{tech}</Badge>
                        ))}
                      </div>
                    </div>
                    {vacancy.url && (
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > (params.limit ?? 20) && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={(params.offset ?? 0) === 0}
            onClick={() => handlePageChange(Math.max(0, (params.offset ?? 0) - (params.limit ?? 20)))}
          >
            {t('searchPage.previous')}
          </Button>
          <span className="flex items-center px-4 text-sm text-muted-foreground">
            {t('searchPage.rangeOf', {
              from: (params.offset ?? 0) + 1,
              to: Math.min((params.offset ?? 0) + (params.limit ?? 20), total),
              total,
            })}
          </span>
          <Button
            variant="outline"
            disabled={(params.offset ?? 0) + (params.limit ?? 20) >= total}
            onClick={() => handlePageChange((params.offset ?? 0) + (params.limit ?? 20))}
          >
            {t('searchPage.next')}
          </Button>
        </div>
      )}
    </div>
  );
}
