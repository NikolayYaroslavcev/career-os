import { describe, it, expect, vi } from 'vitest';
import { NoopLogger, NoopMetricsCollector } from '@careeros/providers';
import type { ProviderRegistry } from '@careeros/providers';
import type { VacancyRepository, VacancySourceRepository, CompanyRepository } from '@careeros/career';
import { SyncSchedulerService } from '../sync-scheduler-service.js';

function fakeProviderJob(syncOk: boolean) {
  return {
    info: { id: 'some_provider' },
    sync: vi.fn().mockResolvedValue(
      syncOk
        ? { ok: true, data: { imported: [], metrics: { failed: 0 } } }
        : { ok: false, error: 'UNKNOWN_ERROR', message: 'boom', retryable: true },
    ),
  };
}

function buildScheduler(providerJob: ReturnType<typeof fakeProviderJob>, onProviderSynced?: (providerId: string) => Promise<void>) {
  const registry = { get: vi.fn().mockReturnValue(providerJob) } as unknown as ProviderRegistry;
  return new SyncSchedulerService(
    registry,
    {} as VacancyRepository,
    {} as VacancySourceRepository,
    {} as CompanyRepository,
    new NoopLogger(),
    new NoopMetricsCollector(),
    60 * 60 * 1000,
    undefined,
    onProviderSynced,
  );
}

// This suite is deliberately provider-agnostic (no Telegram/social-message
// import anywhere here) — onProviderSynced is a generic hook the container
// wires per-provider-specific behavior into, not something SyncSchedulerService
// itself should ever know the meaning of. See its constructor doc comment.
describe('SyncSchedulerService onProviderSynced hook', () => {
  it('invokes the hook once after a successful sync', async () => {
    const onProviderSynced = vi.fn().mockResolvedValue(undefined);
    const scheduler = buildScheduler(fakeProviderJob(true), onProviderSynced);

    const result = await scheduler.syncProvider('some_provider', 'workspace-1');

    expect(result.status).toBe('success');
    expect(onProviderSynced).toHaveBeenCalledTimes(1);
    expect(onProviderSynced).toHaveBeenCalledWith('some_provider', []);
  });

  it('does not invoke the hook when the sync fails', async () => {
    const onProviderSynced = vi.fn().mockResolvedValue(undefined);
    const scheduler = buildScheduler(fakeProviderJob(false), onProviderSynced);

    const result = await scheduler.syncProvider('some_provider', 'workspace-1');

    expect(result.status).toBe('failed');
    expect(onProviderSynced).not.toHaveBeenCalled();
  });

  it('a hook rejection does not turn a successful sync into a failure', async () => {
    const onProviderSynced = vi.fn().mockRejectedValue(new Error('ingestion blew up'));
    const scheduler = buildScheduler(fakeProviderJob(true), onProviderSynced);

    const result = await scheduler.syncProvider('some_provider', 'workspace-1');

    expect(result.status).toBe('success');
  });

  it('works with no hook configured at all', async () => {
    const scheduler = buildScheduler(fakeProviderJob(true));
    const result = await scheduler.syncProvider('some_provider', 'workspace-1');
    expect(result.status).toBe('success');
  });
});
