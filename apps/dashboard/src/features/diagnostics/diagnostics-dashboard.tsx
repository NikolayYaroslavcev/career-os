'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { ApiError } from '@/api/client';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { formatDateTime } from '@/lib/format';
import {
  getProviderDiagnostics,
  getQueueDiagnostics,
  getSearchRunTraces,
  getAiDiagnostics,
  type ProviderDiagnostics,
  type ProviderOperationalStatus,
  type QueueJobCounts,
  type SearchRunTrace,
  type AiProviderDiagnostics,
  type AiDiagnosticsMetrics,
} from '@/api/diagnostics';

interface DiagnosticsData {
  readonly providers: ProviderDiagnostics[];
  readonly queue: QueueJobCounts;
  readonly runs: SearchRunTrace[];
  readonly aiProviders: AiProviderDiagnostics[];
  readonly aiMetrics: AiDiagnosticsMetrics;
}

function healthVariant(health: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (health === 'healthy') return 'success';
  if (health === 'degraded') return 'warning';
  if (health === 'unhealthy') return 'destructive';
  return 'secondary';
}

function boolVariant(value: boolean): 'success' | 'destructive' {
  return value ? 'success' : 'destructive';
}

function statusVariant(status: ProviderOperationalStatus): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (status === 'READY') return 'success';
  if (status === 'NEEDS_CONFIGURATION') return 'warning';
  if (status === 'BLOCKED') return 'destructive';
  return 'secondary';
}

const PAGE_SIZE = 10;

function paginate<T>(items: readonly T[], page: number): T[] {
  return items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}

