import type { ProviderHealthMonitor, ProviderDiagnostics, ProviderFetchDiagnostics, ProviderAuthStatus } from '@careeros/providers';
import type { SyncSchedulerService } from './sync-scheduler-service.js';

export interface ProviderRegistrationOutcome {
  readonly providerId: string;
  readonly registered: boolean;
  readonly configured: boolean;
  readonly authenticated: ProviderAuthStatus;
  readonly reason?: string;
  /** Env vars required before this provider can be registered, shown to users when it's unconfigured. */
  readonly requiredConfig?: readonly string[];
}

/**
 * Providers that register successfully but are known, for reasons outside
 * this codebase's control, not to work the way every other provider does.
 * Kept as a small static lookup (rather than inferred from health checks)
 * because these are permanent, documented facts about the provider itself —
 * not transient health blips ProviderHealthMonitor already tracks.
 */
const KNOWN_STATUS_OVERRIDES: Record<
  string,
  { statusReason?: string; ingestionMode?: string; blocked?: boolean; notSupportedForBulkSync?: boolean }
> = {
  hh: {
    blocked: true,
    statusReason: 'DDoS-Guard blocks API requests from current infrastructure.',
  },
  linkedin: {
    ingestionMode: 'Browser Extension ingestion',
    notSupportedForBulkSync: true,
  },
};

/**
 * Single consolidated view of every job provider's operational status —
 * registration/config/auth (set once at boot) plus the most recent search's
 * fetch pipeline counts (overwritten on every search). Deliberately reuses
 * existing state owners for the live `health` field rather than tracking its
 * own — this service is a thin aggregator, not a parallel health system.
 * Priority: ProviderHealthMonitor (if ever actively checked) > SyncSchedulerService's
 * derived health (the real signal in production, updated on every scheduled
 * sync) > a guess from the last search's fetch outcome, for providers that
 * have been searched but never scheduled/synced.
 */
export class ProviderDiagnosticsService {
  private readonly registrations = new Map<string, ProviderRegistrationOutcome>();
  private readonly lastFetches = new Map<string, ProviderFetchDiagnostics>();
  private syncScheduler: SyncSchedulerService | null = null;

  constructor(private readonly healthMonitor: ProviderHealthMonitor) {}

  /**
   * Wired in after construction (container.ts) rather than via the
   * constructor, mirroring SyncSchedulerService.setProviderConfigRepo —
   * avoids reordering the rest of buildContainer() around this one edge.
   */
  setSyncScheduler(syncScheduler: SyncSchedulerService): void {
    this.syncScheduler = syncScheduler;
  }

  recordRegistrations(outcomes: readonly ProviderRegistrationOutcome[]): void {
    for (const outcome of outcomes) {
      this.registrations.set(outcome.providerId, outcome);
    }
  }

  recordFetch(providerId: string, fetch: ProviderFetchDiagnostics): void {
    this.lastFetches.set(providerId, fetch);
  }

  getSnapshot(): ProviderDiagnostics[] {
    return [...this.registrations.values()]
      .map((registration) => {
        const override = KNOWN_STATUS_OVERRIDES[registration.providerId];
        const lastFetch = this.lastFetches.get(registration.providerId);

        const status: ProviderDiagnostics['status'] = !registration.registered
          ? 'NEEDS_CONFIGURATION'
          : override?.blocked
            ? 'BLOCKED'
            : 'READY';

        const statusReason = !registration.registered ? registration.reason : override?.statusReason;

        // Health source priority: active health-monitor check (rarely populated
        // in production today) > SyncSchedulerService's derived health (the real
        // signal — updated on every scheduled/manual sync) > a guess from the
        // last search's fetch outcome, for providers searched but never synced.
        const monitorState = this.healthMonitor.getStatus(registration.providerId)?.state;
        const schedulerHealth = this.syncScheduler?.getStatus('global', registration.providerId)?.health;
        let health: ProviderDiagnostics['health'] = monitorState ?? schedulerHealth ?? 'unknown';
        if (health === 'unknown' && lastFetch) {
          health = lastFetch.ok ? 'healthy' : 'unhealthy';
        }

        return {
          providerId: registration.providerId,
          registered: registration.registered,
          enabled: registration.registered,
          configured: registration.configured,
          authenticated: registration.authenticated,
          reason: registration.reason,
          health,
          lastFetch,
          status,
          statusReason,
          requiredConfig: registration.requiredConfig,
          ingestionMode: override?.ingestionMode,
          bulkSyncStatus: override?.notSupportedForBulkSync
            ? ('NOT_SUPPORTED_FOR_BULK_SYNC' as const)
            : ('SUPPORTED' as const),
        };
      })
      .sort((a, b) => a.providerId.localeCompare(b.providerId));
  }
}
