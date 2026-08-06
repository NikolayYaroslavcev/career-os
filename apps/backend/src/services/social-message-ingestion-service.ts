import { createHash } from 'node:crypto';
import type { SocialMessageRepository, SocialPlatform, TransportType } from '@careeros/career';
import type { TransportManager, TransportSource, Logger, MetricsCollector } from '@careeros/providers';

export interface SocialMessageIngestionResult {
  readonly fetched: number;
  readonly persisted: number;
  readonly duplicatesSkipped: number;
}

// Own namespace rather than reusing TRANSPORT_METRICS/PROVIDER_METRICS —
// those belong to packages/providers (which has no @careeros/career
// dependency and therefore can't know about SocialMessage persistence);
// this is the backend-side counterpart for the persistence step itself.
const INGESTION_METRICS = {
  MESSAGES_PERSISTED: 'social_message.ingestion.persisted',
  MESSAGES_DUPLICATE: 'social_message.ingestion.duplicate_skipped',
  DURATION: 'social_message.ingestion.duration_ms',
} as const;

function computeContentHash(rawText: string): string {
  const normalized = rawText.trim().replace(/\s+/g, ' ');
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Phase 2.5 (ADR-032 addendum): the one place that calls
 * TransportManager.fetch() and turns its validated SocialMessageCandidates
 * into persisted SocialMessage rows. Deliberately lives here rather than in
 * packages/providers — TransportManager must never map/normalize/persist
 * (see its own doc comment), and packages/providers has no dependency on
 * @careeros/career, so persistence can only happen at this composition layer.
 * Does not extract, normalize into Vacancy, or run any AI — that's Phase 4/5.
 */
export class SocialMessageIngestionService {
  constructor(
    private readonly transportManager: TransportManager,
    private readonly socialMessageRepository: SocialMessageRepository,
    private readonly logger: Logger,
    private readonly metrics: MetricsCollector,
  ) {}

  /**
   * Derives an incremental cursor from the last message already persisted
   * for this (platform, sourceId) — not from any in-memory provider state,
   * so it survives restarts. Platform-parametrized, not Telegram-specific:
   * any SocialPlatform reuses the same query.
   */
  private async buildCursor(platform: SocialPlatform, sourceId: string): Promise<{ since?: Date } | undefined> {
    const latest = await this.socialMessageRepository.findLatestBySource(platform, sourceId);
    return latest ? { since: latest.publishedAt } : undefined;
  }

  async ingestSource(
    providerId: string,
    platform: SocialPlatform,
    source: TransportSource,
  ): Promise<SocialMessageIngestionResult> {
    const startedAt = Date.now();
    const cursor = await this.buildCursor(platform, source.sourceId);

    const result = await this.transportManager.fetch(providerId, source, { cursor });

    if (!result.ok) {
      this.logger.warn('SocialMessage ingestion fetch failed', {
        operation: 'social_message.ingest',
        providerId,
        sourceId: source.sourceId,
        error: result.message,
      });
      return { fetched: 0, persisted: 0, duplicatesSkipped: 0 };
    }

    const transportType = (result.meta.providerMeta?.transportType as string | undefined) ?? 'UNKNOWN';
    const health = this.transportManager.getHealth(providerId, transportType);

    let persisted = 0;
    let duplicatesSkipped = 0;

    for (const candidate of result.data.messages) {
      // SocialMessage rows are immutable once written (see
      // SocialMessageMapper/PrismaSocialMessageRepository doc comments), so a
      // pre-check both guarantees idempotency and gives an accurate
      // duplicate count instead of always calling the upsert.
      const existing = await this.socialMessageRepository.findBySourceAndExternalId(
        platform,
        candidate.sourceId,
        candidate.externalMessageId,
      );

      if (existing) {
        duplicatesSkipped++;
        continue;
      }

      await this.socialMessageRepository.upsertRaw({
        platform,
        sourceId: candidate.sourceId,
        sourceName: candidate.sourceName,
        externalMessageId: candidate.externalMessageId,
        authorUsername: candidate.authorUsername,
        publishedAt: candidate.publishedAt,
        rawText: candidate.rawText,
        rawHtml: candidate.rawHtml,
        media: candidate.media,
        links: candidate.links,
        language: candidate.language,
        contentHash: computeContentHash(candidate.rawText),
        transport: transportType as TransportType,
      });
      persisted++;
    }

    const durationMs = Date.now() - startedAt;
    const tags = { providerId, sourceId: source.sourceId, transportType };
    this.metrics.incrementCounter(INGESTION_METRICS.MESSAGES_PERSISTED, persisted, tags);
    this.metrics.incrementCounter(INGESTION_METRICS.MESSAGES_DUPLICATE, duplicatesSkipped, tags);
    this.metrics.recordHistogram(INGESTION_METRICS.DURATION, durationMs, tags);

    this.logger.info('SocialMessage ingestion completed', {
      operation: 'social_message.ingest',
      providerId,
      sourceId: source.sourceId,
      transportType,
      health: health.state,
      fetched: result.data.messages.length,
      persisted,
      duplicatesSkipped,
      durationMs,
    });

    return { fetched: result.data.messages.length, persisted, duplicatesSkipped };
  }
}
