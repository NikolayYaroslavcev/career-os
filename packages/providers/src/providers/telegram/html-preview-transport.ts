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
import type { Tracer } from '../../observability/tracer.js';
import { ProviderErrorType } from '../../errors/provider-errors.js';
import { validateSocialMessageCandidate } from '../../shared/social-message-validation.js';
import { TelegramFetcher } from './telegram-fetcher.js';
import type { TelegramRawMessage } from './telegram-types.js';

export interface HtmlPreviewTransportConfig {
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
  /**
   * Reuse the exact TelegramFetcher instance the V1 provider (createTelegramProvider())
   * already uses, so scraping/rate-limiting state (resilientFetch's per-URL
   * throttle) is shared rather than duplicated. Constructed internally with an
   * empty static channel list when omitted — fetchRawMessages() always takes
   * the channel explicitly per call, so no static list is needed here.
   */
  readonly fetcher?: TelegramFetcher;
}

function toCandidate(msg: TelegramRawMessage): SocialMessageCandidate {
  return {
    sourceId: msg.channel,
    externalMessageId: msg.messageId,
    publishedAt: msg.publishedAt,
    rawText: msg.text,
    rawHtml: msg.textHtml,
    links: msg.links,
  };
}

/**
 * PULL transport that reuses TelegramFetcher's existing `/s/<channel>`
 * scraping (via the public fetchRawMessages() entry point it exposes) and
 * carries each parsed message's fields over 1:1 into a SocialMessageCandidate.
 * Deliberately skips TelegramFetcher.search()'s isLikelyVacancyPost
 * classification and buildRawJob() regex extraction — those are V1 Mapper
 * responsibilities; this transport's only job is producing candidates for the
 * AI extraction pipeline to look at later.
 */
export class HtmlPreviewTransport implements SocialMessageTransport {
  readonly transportType = 'HTML_PREVIEW';
  readonly capability: TransportCapability = 'PULL';

  private readonly fetcher: TelegramFetcher;
  private readonly logger: Logger;
  private readonly tracer: Tracer;

  constructor(config: HtmlPreviewTransportConfig) {
    this.logger = config.logger;
    this.tracer = config.tracer;
    this.fetcher =
      config.fetcher ??
      new TelegramFetcher({ channels: [], logger: config.logger, metrics: config.metrics, tracer: config.tracer });
  }

  async fetch(source: TransportSource, cursor?: TransportCursor): Promise<ProviderResult<TransportFetchResult>> {
    const span = this.tracer.startSpan('html_preview_transport.fetch', { sourceId: source.sourceId });
    const startedAt = Date.now();

    try {
      const rawMessages = await this.fetcher.fetchRawMessages(source.sourceId);
      // Service messages (channel created/photo updated/pinned) carry no
      // content — structurally not a message at all, not a vacancy judgment.
      let messages = rawMessages.filter((m) => !m.isServiceMessage).map(toCandidate);

      if (cursor?.since) {
        const since = cursor.since;
        messages = messages.filter((m) => m.publishedAt.getTime() > since.getTime());
      }

      const hasMore = cursor?.maxResults !== undefined && messages.length > cursor.maxResults;
      if (cursor?.maxResults !== undefined) {
        messages = messages.slice(0, cursor.maxResults);
      }

      span.setAttribute('messages.count', messages.length);
      span.end();

      return {
        ok: true,
        data: { messages, hasMore, meta: { channel: source.sourceId } },
        meta: { durationMs: Date.now() - startedAt },
      };
    } catch (error) {
      span.setAttribute('error', true);
      span.end();
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn('HtmlPreviewTransport fetch failed', {
        operation: 'html_preview_transport.fetch',
        sourceId: source.sourceId,
        error: message,
      });
      return {
        ok: false,
        error: ProviderErrorType.NETWORK_ERROR,
        message,
        retryable: true,
        meta: { durationMs: Date.now() - startedAt },
      };
    }
  }

  validate(candidate: SocialMessageCandidate): SocialMessageValidationError | null {
    return validateSocialMessageCandidate(candidate);
  }
}
