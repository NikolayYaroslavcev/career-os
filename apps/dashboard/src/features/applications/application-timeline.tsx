'use client';

import { useMemo } from 'react';
import type { Application, FollowUp } from '@/api/applications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { formatDate, formatTime } from '@/lib/format';
import { type LucideIcon, Target, ClipboardList, StickyNote, CheckCircle2, Mail, Clock } from 'lucide-react';

interface TimelineEvent {
  readonly id: string;
  readonly timestamp: Date;
  readonly type: 'created' | 'status_change' | 'note' | 'follow_up' | 'interview';
  readonly title: string;
  readonly description?: string;
  readonly icon: LucideIcon;
}

interface ApplicationTimelineProps {
  readonly application: Application;
  readonly followUps?: FollowUp[];
}

export function ApplicationTimeline({ application, followUps = [] }: ApplicationTimelineProps): React.JSX.Element | null {
  const { t, locale } = useTranslation();
  const events = useMemo(() => {
    const timeline: TimelineEvent[] = [];

    timeline.push({
      id: `created-${application.id}`,
      timestamp: new Date(application.createdAt),
      type: 'created',
      title: t('applicationTimeline.created'),
      icon: Target,
    });

    if (application.status !== 'saved') {
      timeline.push({
        id: `status-${application.id}`,
        timestamp: new Date(application.updatedAt),
        type: 'status_change',
        title: t('applicationTimeline.statusChanged', { status: t(`applications.statuses.${application.status}`) }),
        icon: ClipboardList,
      });
    }

    if (application.notes) {
      for (const note of application.notes) {
        timeline.push({
          id: `note-${note.createdAt}`,
          timestamp: new Date(note.createdAt),
          type: 'note',
          title: t('applicationTimeline.noteAdded'),
          description: note.content,
          icon: StickyNote,
        });
      }
    }

    for (const followUp of followUps) {
      if (followUp.status === 'completed') {
        timeline.push({
          id: `followup-${followUp.id}`,
          timestamp: new Date(followUp.sentAt ?? followUp.scheduledAt),
          type: 'follow_up',
          title: t('applicationTimeline.followUpCompleted'),
          description: followUp.message ?? undefined,
          icon: CheckCircle2,
        });
      } else if (followUp.status === 'sent') {
        timeline.push({
          id: `followup-${followUp.id}`,
          timestamp: new Date(followUp.sentAt ?? followUp.scheduledAt),
          type: 'follow_up',
          title: t('applicationTimeline.followUpSent'),
          description: followUp.message ?? undefined,
          icon: Mail,
        });
      } else if (followUp.status === 'pending') {
        timeline.push({
          id: `followup-${followUp.id}`,
          timestamp: new Date(followUp.scheduledAt),
          type: 'follow_up',
          title: t('applicationTimeline.followUpScheduled'),
          description: followUp.message ?? undefined,
          icon: Clock,
        });
      }
    }

    return timeline.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [application, followUps, t]);

  if (events.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('applicationTimeline.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-4">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
          {events.map((event) => (
            <div key={event.id} className="relative flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border text-sm z-10">
                <event.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{event.title}</span>
                </div>
                {event.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
                )}
                <time className="text-xs text-muted-foreground mt-1 block">
                  {formatDate(event.timestamp, locale)} {formatTime(event.timestamp, locale)}
                </time>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
