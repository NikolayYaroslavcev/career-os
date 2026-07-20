'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { ApiError } from '@/api/client';
import {
  getProviderDiagnostics,
  getQueueDiagnostics,
  getSearchRunTraces,
  getAiDiagnostics,
  type ProviderDiagnostics,
  type QueueJobCounts,
  type SearchRunTrace,
  type AiProviderDiagnostics,
  type AiDiagnosticsMetrics,
  type VacancyExclusionReason,
} from '@/api/diagnostics';

interface DiagnosticsData {
  readonly providers: ProviderDiagnostics[];
  readonly queue: QueueJobCounts;
  readonly runs: SearchRunTrace[];
  readonly aiProviders: AiProviderDiagnostics[];
  readonly aiMetrics: AiDiagnosticsMetrics;
}

const EXCLUSION_LABELS: Record<VacancyExclusionReason, string> = {
  duplicate: 'Duplicate',
  provider_parse_failure: 'Provider parse failure',
  low_relevance: 'Low relevance',
  outside_top_n: 'Outside Top-N (queued for later batch)',
  cache_hit: 'Already analyzed (cache hit)',
  ai_failed: 'AI call failed',
};

function healthVariant(health: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (health === 'healthy') return 'success';
  if (health === 'degraded') return 'warning';
  if (health === 'unhealthy') return 'destructive';
  return 'secondary';
}

function boolVariant(value: boolean): 'success' | 'destructive' {
  return value ? 'success' : 'destructive';
}

export function DiagnosticsDashboard() {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
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
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setDisabled(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load diagnostics');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (isLoading) {
    return <Loading size="lg" text="Loading diagnostics..." />;
  }

  if (disabled) {
    return (
      <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
        Diagnostics are disabled on this environment. Set <code>DIAGNOSTICS_ENABLED=true</code> in the backend
        environment to enable this page.
      </div>
    );
  }

  if (error || !data) {
    return <div className="rounded-md bg-red-50 p-4 text-sm text-red-600">{error ?? 'Failed to load diagnostics'}</div>;
  }

  const latestRun = data.runs[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{data.queue.waiting}</div>
            <div className="text-sm text-gray-500">Queue waiting</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{data.queue.active}</div>
            <div className="text-sm text-gray-500">Queue active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{data.queue.completed}</div>
            <div className="text-sm text-gray-500">Queue completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{data.queue.failed}</div>
            <div className="text-sm text-gray-500">Queue failed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{data.aiMetrics.cacheReused}</div>
            <div className="text-sm text-gray-500">AI cache hits</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Providers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="py-2 pr-4">Provider</th>
                  <th className="py-2 pr-4">Registered</th>
                  <th className="py-2 pr-4">Configured</th>
                  <th className="py-2 pr-4">Auth</th>
                  <th className="py-2 pr-4">Health</th>
                  <th className="py-2 pr-4">Last fetch</th>
                  <th className="py-2 pr-4">Fetched</th>
                  <th className="py-2 pr-4">Persisted</th>
                  <th className="py-2 pr-4">Parse failures</th>
                </tr>
              </thead>
              <tbody>
                {data.providers.map((provider) => (
                  <tr key={provider.providerId} className="border-b border-gray-100">
                    <td className="py-2 pr-4 font-medium text-gray-900">{provider.providerId}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={boolVariant(provider.registered)}>{provider.registered ? 'yes' : 'no'}</Badge>
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant={boolVariant(provider.configured)}>{provider.configured ? 'yes' : 'no'}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-gray-600">{provider.authenticated}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={healthVariant(provider.health)}>{provider.health}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {provider.lastFetch ? (
                        <Badge variant={boolVariant(provider.lastFetch.ok)}>{provider.lastFetch.ok ? 'ok' : 'failed'}</Badge>
                      ) : (
                        <span className="text-gray-400">never</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">{provider.lastFetch?.fetchedCount ?? '-'}</td>
                    <td className="py-2 pr-4 text-gray-600">{provider.lastFetch?.persistedCount ?? '-'}</td>
                    <td className="py-2 pr-4 text-gray-600">{provider.lastFetch?.parseFailureCount ?? '-'}</td>
                  </tr>
                ))}
                {data.providers.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-4 text-center text-gray-400">
                      No providers registered.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Providers</CardTitle>
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
              <span className="text-gray-500">Triage passed:</span> {data.aiMetrics.triagePassed}
            </div>
            <div>
              <span className="text-gray-500">Triage rejected:</span> {data.aiMetrics.triageRejected}
            </div>
            <div>
              <span className="text-gray-500">AI failed:</span> {data.aiMetrics.failed}
            </div>
            <div>
              <span className="text-gray-500">Avg batch duration:</span> {Math.round(data.aiMetrics.avgBatchDurationMs)}ms
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latest search run pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          {!latestRun ? (
            <p className="text-sm text-gray-400">No searches have run yet.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <span>Search profile: {latestRun.searchProfileId}</span>
                <span>&middot;</span>
                <span>{latestRun.totalDurationMs}ms total</span>
                <span>&middot;</span>
                <Badge variant={latestRun.aiEnabled ? 'success' : 'secondary'}>
                  {latestRun.aiEnabled ? 'AI enabled' : 'AI disabled'}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                {latestRun.stages.map((stage) => (
                  <div
                    key={stage.name}
                    className={`rounded-md border p-3 text-sm ${stage.success ? 'border-gray-200' : 'border-red-300 bg-red-50'}`}
                  >
                    <div className="font-medium text-gray-900">{stage.name}</div>
                    <div className="text-gray-500">
                      {stage.input} &rarr; {stage.output}
                    </div>
                    <div className="text-xs text-gray-400">{stage.durationMs}ms</div>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-900">Excluded vacancies (why they never reached AI)</h4>
                {latestRun.exclusions.length === 0 ? (
                  <p className="text-sm text-gray-400">Nothing excluded — every vacancy is included or already handled.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-gray-500">
                          <th className="py-2 pr-4">Vacancy</th>
                          <th className="py-2 pr-4">Reason</th>
                          <th className="py-2 pr-4">Stage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latestRun.exclusions.map((exclusion, index) => (
                          <tr key={`${exclusion.vacancyId}-${index}`} className="border-b border-gray-100">
                            <td className="py-2 pr-4 font-mono text-xs text-gray-600">{exclusion.vacancyId}</td>
                            <td className="py-2 pr-4">{EXCLUSION_LABELS[exclusion.reason]}</td>
                            <td className="py-2 pr-4 text-gray-500">{exclusion.stage}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent search runs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="py-2 pr-4">Run</th>
                  <th className="py-2 pr-4">Search profile</th>
                  <th className="py-2 pr-4">Started</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2 pr-4">Mode</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.map((run) => (
                  <tr key={run.runId} className="border-b border-gray-100">
                    <td className="py-2 pr-4 font-mono text-xs text-gray-600">{run.runId.slice(0, 8)}</td>
                    <td className="py-2 pr-4">{run.searchProfileId}</td>
                    <td className="py-2 pr-4 text-gray-500">{new Date(run.startedAt).toLocaleString()}</td>
                    <td className="py-2 pr-4 text-gray-500">{run.totalDurationMs}ms</td>
                    <td className="py-2 pr-4 text-gray-500">{run.awaitedAiMatching ? 'synchronous' : 'async'}</td>
                  </tr>
                ))}
                {data.runs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-gray-400">
                      No searches recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
