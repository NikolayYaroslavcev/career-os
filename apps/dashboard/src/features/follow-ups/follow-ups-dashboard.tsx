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
import type { FollowUpType } from '@/api/applications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, ExternalLink } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/i18n-provider';

type FilterKey = 'all' | 'overdue' | 'today' | 'upcoming' | 'completed';
const FILTERS: readonly FilterKey[] = ['all', 'overdue', 'today', 'upcoming', 'completed'];
const SECTION_KEYS: readonly Exclude<FilterKey, 'all'>[] = ['overdue', 'today', 'upcoming', 'completed'];

const TYPE_OPTIONS: readonly FollowUpType[] = ['follow_up', 'interview', 'reply_expected', 'custom'];

const EMPTY_BUCKETS: FollowUpBuckets = { overdue: [], today: [], upcoming: [], completed: [] };

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
            <button type="button" onClick={() => setError(null)} className="text-xs font-medium underline underline-offset-2 hover:no-underline">
              {t('common.dismiss')}
            </button>
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
              <p className="mb-1 text-xs text-muted-foreground">{t('followUpsPage.applicationIdLabel')}</p>
              <Input
                placeholder={t('followUpsPage.applicationIdPlaceholder')}
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t('followUpsPage.dateLabel')}</p>
              <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t('followUpsPage.typeLabel')}</p>
              <select
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none"
                value={type}
                onChange={(e) => setType(e.target.value as FollowUpType)}
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {t(`followUpsPage.types.${option}`)}
                  </option>
                ))}
              </select>
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
              : t('followUpsPage.appliedDaysAgo', { count: item.daysSinceApplied })}
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