export function DiagnosticsDashboard(): React.JSX.Element {
  const { t, locale } = useTranslation();
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providersPage, setProvidersPage] = useState(1);
  const [exclusionsPage, setExclusionsPage] = useState(1);
  const [runsPage, setRunsPage] = useState(1);

  const load = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const [providersRes, queueRes, runsRes, aiRes] = await Promise.all([
        getProviderDiagnostics(),
        getQueueDiagnostics(),
        getSearchRunTraces(),
        getAiDiagnostics(),
      ]);
      setData({
        providers: providersRes.providers,
        queue: queueRes.queue,
        runs: runsRes.runs,
        aiProviders: aiRes.providers,
        aiMetrics: aiRes.metrics,
      });
      setProvidersPage(1);
      setExclusionsPage(1);
      setRunsPage(1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setDisabled(true);
      } else {
        setError(err instanceof Error ? err.message : t('diagnosticsPage.loadFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (isLoading) {
    return <Loading size="lg" text={t('diagnosticsPage.loading')} />;
  }

  if (disabled) {
    return (
      <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
        <AlertDescription className="text-amber-700 dark:text-amber-400">
          {t('diagnosticsPage.disabledNotice', { envVar: 'DIAGNOSTICS_ENABLED=true' })}
        </AlertDescription>
      </Alert>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error ?? t('diagnosticsPage.loadFailed')}</AlertDescription>
      </Alert>
    );
  }

  const latestRun = data.runs[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-foreground">{data.queue.waiting}</div>
            <div className="text-sm text-muted-foreground">{t('diagnosticsPage.queueWaiting')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-foreground">{data.queue.active}</div>
            <div className="text-sm text-muted-foreground">{t('diagnosticsPage.queueActive')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-foreground">{data.queue.completed}</div>
            <div className="text-sm text-muted-foreground">{t('diagnosticsPage.queueCompleted')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-foreground">{data.queue.failed}</div>
            <div className="text-sm text-muted-foreground">{t('diagnosticsPage.queueFailed')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-foreground">{data.aiMetrics.cacheReused}</div>
            <div className="text-sm text-muted-foreground">{t('diagnosticsPage.aiCacheHits')}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('diagnosticsPage.providersTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('diagnosticsPage.colProvider')}</TableHead>
                <TableHead>{t('diagnosticsPage.colStatus')}</TableHead>
                <TableHead>{t('diagnosticsPage.colDetails')}</TableHead>
                <TableHead>{t('diagnosticsPage.colRegistered')}</TableHead>
                <TableHead>{t('diagnosticsPage.colConfigured')}</TableHead>
                <TableHead>{t('diagnosticsPage.colAuth')}</TableHead>
                <TableHead>{t('diagnosticsPage.colHealth')}</TableHead>
                <TableHead>{t('diagnosticsPage.colLastFetch')}</TableHead>
                <TableHead>{t('diagnosticsPage.colFetched')}</TableHead>
                <TableHead>{t('diagnosticsPage.colPersisted')}</TableHead>
                <TableHead>{t('diagnosticsPage.colParseFailures')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginate(data.providers, providersPage).map((provider) => (
                <TableRow key={provider.providerId}>
                  <TableCell className="font-medium text-foreground">{provider.providerId}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(provider.status)}>
                      {t(`diagnosticsPage.status.${provider.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs text-xs text-muted-foreground">
                    {provider.status === 'BLOCKED' && provider.statusReason}
                    {provider.status === 'NEEDS_CONFIGURATION' && provider.requiredConfig && provider.requiredConfig.length > 0 && (
                      <span>
                        {t('diagnosticsPage.requiredConfigLabel')} {provider.requiredConfig.join(', ')}
                      </span>
                    )}
                    {provider.status === 'READY' && provider.ingestionMode && (
                      <div className="space-y-0.5">
                        <div>
                          {t('diagnosticsPage.modeLabel')} {provider.ingestionMode}
                        </div>
                        {provider.bulkSyncStatus === 'NOT_SUPPORTED_FOR_BULK_SYNC' && (
                          <div>
                            {t('diagnosticsPage.bulkSyncLabel')} {t('diagnosticsPage.bulkSyncNotSupported')}
                          </div>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={boolVariant(provider.registered)}>
                      {provider.registered ? t('diagnosticsPage.yes') : t('diagnosticsPage.no')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={boolVariant(provider.configured)}>
                      {provider.configured ? t('diagnosticsPage.yes') : t('diagnosticsPage.no')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{provider.authenticated}</TableCell>
                  <TableCell>
                    <Badge variant={healthVariant(provider.health)}>{provider.health}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {provider.lastFetch ? (
                      <Badge variant={boolVariant(provider.lastFetch.ok)}>
                        {provider.lastFetch.ok ? t('diagnosticsPage.ok') : t('diagnosticsPage.failed')}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">{t('diagnosticsPage.never')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{provider.lastFetch?.fetchedCount ?? '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{provider.lastFetch?.persistedCount ?? '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{provider.lastFetch?.parseFailureCount ?? '-'}</TableCell>
                </TableRow>
              ))}
              {data.providers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="py-4 text-center text-muted-foreground">
                    {t('diagnosticsPage.noProviders')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            page={providersPage}
            pageSize={PAGE_SIZE}
            total={data.providers.length}
            onPageChange={setProvidersPage}
            previousLabel={t('common.previous')}
            nextLabel={t('common.next')}
            rangeLabel={t('common.rangeOf', {
              from: Math.min((providersPage - 1) * PAGE_SIZE + 1, data.providers.length),
              to: Math.min(providersPage * PAGE_SIZE, data.providers.length),
              total: data.providers.length,
            })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('diagnosticsPage.aiProvidersTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {data.aiProviders.map((provider) => (
              <Badge key={provider.name} variant={provider.health?.state === 'healthy' ? 'success' : 'destructive'}>
                {provider.name}: {provider.health?.state ?? 'unknown'}
              </Badge>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <span className="text-muted-foreground">{t('diagnosticsPage.triagePassed')}</span> {data.aiMetrics.triagePassed}
            </div>
            <div>
              <span className="text-muted-foreground">{t('diagnosticsPage.triageRejected')}</span> {data.aiMetrics.triageRejected}
            </div>
            <div>
              <span className="text-muted-foreground">{t('diagnosticsPage.aiFailed')}</span> {data.aiMetrics.failed}
            </div>
            <div>
              <span className="text-muted-foreground">{t('diagnosticsPage.avgBatchDuration')}</span>{' '}
              {Math.round(data.aiMetrics.avgBatchDurationMs)}ms
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('diagnosticsPage.pipelineTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {!latestRun ? (
            <p className="text-sm text-muted-foreground">{t('diagnosticsPage.noSearches')}</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {t('diagnosticsPage.searchProfile')} {latestRun.searchProfileId}
                </span>
                <span>&middot;</span>
                <span>{t('diagnosticsPage.totalDuration', { ms: latestRun.totalDurationMs })}</span>
                <span>&middot;</span>
                <Badge variant={latestRun.aiEnabled ? 'success' : 'secondary'}>
                  {latestRun.aiEnabled ? t('diagnosticsPage.aiEnabled') : t('diagnosticsPage.aiDisabled')}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                {latestRun.stages.map((stage) => (
                  <div
                    key={stage.name}
                    className={`rounded-md border p-3 text-sm ${stage.success ? 'border-border' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}
                  >
                    <div className="font-medium text-foreground">{stage.name}</div>
                    <div className="text-muted-foreground">
                      {stage.input} &rarr; {stage.output}
                    </div>
                    <div className="text-xs text-muted-foreground">{stage.durationMs}ms</div>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="mb-2 text-sm font-medium text-foreground">{t('diagnosticsPage.excludedTitle')}</h4>
                {latestRun.exclusions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('diagnosticsPage.noExclusions')}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('diagnosticsPage.colVacancy')}</TableHead>
                        <TableHead>{t('diagnosticsPage.colReason')}</TableHead>
                        <TableHead>{t('diagnosticsPage.colStage')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginate(latestRun.exclusions, exclusionsPage).map((exclusion, index) => (
                        <TableRow key={`${exclusion.vacancyId}-${index}`}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{exclusion.vacancyId}</TableCell>
                          <TableCell>{t(`diagnosticsPage.exclusionReasons.${exclusion.reason}`)}</TableCell>
                          <TableCell className="text-muted-foreground">{exclusion.stage}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <Pagination
                  page={exclusionsPage}
                  pageSize={PAGE_SIZE}
                  total={latestRun.exclusions.length}
                  onPageChange={setExclusionsPage}
                  previousLabel={t('common.previous')}
                  nextLabel={t('common.next')}
                  rangeLabel={t('common.rangeOf', {
                    from: Math.min((exclusionsPage - 1) * PAGE_SIZE + 1, latestRun.exclusions.length),
                    to: Math.min(exclusionsPage * PAGE_SIZE, latestRun.exclusions.length),
                    total: latestRun.exclusions.length,
                  })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('diagnosticsPage.recentRunsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('diagnosticsPage.colRun')}</TableHead>
                <TableHead>{t('diagnosticsPage.searchProfile')}</TableHead>
                <TableHead>{t('diagnosticsPage.colStarted')}</TableHead>
                <TableHead>{t('diagnosticsPage.colDuration')}</TableHead>
                <TableHead>{t('diagnosticsPage.colMode')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginate(data.runs, runsPage).map((run) => (
                <TableRow key={run.runId}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{run.runId.slice(0, 8)}</TableCell>
                  <TableCell>{run.searchProfileId}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(run.startedAt, locale)}</TableCell>
                  <TableCell className="text-muted-foreground">{run.totalDurationMs}ms</TableCell>
                  <TableCell className="text-muted-foreground">
                    {run.awaitedAiMatching ? t('diagnosticsPage.modeSync') : t('diagnosticsPage.modeAsync')}
                  </TableCell>
                </TableRow>
              ))}
              {data.runs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-4 text-center text-muted-foreground">
                    {t('diagnosticsPage.noRuns')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            page={runsPage}
            pageSize={PAGE_SIZE}
            total={data.runs.length}
            onPageChange={setRunsPage}
            previousLabel={t('common.previous')}
            nextLabel={t('common.next')}
            rangeLabel={t('common.rangeOf', {
              from: Math.min((runsPage - 1) * PAGE_SIZE + 1, data.runs.length),
              to: Math.min(runsPage * PAGE_SIZE, data.runs.length),
              total: data.runs.length,
            })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
