'use client';

import { useState, useEffect } from 'react';
import { generateLinkCode, getConnectionStatus, type LinkCodeResponse, type ConnectionStatus } from '@/api/telegram';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link as LinkIcon, CheckCircle, Clock } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/i18n-provider';

export function TelegramLinking(): React.JSX.Element {
  const { t, locale } = useTranslation();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [linkCode, setLinkCode] = useState<LinkCodeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConnectionStatus();
  }, []);

  const fetchConnectionStatus = async (): Promise<void> => {
    try {
      const status = await getConnectionStatus();
      setConnectionStatus(status);
    } catch (err) {
      console.error('Failed to fetch connection status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateCode = async (): Promise<void> => {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateLinkCode();
      setLinkCode(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('telegram.generateFailed');
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return <Loading text={t('telegram.loadingStatus')} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t('telegram.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('telegram.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            {t('telegram.connectionStatus')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {connectionStatus?.linked ? (
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="font-medium">{t('telegram.connected')}</p>
                {connectionStatus.telegramUsername && (
                  <p className="text-sm text-muted-foreground">
                    @{connectionStatus.telegramUsername}
                  </p>
                )}
                {connectionStatus.verifiedAt && (
                  <p className="text-xs text-muted-foreground">
                    {t('telegram.connectedOn', {
                      date: new Date(connectionStatus.verifiedAt).toLocaleDateString(locale),
                    })}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t('telegram.notConnected')}</p>
                  <p className="text-sm text-muted-foreground">{t('telegram.notConnectedSubtitle')}</p>
                </div>
              </div>

              {!linkCode ? (
                <Button onClick={handleGenerateCode} disabled={isGenerating}>
                  {isGenerating ? (
                    <Loading size="sm" text={t('telegram.generating')} />
                  ) : (
                    t('telegram.generateCode')
                  )}
                </Button>
              ) : (
                <div className="rounded-lg bg-muted p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{t('telegram.yourCode')}</p>
                    <Badge variant="default" className="text-lg font-mono">
                      {linkCode.code}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('telegram.expiresAt', {
                      time: new Date(linkCode.expiresAt).toLocaleTimeString(locale),
                    })}
                  </p>

                  <Alert className="border-primary/30 bg-primary/5 text-primary space-y-1">
                    <AlertDescription className="text-primary space-y-1">
                      <p className="font-medium">{t('telegram.instructionsTitle')}</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>{t('telegram.instruction1')}</li>
                        <li>
                          {t('telegram.instruction2')}{' '}
                          <code className="bg-primary/10 px-1 rounded">/start {linkCode.code}</code>
                        </li>
                        <li>{t('telegram.instruction3')}</li>
                      </ol>
                    </AlertDescription>
                  </Alert>

                  <Button variant="outline" onClick={handleGenerateCode}>
                    {t('telegram.generateNewCode')}
                  </Button>
                </div>
              )}
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
