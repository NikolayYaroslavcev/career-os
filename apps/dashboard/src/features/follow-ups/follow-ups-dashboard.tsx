'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  listFollowUpBuckets,
  createFollowUp,
  completeFollowUpById,
  type EnrichedFollowUp,
  type FollowUpBuckets,
} from '@/api/follow-ups';
import { listApplications, type Application, type FollowUpType } from '@/api/applications';
import { getVacancyDetail, type VacancyDetail } from '@/api/sync';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, ExternalLink } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { pluralize } from '@/lib/i18n/pluralize';

type FilterKey = 'all' | 'overdue' | 'today' | 'upcoming' | 'completed';
const FILTERS: readonly FilterKey[] = ['all', 'overdue', 'today', 'upcoming', 'completed'];
const SECTION_KEYS: readonly Exclude<FilterKey, 'all'>[] = ['overdue', 'today', 'upcoming', 'completed'];

const TYPE_OPTIONS: readonly FollowUpType[] = ['follow_up', 'interview', 'reply_expected', 'custom'];

const EMPTY_BUCKETS: FollowUpBuckets = { overdue: [], today: [], upcoming: [], completed: [] };

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function applicationLabel(
  application: Application | undefined,
  vacanciesById: Record<string, VacancyDetail>,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (!application) return '';
  const vacancy = vacanciesById[application.vacancyId];
  const title = vacancy?.title ?? t('applications.unknownVacancy');
  const status = t(`applications.statuses.${application.status}`);
  return vacancy?.company?.name ? `${title} — ${vacancy.company.name} (${status})` : `${title} (${status})`;
}

