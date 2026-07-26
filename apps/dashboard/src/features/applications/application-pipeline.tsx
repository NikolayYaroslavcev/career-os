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
import { Loading } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { ApplicationDetail } from './application-detail';

const STATUS_VARIANT: Record<ApplicationStatus, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
  saved: 'secondary',
  started: 'default',
  submitted: 'default',
  waiting: 'warning',
  hr_interview: 'warning',
  technical_interview: 'warning',
  final_interview: 'warning',
  offer: 'success',
  rejected: 'destructive',
  archived: 'secondary',
};

function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ApplicationPipeline(): React.JSX.Element {
  const { t } = useTranslation();
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
        <p className="text-sm text-muted-foreground">{t('applications.subtitle', { count: totalApplications })}</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="text-xs font-medium underline underline-offset-2 hover:no-underline">
              {t('common.dismiss')}
            </button>
          </AlertDescription>
        </Alert>
      )}

      {totalApplications === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">{t('applications.empty')}</CardContent>
        </Card>
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

  const timestamp = application.submittedAt
    ? `Submitted ${formatDate(application.submittedAt)}`
    : application.startedAt
      ? `Started ${formatDate(application.startedAt)}`
      : `Saved ${formatDate(application.createdAt)}`;

  return (
    <Card>
      <CardContent className="space-y-2 py-3">
        <button
          type="button"
          onClick={onSelect}
          className="block w-full text-left text-sm font-medium text-foreground hover:text-primary"
        >
          {vacancy?.title ?? t('applications.unknownVacancy')}
        </button>
        {vacancy?.company && <p className="text-xs text-muted-foreground">{vacancy.company.name}</p>}
        <p className="text-xs text-muted-foreground">{timestamp}</p>
        {application.coolingDown && (
          <Badge variant="warning" className="text-xs">
            {t('applications.coolingDown')}
          </Badge>
        )}
        <div className="flex items-center justify-between">
          <Badge variant={STATUS_VARIANT[application.status]} className="text-xs">
            {t(`applications.statuses.${application.status}`)}
          </Badge>
          <select
            aria-label={t('applications.moveToAria')}
            className="rounded-lg border border-input bg-transparent px-2.5 py-1 text-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                onStatusChange(e.target.value as ApplicationStatus);
              }
            }}
          >
            <option value="">{t('applications.moveTo')}</option>
            {APPLICATION_STATUSES.filter((s) => s !== application.status).map((s) => (
              <option key={s} value={s}>
                {t(`applications.statuses.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </CardContent>
    </Card>
  );
}
