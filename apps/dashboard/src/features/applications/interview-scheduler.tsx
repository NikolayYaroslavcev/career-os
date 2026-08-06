'use client';

import { useState, useEffect, useCallback } from 'react';
import { listInterviews, scheduleInterview, type Interview } from '@/api/applications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Calendar, CheckCircle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { formatDateTime } from '@/lib/format';

interface InterviewSchedulerProps {
  readonly applicationId: string;
}

const INTERVIEW_TYPES: Interview['type'][] = [
  'hr', 'technical', 'system_design', 'behavioral', 'coding', 'cultural', 'final',
];

export function InterviewScheduler({ applicationId }: InterviewSchedulerProps): React.JSX.Element {
  const { t, locale } = useTranslation();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScheduling, setIsScheduling] = useState(false);
  const [newType, setNewType] = useState<Interview['type']>('hr');
  const [newDate, setNewDate] = useState('');
  const [newDuration, setNewDuration] = useState('60');
  const [newInterviewerName, setNewInterviewerName] = useState('');
  const [newInterviewerEmail, setNewInterviewerEmail] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const fetchInterviews = useCallback(async (): Promise<void> => {
    try {
      const data = await listInterviews(applicationId);
      setInterviews(data.interviews);
    } catch (error) {
      console.error('Failed to load interviews:', error);
    } finally {
      setIsLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    fetchInterviews();
  }, [fetchInterviews]);

  const handleSchedule = async (): Promise<void> => {
    if (!newDate) return;
    setIsScheduling(true);
    try {
      await scheduleInterview(applicationId, {
        type: newType,
        scheduledAt: new Date(newDate).toISOString(),
        durationMinutes: parseInt(newDuration, 10) || 60,
        interviewerName: newInterviewerName.trim() || undefined,
        interviewerEmail: newInterviewerEmail.trim() || undefined,
        notes: newNotes.trim() || undefined,
      });
      setNewDate('');
      setNewInterviewerName('');
      setNewInterviewerEmail('');
      setNewNotes('');
      await fetchInterviews();
    } catch (error) {
      console.error('Failed to schedule interview:', error);
    } finally {
      setIsScheduling(false);
    }
  };

  if (isLoading) return <Loading />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('interviewScheduler.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Select value={newType} onValueChange={(value) => value && setNewType(value as Interview['type'])}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: Interview['type']) => t(`interviewScheduler.types.${value}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
              {INTERVIEW_TYPES.map((type) => (
                <SelectItem key={type} value={type}>{t(`interviewScheduler.types.${type}`)}</SelectItem>
              ))}
              </SelectContent>
            </Select>
            <Input
              type="datetime-local"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              placeholder={t('interviewScheduler.durationPlaceholder')}
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
            />
            <Input
              placeholder={t('interviewScheduler.interviewerNamePlaceholder')}
              value={newInterviewerName}
              onChange={(e) => setNewInterviewerName(e.target.value)}
            />
          </div>
          <Input
            placeholder={t('interviewScheduler.interviewerEmailPlaceholder')}
            value={newInterviewerEmail}
            onChange={(e) => setNewInterviewerEmail(e.target.value)}
          />
          <div className="flex gap-2">
            <Input
              placeholder={t('interviewScheduler.notesPlaceholder')}
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleSchedule} disabled={isScheduling || !newDate} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {interviews.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t('interviewScheduler.empty')}</p>
          ) : (
            <div className="space-y-3">
              {interviews.map((interview) => (
                <div
                  key={interview.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border"
                >
                  {interview.isCompleted ? (
                    <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <Calendar className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={interview.isCompleted ? 'secondary' : 'default'}>
                        {t(`interviewScheduler.types.${interview.type}`)}
                      </Badge>
                      {interview.isCompleted && (
                        <Badge variant="success">{t('interviewScheduler.completed')}</Badge>
                      )}
                    </div>
                    {interview.scheduledAt && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatDateTime(interview.scheduledAt, locale)}
                        {interview.durationMinutes && ` (${t('interviewScheduler.minutesSuffix', { count: interview.durationMinutes })})`}
                      </p>
                    )}
                    {interview.interviewerName && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('interviewScheduler.with', { name: interview.interviewerName })}
                        {interview.interviewerEmail && ` (${interview.interviewerEmail})`}
                      </p>
                    )}
                    {interview.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{interview.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