export function FollowUpsDashboard(): React.JSX.Element {
  const { t, locale } = useTranslation();
  const [buckets, setBuckets] = useState<FollowUpBuckets>(EMPTY_BUCKETS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [completingId, setCompletingId] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [applicationId, setApplicationId] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<FollowUpType>('custom');
  const [message, setMessage] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [applications, setApplications] = useState<Application[]>([]);
  const [vacanciesById, setVacanciesById] = useState<Record<string, VacancyDetail>>({});
  const [hasLoadedApplications, setHasLoadedApplications] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      const data = await listFollowUpBuckets();
      setBuckets(data);
    } catch (err) {
      console.error('Failed to load follow-ups:', err);
      setError(t('followUpsPage.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  // This data only feeds the "create manual follow-up" form below, which is
  // hidden by default — deferred until it's actually opened (once per mount)
  // instead of fetching every application's vacancy detail on every dashboard
  // visit whether or not the form is ever used.
  useEffect(() => {
    if (!showCreateForm || hasLoadedApplications) return;
    setHasLoadedApplications(true);

    let cancelled = false;
    listApplications()
      .then(async ({ applications: apps }) => {
        if (cancelled) return;
        setApplications(apps);
        const uniqueVacancyIds = [...new Set(apps.map((application) => application.vacancyId))];
        const fetched = await Promise.all(
          uniqueVacancyIds.map((vacancyId) => getVacancyDetail(vacancyId).catch(() => null)),
        );
        if (cancelled) return;
        const next: Record<string, VacancyDetail> = {};
        fetched.forEach((vacancy, index) => {
          if (vacancy) next[uniqueVacancyIds[index] as string] = vacancy;
        });
        setVacanciesById(next);
      })
      .catch(() => {
        if (!cancelled) setApplications([]);
      });
    return (): void => {
      cancelled = true;
    };
  }, [showCreateForm, hasLoadedApplications]);

  const handleComplete = async (id: string): Promise<void> => {
    setCompletingId(id);
    try {
      await completeFollowUpById(id);
      await load();
    } catch (err) {
      console.error('Failed to complete follow-up:', err);
      setError(err instanceof Error ? err.message : t('followUpsPage.actionFailed'));
    } finally {
      setCompletingId(null);
    }
  };

  const handleCreate = async (): Promise<void> => {
    if (!applicationId || !date) return;
    setIsCreating(true);
    try {
      await createFollowUp({
        applicationId,
        date: new Date(date).toISOString(),
        message: message.trim() || undefined,
        type,
      });
      setApplicationId('');
      setDate('');
      setMessage('');
      setType('custom');
      setShowCreateForm(false);
      await load();
    } catch (err) {
      console.error('Failed to create follow-up:', err);
      setError(err instanceof Error ? err.message : t('followUpsPage.actionFailed'));
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return <Loading text={t('followUpsPage.loading')} />;
  }

  const total = SECTION_KEYS.reduce((sum, key) => sum + buckets[key].length, 0);
  const visibleSections = filter === 'all' ? SECTION_KEYS : [filter];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t('followUpsPage.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('followUpsPage.subtitle')}</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{error}</span>
            <Button type="button" variant="link" size="xs" className="h-auto px-0" onClick={() => setError(null)}>
              {t('common.dismiss')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((key) => (
            <Button
              key={key}
              size="sm"
              variant={filter === key ? 'default' : 'outline'}
              onClick={() => setFilter(key)}
            >
              {t(`followUpsPage.filters.${key}`)}
              {key !== 'all' && <Badge variant="secondary" className="ml-1">{buckets[key].length}</Badge>}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowCreateForm((v) => !v)}>
          {t('followUpsPage.createManual')}
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>{t('followUpsPage.createManualTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t('followUpsPage.applicationLabel')}</p>
              <Select value={applicationId || undefined} onValueChange={(value) => setApplicationId(value ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('followUpsPage.applicationPlaceholder')}>
                    {(value: string) => applicationLabel(applications.find((a) => a.id === value), vacanciesById, t)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {applications.map((application) => (
                    <SelectItem key={application.id} value={application.id}>
                      {applicationLabel(application, vacanciesById, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {applications.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">{t('followUpsPage.noApplications')}</p>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t('followUpsPage.dateLabel')}</p>
              <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t('followUpsPage.typeLabel')}</p>
              <Select value={type} onValueChange={(value) => value && setType(value as FollowUpType)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: FollowUpType) => t(`followUpsPage.types.${value}`)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`followUpsPage.types.${option}`)}
                  </SelectItem>
                ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t('followUpsPage.messageLabel')}</p>
              <Input value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <Button onClick={handleCreate} disabled={isCreating || !applicationId || !date}>
              {t('followUpsPage.create')}
            </Button>
          </CardContent>
        </Card>
      )}

      {total === 0 && filter === 'all' ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">{t('followUpsPage.emptyAll')}</CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {visibleSections.map((section) => (
            <FollowUpSection
              key={section}
              titleKey={section}
              items={buckets[section]}
              locale={locale}
              onComplete={handleComplete}
              completingId={completingId}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FollowUpSectionProps {
  titleKey: Exclude<FilterKey, 'all'>;
  items: EnrichedFollowUp[];
  locale: string;
  onComplete: (id: string) => void;
  completingId: string | null;
  t: ReturnType<typeof useTranslation>['t'];
}

function FollowUpSection({ titleKey, items, locale, onComplete, completingId, t }: FollowUpSectionProps): React.JSX.Element {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{t(`followUpsPage.sections.${titleKey}`)}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('followUpsPage.empty')}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <FollowUpCard
              key={item.id}
              item={item}
              locale={locale}
              showComplete={titleKey !== 'completed'}
              onComplete={onComplete}
              isCompleting={completingId === item.id}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FollowUpCardProps {
  item: EnrichedFollowUp;
  locale: string;
  showComplete: boolean;
  onComplete: (id: string) => void;
  isCompleting: boolean;
  t: ReturnType<typeof useTranslation>['t'];
}

function FollowUpCard({ item, locale, showComplete, onComplete, isCompleting, t }: FollowUpCardProps): React.JSX.Element {
  const isInterview = item.type === 'interview';
  const recommendedAction = isInterview ? t('followUpsPage.actionInterviewReminder') : t('followUpsPage.actionSendFollowUp');

  return (
    <Card>
      <CardContent className="space-y-1.5 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-foreground">{item.companyName}</p>
            <p className="text-sm text-muted-foreground">{item.vacancyTitle}</p>
          </div>
          {item.type && <Badge variant={isInterview ? 'warning' : 'secondary'}>{t(`followUpsPage.types.${item.type}`)}</Badge>}
        </div>

        {item.daysSinceApplied !== null && (
          <p className="text-xs text-muted-foreground">
            {item.daysSinceApplied === 1
              ? t('followUpsPage.appliedOneDayAgo')
              : t('followUpsPage.appliedDaysAgo', {
                  count: item.daysSinceApplied,
                  unit: pluralize(locale, item.daysSinceApplied, { one: t('followUpsPage.daysUnit.one'), few: t('followUpsPage.daysUnit.few'), many: t('followUpsPage.daysUnit.many') }),
                })}
          </p>
        )}

        <p className="text-xs text-muted-foreground">{formatDate(item.scheduledAt, locale)}</p>

        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{t('followUpsPage.recommendedAction')}:</span> {recommendedAction}
        </p>

        {item.message && <p className="text-xs text-muted-foreground">{item.message}</p>}

        <div className="flex items-center gap-2 pt-1">
          <Link href={`/app/applications?open=${item.applicationId}`}>
            <Button size="sm" variant="outline">
              <ExternalLink />
              {t('followUpsPage.openApplication')}
            </Button>
          </Link>
          {showComplete && (
            <Button size="sm" variant="ghost" onClick={() => onComplete(item.id)} disabled={isCompleting}>
              <CheckCircle />
              {t('followUpsPage.complete')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
