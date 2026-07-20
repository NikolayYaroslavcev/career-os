import type { ProviderHealthMonitor, ProviderDiagnostics, ProviderFetchDiagnostics, ProviderAuthStatus } from '@careeros/providers';

export interface ProviderRegistrationOutcome {
  readonly providerId: string;
  readonly registered: boolean;
  readonly configured: boolean;
  readonly authenticated: ProviderAuthStatus;
  readonly reason?: string;
}

/**
 * Single consolidated view of every job provider's operational status —
 * registration/config/auth (set once at boot) plus the most recent search's
 * fetch pipeline counts (overwritten on every search). Deliberately reuses
 * ProviderHealthMonitor for the live `health` field rather than tracking its
 * own — this service is a thin aggregator, not a parallel health system.
 */
export class ProviderDiagnosticsService {
  private readonly registrations = new Map<string, ProviderRegistrationOutcome>();
  private readonly lastFetches = new Map<string, ProviderFetchDiagnostics>();

  constructor(private readonly healthMonitor: ProviderHealthMonitor) {}

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
      .map((registration) => ({
        providerId: registration.providerId,
        registered: registration.registered,
        enabled: registration.registered,
        configured: registration.configured,
        authenticated: registration.authenticated,
        reason: registration.reason,
        health: this.healthMonitor.getStatus(registration.providerId)?.state ?? 'unknown',
        lastFetch: this.lastFetches.get(registration.providerId),
      }))
      .sort((a, b) => a.providerId.localeCompare(b.providerId));
  }
}
