'use client';

import { useState, useEffect, useCallback } from 'react';
import { listCommunications, addCommunication, type Communication } from '@/api/applications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Mail, Phone, MessageSquare } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { formatDateTime } from '@/lib/format';

interface CommunicationLogProps {
  readonly applicationId: string;
}

const TYPE_ICONS: Record<Communication['type'], typeof Mail> = {
  email: Mail,
  phone: Phone,
  linkedin: MessageSquare,
  telegram: MessageSquare,
  other: MessageSquare,
};

const DIRECTION_BADGES: Record<Communication['direction'], 'default' | 'secondary'> = {
  inbound: 'default',
  outbound: 'secondary',
};

export function CommunicationLog({ applicationId }: CommunicationLogProps): React.JSX.Element {
  const { t, locale } = useTranslation();
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newType, setNewType] = useState<Communication['type']>('email');
  const [newDirection, setNewDirection] = useState<Communication['direction']>('outbound');
  const [newContent, setNewContent] = useState('');
  const [newSubject, setNewSubject] = useState('');

  const fetchCommunications = useCallback(async (): Promise<void> => {
    try {
      const data = await listCommunications(applicationId);
      setCommunications(data.communications);
    } catch (error) {
      console.error('Failed to load communications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    fetchCommunications();
  }, [fetchCommunications]);

  const handleAdd = async (): Promise<void> => {
    if (!newContent.trim()) return;
    setIsAdding(true);
    try {
      await addCommunication(applicationId, {
        type: newType,
        direction: newDirection,
        content: newContent.trim(),
        subject: newSubject.trim() || undefined,
      });
      setNewContent('');
      setNewSubject('');
      await fetchCommunications();
    } catch (error) {
      console.error('Failed to add communication:', error);
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) return <Loading />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{t('communicationLog.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Select value={newType} onValueChange={(value) => value && setNewType(value as Communication['type'])}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: Communication['type']) => t(`communicationLog.types.${value}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">{t('communicationLog.types.email')}</SelectItem>
                <SelectItem value="phone">{t('communicationLog.types.phone')}</SelectItem>
                <SelectItem value="linkedin">{t('communicationLog.types.linkedin')}</SelectItem>
                <SelectItem value="telegram">{t('communicationLog.types.telegram')}</SelectItem>
                <SelectItem value="other">{t('communicationLog.types.other')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={newDirection} onValueChange={(value) => value && setNewDirection(value as Communication['direction'])}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: Communication['direction']) => t(`communicationLog.directions.${value}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="outbound">{t('communicationLog.directions.outbound')}</SelectItem>
                <SelectItem value="inbound">{t('communicationLog.directions.inbound')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder={t('communicationLog.subjectPlaceholder')}
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
          />
          <div className="flex gap-2">
            <Input
              placeholder={t('communicationLog.contentPlaceholder')}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleAdd} disabled={isAdding || !newContent.trim()} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {communications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t('communicationLog.empty')}</p>
          ) : (
            <div className="space-y-3">
              {communications.map((comm) => {
                const Icon = TYPE_ICONS[comm.type] ?? MessageSquare;
                return (
                  <div key={comm.id} className="flex gap-3 p-3 rounded-lg border border-border">
                    <Icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={DIRECTION_BADGES[comm.direction]}>
                          {comm.direction}
                        </Badge>
                        <span className="text-xs text-muted-foreground capitalize">{comm.type}</span>
                        {comm.subject && (
                          <span className="text-xs font-medium truncate">{comm.subject}</span>
                        )}
                      </div>
                      {comm.content && (
                        <p className="text-sm text-muted-foreground mt-1">{comm.content}</p>
                      )}
                      <time className="text-xs text-muted-foreground mt-1 block">
                        {formatDateTime(comm.sentAt, locale)}
                      </time>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
