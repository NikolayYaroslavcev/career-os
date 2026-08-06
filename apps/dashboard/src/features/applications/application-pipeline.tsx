'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getPipeline,
  updateApplicationStatus,
  APPLICATION_STATUSES,
  type Application,
  type ApplicationStatus,
  type PipelineGroup,
} from '@/api/applications';
import { getVacancyDetail, type VacancyDetail } from '@/api/sync';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/empty-state';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { pluralize } from '@/lib/i18n/pluralize';
import { APPLICATION_STATUS_VARIANT } from '@/lib/application-status';
import { ApplicationDetail } from './application-detail';
import { KanbanSquare } from 'lucide-react';

function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ApplicationPipeline(): React.JSX.Element {
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();
  const [pipeline, setPipeline] = useState<PipelineGroup[]>([]);
  const [vacanciesById, setVacanciesById] = useState<Record<string, VacancyDetail>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Deep-linked from /app/follow-ups ("Open Application" -> /app/applications?open=<id>).
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(() => searchParams.get('open'));

  const fetchPipeline = useCallback(async (): Promise<void> => {
    try {
      const data = await getPipeline();
      setPipeline(data.pipeline);

      const allApplications = data.pipeline.flatMap((group) => group.applications);
      const uniqueVacancyIds = [...new Set(allApplications.map((a) => a.vacancyId))];

      const fetched = await Promise.all(
        uniqueVacancyIds.map(async (id) => {
          try {
            return await getVacancyDetail(id);
          } catch {
            return null;
          }
        })
      );

      const next: Record<string, VacancyDetail> = {};
      fetched.forEach((vacancy, index) => {
        if (vacancy) {
          next[uniqueVacancyIds[index] as string] = vacancy;
        }
      });
      setVacanciesById(next);
    } catch (err) {
      console.error('Failed to fetch pipeline:', err);
      setError(t('applications.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  const totalApplications = useMemo(
    () => pipeline.reduce((sum, group) => sum + group.count, 0),
    [pipeline]
  );

  const handleStatusChange = async (application: Application, status: ApplicationStatus): Promise<void> => {
    try {
      await updateApplicationStatus(application.id, status);
      await fetchPipeline();
    } catch (err) {
      console.error('Failed to change status:', err);
      setError(err instanceof Error ? err.message : t('applications.statusChangeFailed'));
    }
  };

  if (isLoading) {
    return <Loading text={t('applications.loading')} />;
  }

  const selectedApplication = selectedApplicationId
    ? pipeline.flatMap((g) => g.applications).find((a) => a.id === selectedApplicationId) ?? null
    : null;

  if (selectedApplicationId && selectedApplication) {
    return (
      <ApplicationDetail
        applicationId={selectedApplicationId}
        vacancy={vacanciesById[selectedApplication.vacancyId] ?? null}
        onBack={() => setSelectedApplicationId(null)}
        onChanged={fetchPipeline}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t('applications.title')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('applications.subtitle', {
            count: totalApplications,
            unit: pluralize(locale, totalApplications, { one: t('applications.unit.one'), few: t('applications.unit.few'), many: t('applications.unit.many') }),
          })}
        </p>
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

      {totalApplications === 0 ? (
        <EmptyState
          icon={KanbanSquare}
          title={t('applications.emptyTitle')}
          description={t('applications.emptyDesc')}
          action={{ label: t('applications.emptyCta'), href: '/app/search' }}
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {APPLICATION_STATUSES.map((status) => {
            const group = pipeline.find((g) => g.status === status) ?? { status, count: 0, applications: [] };
            return (
              <div key={status} className="w-72 flex-shrink-0">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {t(`applications.statuses.${status}`)}
                  </h3>
                  <Badge variant="secondary">{group.count}</Badge>
                </div>
                <div className="space-y-2">
                  {group.applications.map((application) => (
                    <ApplicationCard
                      key={application.id}
                      application={application}
                      vacancy={vacanciesById[application.vacancyId] ?? null}
                      onSelect={() => setSelectedApplicationId(application.id)}
                      onStatusChange={(status) => handleStatusChange(application, status)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ApplicationCardProps {
  application: Application;
  vacancy: VacancyDetail | null;
  onSelect: () => void;
  onStatusChange: (status: ApplicationStatus) => void;
}

function ApplicationCard({ application, vacancy, onSelect, onStatusChange }: ApplicationCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const [nextStatus, setNextStatus] = useState<ApplicationStatus | undefined>(undefined);

  const timestamp = application.submittedAt
    ? t('applications.submittedOn', { date: formatDate(application.submittedAt) })
    : application.startedAt
      ? t('applications.startedOn', { date: formatDate(application.startedAt) })
      : t('applications.savedOn', { date: formatDate(application.createdAt) });

  return (
    <Card>
      <CardContent className="space-y-2 py-3">
        <Button
          type="button"
          onClick={onSelect}
          variant="link"
          className="h-auto w-full justify-start px-0 text-left text-sm font-medium text-foreground no-underline hover:text-primary hover:no-underline"
        >
          {vacancy?.title ?? t('applications.unknownVacancy')}
        </Button>
        {vacancy?.company && <p className="text-xs text-muted-foreground">{vacancy.company.name}</p>}
        <p className="text-xs text-muted-foreground">{timestamp}</p>
        {application.coolingDown && (
          <Badge variant="warning" className="text-xs">
            {t('applications.coolingDown')}
          </Badge>
        )}
        <div className="flex items-center justify-between">
          <Badge variant={APPLICATION_STATUS_VARIANT[application.status]} className="text-xs">
            {t(`applications.statuses.${application.status}`)}
          </Badge>
          <Select
            value={nextStatus}
            onValueChange={(value) => {
              if (!value) return;
              setNextStatus(undefined);
              onStatusChange(value as ApplicationStatus);
            }}
          >
            <SelectTrigger aria-label={t('applications.moveToAria')} className="h-7 w-auto text-xs" size="sm">
              <SelectValue placeholder={t('applications.moveTo')}>
                {(value: ApplicationStatus | undefined) => (value ? t(`applications.statuses.${value}`) : t('applications.moveTo'))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
            {APPLICATION_STATUSES.filter((s) => s !== application.status).map((s) => (
              <SelectItem key={s} value={s}>
                {t(`applications.statuses.${s}`)}
              </SelectItem>
            ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
