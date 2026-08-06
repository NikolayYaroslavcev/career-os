import type { DiscoveryCursor, DiscoverySourceId } from '../types.js';

export type DiscoverySourceRunStatus = 'success' | 'failed' | 'pending';

export interface DiscoverySourceConfigData {
  readonly id: string;
  readonly sourceId: DiscoverySourceId;
  readonly enabled: boolean;
  readonly cursor: DiscoveryCursor | null;
  readonly lastRunAt: Date | null;
  readonly lastRunStatus: DiscoverySourceRunStatus | null;
  readonly lastRunError: string | null;
  readonly candidatesFound: number;
  readonly candidatesEnrolled: number;
  readonly candidatesRejected: number;
  readonly metadata: Record<string, unknown> | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Mirrors ProviderConfig's config-row shape (ADR §1's reuse table: "per-source config/enable/priority -> ProviderConfig"). */
export interface DiscoverySourceConfigRepository {
  findBySourceId(sourceId: DiscoverySourceId): Promise<DiscoverySourceConfigData | null>;
  findAllEnabled(): Promise<readonly DiscoverySourceConfigData[]>;
  findAll(): Promise<readonly DiscoverySourceConfigData[]>;
  update(data: DiscoverySourceConfigData): Promise<DiscoverySourceConfigData>;
  /**
   * Idempotent bootstrap — creates an enabled config row for a registered
   * fetcher on first boot, no-op if one already exists. Registering a
   * DiscoverySourceFetcher (in-process) and having a persisted, enabled
   * config row are deliberately separate: this is what lets an operator
   * disable a specific source later (ADR §16's canary discipline) without
   * that being overwritten on the next process restart.
   */
  ensureRegistered(sourceId: DiscoverySourceId): Promise<DiscoverySourceConfigData>;
}
