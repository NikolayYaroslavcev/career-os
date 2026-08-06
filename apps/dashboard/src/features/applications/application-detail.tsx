'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  addApplicationNote,
  getApplication,
  listFollowUps,
  scheduleFollowUp,
  snoozeFollowUp,
  completeFollowUp,
  cancelFollowUp,
  updateApplicationStatus,
  type Application,
  type ApplicationStatus,
  type FollowUp,
} from '@/api/applications';
import type { VacancyDetail } from '@/api/sync';
import { ApplicationTimeline } from './application-timeline';
import { CommunicationLog } from './communication-log';
import { InterviewScheduler } from './interview-scheduler';
import { AiActionsPanel } from '@/features/ai-panel/ai-actions-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, ExternalLink, CheckCircle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { APPLICATION_STATUS_VARIANT } from '@/lib/application-status';

const FOLLOW_UP_VARIANT: Record<FollowUp['status'], 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
  pending: 'default',
  sent: 'secondary',
  completed: 'success',
  snoozed: 'warning',
  cancelled: 'destructive',
};

interface ApplicationDetailProps {
  applicationId: string;
  vacancy: VacancyDetail | null;
  onBack: () => void;
  onChanged: () => void;
}

export function ApplicationDetail({ applicationId, vacancy, onBack, onChanged }: ApplicationDetailProps): React.JSX.Element {
  const { t, locale } = useTranslation();
  const [application, setApplication] = useState<Application | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpMessage, setFollowUpMessage] = useState('');
  const [isSchedulingFollowUp, setIsSchedulingFollowUp] = useState(false);

  const fetchAll = useCallback(async (): Promise<void> => {
    try {
      const [app, followUpData] = await Promise.all([
        getApplication(applicationId),
        listFollowUps(applicationId),
      ]);
      setApplication(app);
      setFollowUps(followUpData.followUps);
    } catch (err) {
      console.error('Failed to load application detail:', err);
      setError(t('applications.detailLoadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [applicationId, t]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleAddNote = async (): Promise<void> => {
    if (!noteContent.trim()) return;
    setIsSubmittingNote(true);
    try {
      const updated = await addApplicationNote(applicationId, noteContent.trim());
      setApplication(updated);
      setNoteContent('');
    } catch (err) {
      console.error('Failed to add note:', err);
      setError(t('applications.noteFailed'));
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleScheduleFollowUp = async (): Promise<void> => {
    if (!followUpDate) return;
    setIsSchedulingFollowUp(true);
    try {
      const isoDate = new Date(followUpDate).toISOString();
      await scheduleFollowUp(applicationId, isoDate, followUpMessage.trim() || undefined);
      setFollowUpDate('');
      setFollowUpMessage('');
      await fetchAll();
    } catch (err) {
      console.error('Failed to schedule follow-up:', err);
      setError(err instanceof Error ? err.message : t('applications.followUpFailed'));
    } finally {
      setIsSchedulingFollowUp(false);
    }
  };

  const handleSnooze = async (followUpId: string): Promise<void> => {
    const days = window.prompt(t('applications.snoozeDaysPrompt'), '3');
    if (!days) return;
    const parsedDays = Number(days);
    if (!Number.isFinite(parsedDays) || parsedDays <= 0) return;

    const until = new Date(Date.now() + parsedDays * 24 * 60 * 60 * 1000).toISOString();
    try {
      await snoozeFollowUp(followUpId, until);
      await fetchAll();
    } catch (err) {
      console.error('Failed to snooze follow-up:', err);
      setError(t('applications.followUpFailed'));
    }
  };

  const handleComplete = async (followUpId: string): Promise<void> => {
    try {
      await completeFollowUp(followUpId);
      await fetchAll();
    } catch (err) {
      console.error('Failed to complete follow-up:', err);
      setError(t('applications.followUpFailed'));
    }
  };

  const handleCancel = async (followUpId: string): Promise<void> => {
    try {
      await cancelFollowUp(followUpId);
      await fetchAll();
    } catch (err) {
      console.error('Failed to cancel follow-up:', err);
      setError(t('applications.followUpFailed'));
    }
  };

  const handleOpenApplicationPage = (): void => {
    const url = vacancy?.applyUrl ?? vacancy?.url;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      setError(t('applications.noApplyUrl'));
    }
  };

  const handleConfirmSubmission = async (): Promise<void> => {
    try {
      await updateApplicationStatus(applicationId, 'submitted' as ApplicationStatus);
      await fetchAll();
      onChanged();
    } catch (err) {
      console.error('Failed to confirm submission:', err);
      setError(err instanceof Error ? err.message : t('applications.statusChangeFailed'));
    }
  };

  const handleBack = (): void => {
    onChanged();
    onBack();
  };

  if (isLoading) {
    return <Loading text={t('applications.loading')} />;
  }

  if (!application) {
    return (
      <div className="space-y-4">
        <BackButton onClick={handleBack} label={t('applications.backToPipeline')} />
        <p className="text-sm text-destructive">{t('applications.detailLoadFailed')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackButton onClick={handleBack} label={t('applications.backToPipeline')} />

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

      <Card>
        <CardHeader>
          <CardTitle>{vacancy?.title ?? t('applications.unknownVacancy')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {vacancy?.company && <p>{vacancy.company.name}</p>}
          {vacancy?.location && <p>{vacancy.location}</p>}
          <div className="flex items-center gap-2">
            <Badge variant={APPLICATION_STATUS_VARIANT[application.status]}>{t(`applications.statuses.${application.status}`)}</Badge>
            {application.startedAt && (
              <span className="text-xs">{t('applications.startedOn', { date: new Date(application.startedAt).toLocaleDateString(locale) })}</span>
            )}
            {application.submittedAt && (
              <span className="text-xs">{t('applications.submittedOn', { date: new Date(application.submittedAt).toLocaleDateString(locale) })}</span>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={handleOpenApplicationPage}>
              <ExternalLink className="mr-2 h-4 w-4" />
              {t('jobDetailPage.openApplicationPage' as never)}
            </Button>
            {(application.status === 'saved' || application.status === 'started') && (
              <Button size="sm" variant="outline" onClick={handleConfirmSubmission}>
                <CheckCircle className="mr-2 h-4 w-4" />
                {t('applications.confirmSubmission' as never)}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('applications.notes')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {application.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('applications.noNotes')}</p>
          ) : (
            <ul className="space-y-2">
              {application.notes.map((note, index) => (
                <li key={index} className="rounded-md bg-muted p-3 text-sm">
                  <p className="text-foreground">{note.content}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(note.createdAt).toLocaleString(locale)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input
              placeholder={t('applications.notePlaceholder')}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleAddNote} disabled={isSubmittingNote || !noteContent.trim()}>
              {t('applications.addNote')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('applications.followUps')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {followUps.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('applications.noFollowUps')}</p>
          ) : (
            <ul className="space-y-2">
              {followUps.map((followUp) => (
                <li key={followUp.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between">
                    <Badge variant={FOLLOW_UP_VARIANT[followUp.status]}>
                      {t(`applications.followUpStatuses.${followUp.status}`)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(followUp.scheduledAt).toLocaleString(locale)}
                    </span>
                  </div>
                  {followUp.message && <p className="mt-2 text-sm text-muted-foreground">{followUp.message}</p>}
                  {(followUp.status === 'pending' || followUp.status === 'snoozed') && (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleSnooze(followUp.id)}>
                        {t('applications.snooze')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleComplete(followUp.id)}>
                        {t('applications.markDone')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleCancel(followUp.id)}>
                        {t('applications.cancelFollowUp')}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-sm font-medium text-foreground">{t('applications.scheduleFollowUp')}</p>
            <Input
              type="datetime-local"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
            />
            <Input
              placeholder={t('applications.followUpMessagePlaceholder')}
              value={followUpMessage}
              onChange={(e) => setFollowUpMessage(e.target.value)}
            />
            <Button onClick={handleScheduleFollowUp} disabled={isSchedulingFollowUp || !followUpDate}>
              {t('applications.schedule')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CommunicationLog applicationId={applicationId} />
        <InterviewScheduler applicationId={applicationId} />
      </div>

      {vacancy && (
        <AiActionsPanel vacancyId={vacancy.id} vacancyTitle={vacancy.title} applicationId={applicationId} />
      )}

      <ApplicationTimeline application={application} followUps={followUps} />
    </div>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }): React.JSX.Element {
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      <ArrowLeft className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
