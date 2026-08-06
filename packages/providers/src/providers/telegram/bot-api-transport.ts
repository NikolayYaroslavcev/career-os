import type {
  SocialMessageTransport,
  TransportSource,
  TransportCursor,
  TransportFetchResult,
  SocialMessageCandidate,
  SocialMessageValidationError,
} from '../../interfaces/social-message-transport.js';
import type { TransportCapability } from '../../interfaces/transport-capability.js';
import type { ProviderResult } from '../../interfaces/result.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import { TRANSPORT_METRICS } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { validateSocialMessageCandidate } from '../../shared/social-message-validation.js';

/**
 * What the Bot API actually delivers per `channel_post` update — a plain data
 * shape, not a Telegraf type, so packages/providers stays free of a telegraf
 * dependency. The Telegraf wiring that produces these lives in
 * packages/telegram (the existing Telegram client infrastructure) and is
 * connected to this transport by the container, not by this class.
 */
export interface ChannelPostInput {
  readonly sourceId: string;
  readonly sourceName?: string;
  readonly externalMessageId: string;
  readonly authorUsername?: string;
  readonly publishedAt: Date;
  readonly rawText: string;
  readonly rawHtml?: string;
  readonly media?: unknown;
  readonly links?: readonly string[];
  readonly language?: string;
}

export interface BotApiTransportConfig {
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
  /** Per-source ring buffer cap — bounds memory if fetch() isn't called often enough to drain incoming posts. */
  readonly maxBufferPerSource?: number;
}

const DEFAULT_MAX_BUFFER_PER_SOURCE = 500;

/**
 * API-capability transport for channels the bot has been added to as an
 * admin. The Bot API has no "list channel history" endpoint (see
 * telegram-types.ts) — content only arrives as `channel_post` push updates —
 * so this transport is push-fed via ingest() and pull-shaped via fetch()
 * (drains what's been buffered since the last call). No AI, normalization,
 * persistence, or deduplication happens here, per the SocialMessageTransport
 * contract; ingest() validates and drops malformed input immediately so
 * fetch() never has to hand a caller something invalid.
 */
export class BotApiTransport implements SocialMessageTransport {
  readonly transportType = 'BOT_API';
  readonly capability: TransportCapability = 'API';

  private readonly buffers = new Map<string, SocialMessageCandidate[]>();
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly tracer: Tracer;
  private readonly maxBufferPerSource: number;

  constructor(config: BotApiTransportConfig) {
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.tracer = config.tracer;
    this.maxBufferPerSource = config.maxBufferPerSource ?? DEFAULT_MAX_BUFFER_PER_SOURCE;
  }

  /**
   * Called by the Bot API wiring whenever a `channel_post` update arrives.
   * Returns the validation error when the update is rejected (so the caller
   * can log/count it with full context) or null once safely buffered.
   */
  ingest(input: ChannelPostInput): SocialMessageValidationError | null {
    const candidate: SocialMessageCandidate = {
      sourceId: input.sourceId,
      sourceName: input.sourceName,
      externalMessageId: input.externalMessageId,
      authorUsername: input.authorUsername,
      publishedAt: input.publishedAt,
      rawText: input.rawText,
      rawHtml: input.rawHtml,
      media: input.media,
      links: input.links,
      language: input.language,
    };

    const error = this.validate(candidate);
    if (error) {
      this.metrics.incrementCounter(TRANSPORT_METRICS.MESSAGES_REJECTED, 1, { transportType: this.transportType });
      this.logger.warn('BotApiTransport rejected an invalid channel_post', {
        operation: 'bot_api_transport.ingest',
        sourceId: input.sourceId,
        field: error.field,
        reason: error.message,
      });
      return error;
    }

    const buffer = this.buffers.get(candidate.sourceId) ?? [];
    buffer.push(candidate);
    if (buffer.length > this.maxBufferPerSource) {
      buffer.shift();
    }
    this.buffers.set(candidate.sourceId, buffer);
    return null;
  }

  async fetch(source: TransportSource, cursor?: TransportCursor): Promise<ProviderResult<TransportFetchResult>> {
    const span = this.tracer.startSpan('bot_api_transport.fetch', { sourceId: source.sourceId });
    const startedAt = Date.now();

    const buffered = this.buffers.get(source.sourceId) ?? [];
    const since = cursor?.since;
    const candidates = since ? buffered.filter((m) => m.publishedAt.getTime() > since.getTime()) : buffered;

    const hasMore = cursor?.maxResults !== undefined && candidates.length > cursor.maxResults;
    const messages = cursor?.maxResults !== undefined ? candidates.slice(0, cursor.maxResults) : candidates;
    const remaining = candidates.slice(messages.length);

    this.buffers.set(source.sourceId, remaining);

    span.setAttribute('messages.count', messages.length);
    span.setAttribute('messages.buffered', remaining.length);
    span.end();

    return {
      ok: true,
      data: { messages, hasMore, meta: { sourceId: source.sourceId, buffered: remaining.length } },
      meta: { durationMs: Date.now() - startedAt },
    };
  }

  validate(candidate: SocialMessageCandidate): SocialMessageValidationError | null {
    return validateSocialMessageCandidate(candidate);
  }
}
