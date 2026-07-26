import { describe, it, expect } from 'vitest';
import { ProviderHealthMonitor } from '@careeros/providers';
import { ProviderDiagnosticsService, type ProviderRegistrationOutcome } from '../provider-diagnostics-service.js';

function createService(): ProviderDiagnosticsService {
  const healthMonitor = new ProviderHealthMonitor({
    checkIntervalMs: 5 * 60 * 1000,
    unhealthyThreshold: 3,
    degradedThresholdMs: 3000,
    healthyThresholdMs: 1000,
  });
  return new ProviderDiagnosticsService(healthMonitor);
}

describe('ProviderDiagnosticsService status representation', () => {
  it('marks an unconfigured ATS provider as NEEDS_CONFIGURATION with its required env vars', () => {
    const service = createService();
    const outcomes: ProviderRegistrationOutcome[] = [
      {
        providerId: 'greenhouse',
        registered: false,
        configured: false,
        authenticated: 'missing',
        reason: 'GREENHOUSE_BOARD_TOKEN/GREENHOUSE_COMPANY_NAME not set',
        requiredConfig: ['GREENHOUSE_BOARD_TOKEN', 'GREENHOUSE_COMPANY_NAME'],
      },
    ];
    service.recordRegistrations(outcomes);

    const [snapshot] = service.getSnapshot();
    if (!snapshot) throw new Error('expected a diagnostics snapshot');
    expect(snapshot.status).toBe('NEEDS_CONFIGURATION');
    expect(snapshot.statusReason).toBe('GREENHOUSE_BOARD_TOKEN/GREENHOUSE_COMPANY_NAME not set');
    expect(snapshot.requiredConfig).toEqual(['GREENHOUSE_BOARD_TOKEN', 'GREENHOUSE_COMPANY_NAME']);
    expect(snapshot.bulkSyncStatus).toBe('SUPPORTED');
  });

  it('marks HH as BLOCKED with the DDoS-Guard reason even though it is registered', () => {
    const service = createService();
    service.recordRegistrations([
      { providerId: 'hh', registered: true, configured: true, authenticated: 'not_required' },
    ]);

    const [snapshot] = service.getSnapshot();
    if (!snapshot) throw new Error('expected a diagnostics snapshot');
    expect(snapshot.status).toBe('BLOCKED');
    expect(snapshot.statusReason).toBe('DDoS-Guard blocks API requests from current infrastructure.');
  });

  it('marks LinkedIn as READY but not supported for bulk sync, with its ingestion mode set', () => {
    const service = createService();
    service.recordRegistrations([
      { providerId: 'linkedin', registered: true, configured: true, authenticated: 'not_required' },
    ]);

    const [snapshot] = service.getSnapshot();
    if (!snapshot) throw new Error('expected a diagnostics snapshot');
    expect(snapshot.status).toBe('READY');
    expect(snapshot.ingestionMode).toBe('Browser Extension ingestion');
    expect(snapshot.bulkSyncStatus).toBe('NOT_SUPPORTED_FOR_BULK_SYNC');
  });

  it('marks a fully working, unrestricted provider as READY with bulk sync supported', () => {
    const service = createService();
    service.recordRegistrations([
      { providerId: 'remote_ok', registered: true, configured: true, authenticated: 'not_required' },
    ]);

    const [snapshot] = service.getSnapshot();
    if (!snapshot) throw new Error('expected a diagnostics snapshot');
    expect(snapshot.status).toBe('READY');
    expect(snapshot.statusReason).toBeUndefined();
    expect(snapshot.bulkSyncStatus).toBe('SUPPORTED');
    expect(snapshot.ingestionMode).toBeUndefined();
  });

  it('derives health from lastFetch when health monitor has not checked', () => {
    const service = createService();
    service.recordRegistrations([
      { providerId: 'remote_ok', registered: true, configured: true, authenticated: 'not_required' },
    ]);
    service.recordFetch('remote_ok', {
      at: new Date(),
      durationMs: 200,
      ok: true,
      fetchedCount: 10,
      normalizedCount: 10,
      deduplicatedCount: 8,
      filteredCount: 8,
      persistedCount: 8,
      parseFailureCount: 0,
    });

    const [snapshot] = service.getSnapshot();
    if (!snapshot) throw new Error('expected a diagnostics snapshot');
    expect(snapshot.health).toBe('healthy');
  });

  it('derives unhealthy from failed lastFetch when health monitor has not checked', () => {
    const service = createService();
    service.recordRegistrations([
      { providerId: 'hh', registered: true, configured: true, authenticated: 'not_required' },
    ]);
    service.recordFetch('hh', {
      at: new Date(),
      durationMs: 5000,
      ok: false,
      error: 'DDoS-Guard blocked',
      fetchedCount: 0,
      normalizedCount: 0,
      deduplicatedCount: 0,
      filteredCount: 0,
      persistedCount: 0,
      parseFailureCount: 0,
    });

    const [snapshot] = service.getSnapshot();
    if (!snapshot) throw new Error('expected a diagnostics snapshot');
    expect(snapshot.health).toBe('unhealthy');
  });

  it('prefers SyncSchedulerService health over a lastFetch-derived guess once wired', () => {
    const service = createService();
    service.setSyncScheduler({
      getStatus: (_workspaceId: string, providerId: string) =>
        providerId === 'remote_ok' ? { health: 'degraded' } : undefined,
    } as unknown as import('../sync-scheduler-service.js').SyncSchedulerService);

    service.recordRegistrations([
      { providerId: 'remote_ok', registered: true, configured: true, authenticated: 'not_required' },
    ]);
    // A successful lastFetch would otherwise say 'healthy' — the scheduler's
    // sync-derived state must win so Diagnostics and Provider Management agree.
    service.recordFetch('remote_ok', {
      at: new Date(),
      durationMs: 200,
      ok: true,
      fetchedCount: 10,
      normalizedCount: 10,
      deduplicatedCount: 8,
      filteredCount: 8,
      persistedCount: 8,
      parseFailureCount: 0,
    });

    const [snapshot] = service.getSnapshot();
    if (!snapshot) throw new Error('expected a diagnostics snapshot');
    expect(snapshot.health).toBe('degraded');
  });
});
