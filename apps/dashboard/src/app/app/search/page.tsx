'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { listVacancies, type VacancySummary, type VacancyListParams } from '@/api/sync';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ExternalLink, MapPin, DollarSign, Building2, Clock, Filter } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { pluralize } from '@/lib/i18n/pluralize';
import { formatDate, formatNumber } from '@/lib/format';

const ALL_FILTER_VALUE = '__all__';

const SOURCE_LABELS: Record<string, string> = {
  remotive: 'Remotive',
  arbeitnow: 'Arbeitnow',
  jobicy: 'Jobicy',
  we_work_remotely: 'We Work Remotely',
  working_nomads: 'Working Nomads',
  nodesk: 'NoDesk',
  hn_hiring: 'HN Who Is Hiring',
  hh: 'HeadHunter',
  habr_career: 'Habr Career',
  telegram: 'Telegram',
  pyjobs: 'PyJobs',
  django_jobs: 'Django Jobs',
  speedrun: 'a16z Speedrun',
  france_travail: 'France Travail',
};

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
        <Badge variant="secondary">
          {t('searchPage.jobsCount', {
            count: total,
            unit: pluralize(locale, total, { one: t('searchPage.jobsUnit.one'), few: t('searchPage.jobsUnit.few'), many: t('searchPage.jobsUnit.many') }),
          })}
        </Badge>
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
                <Select
                  value={params.remote ?? ALL_FILTER_VALUE}
                  onValueChange={(value) => handleFilterChange('remote', !value || value === ALL_FILTER_VALUE ? '' : value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string) => {
                        if (value === 'remote') return t('searchPage.remote');
                        if (value === 'hybrid') return t('searchPage.hybrid');
                        if (value === 'onsite') return t('searchPage.onsite');
                        return t('searchPage.any');
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER_VALUE}>{t('searchPage.any')}</SelectItem>
                    <SelectItem value="remote">{t('searchPage.remote')}</SelectItem>
                    <SelectItem value="hybrid">{t('searchPage.hybrid')}</SelectItem>
                    <SelectItem value="onsite">{t('searchPage.onsite')}</SelectItem>
                  </SelectContent>
                </Select>
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
                <Select
                  value={params.source ?? ALL_FILTER_VALUE}
                  onValueChange={(value) => handleFilterChange('source', !value || value === ALL_FILTER_VALUE ? '' : value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string) => SOURCE_LABELS[value] ?? t('searchPage.allProviders')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER_VALUE}>{t('searchPage.allProviders')}</SelectItem>
                    <SelectItem value="remotive">Remotive</SelectItem>
                    <SelectItem value="arbeitnow">Arbeitnow</SelectItem>
                    <SelectItem value="jobicy">Jobicy</SelectItem>
                    <SelectItem value="we_work_remotely">We Work Remotely</SelectItem>
                    <SelectItem value="working_nomads">Working Nomads</SelectItem>
                    <SelectItem value="nodesk">NoDesk</SelectItem>
                    <SelectItem value="hn_hiring">HN Who Is Hiring</SelectItem>
                    <SelectItem value="hh">HeadHunter</SelectItem>
                    <SelectItem value="habr_career">Habr Career</SelectItem>
                    <SelectItem value="telegram">Telegram</SelectItem>
                    <SelectItem value="pyjobs">PyJobs</SelectItem>
                    <SelectItem value="django_jobs">Django Jobs</SelectItem>
                    <SelectItem value="speedrun">a16z Speedrun</SelectItem>
                    <SelectItem value="france_travail">France Travail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t('searchPage.sortBy')}</label>
                <Select
                  value={params.sortBy ?? 'newest'}
                  onValueChange={(value) => handleFilterChange('sortBy', value ?? 'newest')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string) => {
                        if (value === 'salary') return t('searchPage.sortSalary');
                        if (value === 'company') return t('searchPage.sortCompany');
                        if (value === 'title') return t('searchPage.sortTitle');
                        return t('searchPage.sortNewest');
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">{t('searchPage.sortNewest')}</SelectItem>
                    <SelectItem value="salary">{t('searchPage.sortSalary')}</SelectItem>
                    <SelectItem value="company">{t('searchPage.sortCompany')}</SelectItem>
                    <SelectItem value="title">{t('searchPage.sortTitle')}</SelectItem>
                  </SelectContent>
                </Select>
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
