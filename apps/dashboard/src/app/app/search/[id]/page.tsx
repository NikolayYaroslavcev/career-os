'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getVacancyDetail, type VacancyDetail } from '@/api/sync';
import { createApplication } from '@/api/applications';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { ArrowLeft, ExternalLink, MapPin, DollarSign, Building2, Clock, FileText } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { formatDate, formatNumber } from '@/lib/format';
import { AiActionsPanel } from '@/features/ai-panel/ai-actions-panel';
import { useVacancyInteraction } from '@/hooks/use-vacancy-interaction';

export default function JobDetailPage(): React.JSX.Element {
  const { t, locale } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const [vacancy, setVacancy] = useState<VacancyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingApplication, setIsCreatingApplication] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vacancyId = (params.id as string) ?? null;
  const { recordSave } = useVacancyInteraction({
    vacancyId,
    recordViewOnMount: true,
  });

  useEffect(() => {
    async function fetchVacancy(): Promise<void> {
      try {
        const vacancyData = await getVacancyDetail(params.id as string);
        setVacancy(vacancyData);
      } catch (error) {
        console.error('Failed to fetch vacancy:', error);
      } finally {
        setIsLoading(false);
      }
    }
    if (params.id) fetchVacancy();
  }, [params.id]);

  const handleApply = async (): Promise<void> => {
    if (!params.id) return;
    setIsCreatingApplication(true);
    setError(null);
    try {
      await createApplication({ vacancyId: params.id as string });
      recordSave(params.id as string);
      router.push('/app/applications');
    } catch (err) {
      console.error('Failed to create application:', err);
      setError(err instanceof Error ? err.message : t('jobDetailPage.applyFailed'));
    } finally {
      setIsCreatingApplication(false);
    }
  };

  if (isLoading) return <Loading />;
  if (!vacancy) return <div className="text-center py-8 text-muted-foreground">{t('jobDetailPage.notFound')}</div>;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t('jobDetailPage.back')}
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{vacancy.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-muted-foreground">
            <span className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              {vacancy.company?.name ?? t('jobDetailPage.unknownCompany')}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {vacancy.location}
            </span>
            {vacancy.salaryMin && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                ${formatNumber(vacancy.salaryMin, locale)} - ${vacancy.salaryMax !== undefined && vacancy.salaryMax !== null ? formatNumber(vacancy.salaryMax, locale) : 'N/A'} {vacancy.currency ?? 'USD'}
              </span>
            )}
            {vacancy.publishedAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDate(vacancy.publishedAt, locale)}
              </span>
            )}
          </div>
        </div>
        {vacancy.url && (
          <a href={vacancy.url} target="_blank" rel="noopener noreferrer">
            <Button>
              <ExternalLink className="mr-2 h-4 w-4" />
              {t('jobDetailPage.applyToTrack')}
            </Button>
          </a>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{vacancy.remote}</Badge>
        {vacancy.source && <Badge variant="outline">{vacancy.source}</Badge>}
        {vacancy.experienceLevel && <Badge variant="outline">{vacancy.experienceLevel}</Badge>}
        {vacancy.technologies.map((tech) => (
          <Badge key={tech} variant="secondary">{tech}</Badge>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('jobDetailPage.actions')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            variant="outline"
            onClick={handleApply}
            disabled={isCreatingApplication}
          >
            <FileText className="mr-2 h-4 w-4" />
            {isCreatingApplication ? t('jobDetailPage.creatingApplication') : t('jobDetailPage.applyToTrack')}
          </Button>
        </CardContent>
      </Card>

      <AiActionsPanel vacancyId={vacancy.id} vacancyTitle={vacancy.title} />

      <Card>
        <CardHeader>
          <CardTitle>{t('jobDetailPage.description')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap">
            {vacancy.description}
          </div>
        </CardContent>
      </Card>

      {vacancy.requirements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('jobDetailPage.requirements')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5">
              {vacancy.requirements.map((req, i) => (
                <li key={i} className="text-sm text-foreground">{req}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {vacancy.company && (
        <Card>
          <CardHeader>
            <CardTitle>{t('jobDetailPage.company')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm"><span className="font-medium">{t('jobDetailPage.name')}</span> {vacancy.company.name}</p>
              {vacancy.company.website && (
                <p className="text-sm">
                  <span className="font-medium">{t('jobDetailPage.website')}</span>{' '}
                  <a href={vacancy.company.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {vacancy.company.website}
                  </a>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
