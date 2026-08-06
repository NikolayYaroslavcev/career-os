import type { Logger, MetricsCollector } from '@careeros/providers';
import type { DiscoverySourceId } from '../types.js';
import type { DiscoverySourceRegistry } from '../registry/discovery-source-registry.js';
import type { DiscoverySourceConfigRepository, DiscoverySourceConfigData } from './discovery-source-config-repository.js';
import { DISCOVERY_METRICS } from '../observability/metrics.js';
import { runWithConcurrency } from './concurrency.js';

/** Structural subset of CompanyDiscoveryIntakeService this orchestrator needs — same reasoning as that service's own DiscoveryProbe/AtsRegistryProbe interfaces. */
export interface DiscoveryIntakeProbe {
  discover(input: {
    companyName: string;
    url: string;
    discoverySource: string;
    sourceAuthorityScore: number;
  }): Promise<
    | { readonly outcome: 'DUPLICATE' }
    | { readonly outcome: 'SCORED'; readonly candidate: { readonly status: string } }
  >;
}

export interface DiscoverySourceRunResult {
  readonly sourceId: DiscoverySourceId;
  readonly skipped: boolean;
  readonly found: number;
  readonly deduplicated: number;
  readonly enrolled: number;
  readonly rejected: number;
  readonly hasMore: boolean;
  readonly durationMs: number;
  readonly error?: string;
}

/** ADR-035 §14: caps concurrent CompanyDiscoveryIntakeService.discover() calls (each does its own HTTP fingerprint probe) within one source run. */
const DEFAULT_CANDIDATE_CONCURRENCY = 5;

/**
 * ADR-035 Phase 4 orchestrator. Runs one DiscoverySource's fetcher, feeds
 * every raw tuple through the *existing* CompanyDiscoveryIntakeService.discover()
 * (same intake path Phase 2's single-shot discovery already uses — no
 * second enrollment path), and persists the source's incremental cursor +
 * run stats. A failed run does NOT advance the cursor (ADR §13) — the next
 * scheduled run re-covers the same window.
 */
export class DiscoveryBulkIngestService {
  constructor(
    private readonly registry: DiscoverySourceRegistry,
    private readonly configRepo: DiscoverySourceConfigRepository,
    private readonly intake: DiscoveryIntakeProbe,
    private readonly logger: Logger,
    private readonly metrics: MetricsCollector,
    private readonly candidateConcurrency: number = DEFAULT_CANDIDATE_CONCURRENCY
  ) {}

  async runSource(sourceId: DiscoverySourceId): Promise<DiscoverySourceRunResult> {
    const startTime = Date.now();
    const config = await this.configRepo.findBySourceId(sourceId);

    if (!config || !config.enabled) {
      return { sourceId, skipped: true, found: 0, deduplicated: 0, enrolled: 0, rejected: 0, hasMore: false, durationMs: 0 };
    }

    const fetcher = this.registry.get(sourceId);

    try {
      const fetchResult = await fetcher.fetch(config.cursor);

      let deduplicated = 0;
      let enrolled = 0;
      let rejected = 0;

      await runWithConcurrency(fetchResult.tuples, this.candidateConcurrency, async (tuple) => {
        const outcome = await this.intake.discover({
          companyName: tuple.name,
          url: tuple.url,
          discoverySource: sourceId,
          sourceAuthorityScore: tuple.sourceAuthorityScore,
        });

        if (outcome.outcome === 'DUPLICATE') {
          deduplicated++;
          return;
        }
        if (outcome.candidate.status === 'AUTO_APPROVED' || outcome.candidate.status === 'CONVERTED') enrolled++;
        if (outcome.candidate.status === 'REJECTED') rejected++;
      });

      const found = fetchResult.tuples.length;
      const durationMs = Date.now() - startTime;

      this.metrics.incrementCounter(DISCOVERY_METRICS.CANDIDATES_FOUND, found, { sourceId });
      this.metrics.incrementCounter(DISCOVERY_METRICS.CANDIDATES_DEDUPLICATED, deduplicated, { sourceId });
      this.metrics.incrementCounter(DISCOVERY_METRICS.AUTO_ENROLLED, enrolled, { sourceId });
      this.metrics.incrementCounter(DISCOVERY_METRICS.REJECTED, rejected, { sourceId });
      this.metrics.recordHistogram(DISCOVERY_METRICS.SOURCE_RUN_DURATION, durationMs, { sourceId });

      await this.configRepo.update(
        this.applyRunUpdate(config, {
          cursor: fetchResult.cursor,
          lastRunStatus: 'success',
          lastRunError: null,
          found,
          enrolled,
          rejected,
        })
      );

      this.logger.info('Discovery source run completed', { sourceId, found, deduplicated, enrolled, rejected, durationMs });

      return { sourceId, skipped: false, found, deduplicated, enrolled, rejected, hasMore: fetchResult.hasMore, durationMs };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.metrics.incrementCounter(DISCOVERY_METRICS.SOURCE_RUN_FAILURE, 1, { sourceId });
      this.logger.error('Discovery source run failed', error instanceof Error ? error : undefined, { sourceId });

      // ADR §13: cursor is NOT advanced on failure (config.cursor passed through unchanged) — next run re-covers the same window.
      await this.configRepo.update(
        this.applyRunUpdate(config, {
          cursor: config.cursor,
          lastRunStatus: 'failed',
          lastRunError: message,
          found: 0,
          enrolled: 0,
          rejected: 0,
        })
      );

      return { sourceId, skipped: false, found: 0, deduplicated: 0, enrolled: 0, rejected: 0, hasMore: false, durationMs, error: message };
    }
  }

  async runAllEnabled(): Promise<readonly DiscoverySourceRunResult[]> {
    const configs = await this.configRepo.findAllEnabled();
    const results: DiscoverySourceRunResult[] = [];
    for (const config of configs) {
      results.push(await this.runSource(config.sourceId));
    }
    return results;
  }

  private applyRunUpdate(
    config: DiscoverySourceConfigData,
    update: {
      cursor: DiscoverySourceConfigData['cursor'];
      lastRunStatus: DiscoverySourceConfigData['lastRunStatus'];
      lastRunError: string | null;
      found: number;
      enrolled: number;
      rejected: number;
    }
  ): DiscoverySourceConfigData {
    return {
      ...config,
      cursor: update.cursor,
      lastRunAt: new Date(),
      lastRunStatus: update.lastRunStatus,
      lastRunError: update.lastRunError,
      candidatesFound: config.candidatesFound + update.found,
      candidatesEnrolled: config.candidatesEnrolled + update.enrolled,
      candidatesRejected: config.candidatesRejected + update.rejected,
      updatedAt: new Date(),
    };
  }
}
