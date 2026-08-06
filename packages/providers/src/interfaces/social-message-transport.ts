import type { ProviderResult } from './result.js';
import type { TransportCapability } from './transport-capability.js';

/**
 * Where a transport fetches from. Deliberately platform-agnostic: `sourceId`
 * is whatever that platform natively calls it (a Telegram channel username, a
 * Discord channel ID, a subreddit) — the same string that ends up as
 * SocialMessage.sourceId. `config` carries anything transport-specific (e.g.
 * a Telegram chatId once the bot is added as admin) opaquely — the registry
 * and orchestrator never need to know its shape.
 */
export interface TransportSource {
  readonly sourceId: string;
  readonly sourceName?: string;
  readonly config?: Record<string, unknown>;
}

export interface TransportCursor {
  readonly since?: Date;
  readonly maxResults?: number;
}

/**
 * Raw output of a transport, before it becomes a persisted SocialMessage.
 * Deliberately excludes `platform`/`transport`/`contentHash`: platform is
 * fixed per-provider (the orchestrator attaches it, not the transport), and
 * contentHash is a pure function of `rawText` computed once centrally so
 * every transport doesn't reimplement the same hash.
 */
export interface SocialMessageCandidate {
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

export interface TransportFetchResult {
  readonly messages: readonly SocialMessageCandidate[];
  readonly hasMore: boolean;
  readonly meta: Record<string, unknown>;
}

export interface SocialMessageValidationError {
  readonly field: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

/**
 * A transport's ONLY job is producing validated SocialMessageCandidates for
 * one source. It must not map, normalize, extract, deduplicate, or persist —
 * everything from SocialMessage onward (AI extraction, dedup, recommendation,
 * persistence) is transport-agnostic and lives elsewhere in the pipeline.
 * Implementations are expected to reuse existing provider infrastructure
 * (resilientFetch, RetryPolicy, the rate-limit TokenBucket, Logger/
 * MetricsCollector/Tracer) rather than reimplementing HTTP/retry/rate-limit
 * logic per transport.
 */
export interface SocialMessageTransport {
  /**
   * String, not an imported enum: packages/providers has no dependency on
   * @careeros/career (mirrors the existing local `VacancySource = string` in
   * types/provider.ts) so new transport kinds never require a cross-package
   * change here. Values are expected to match @careeros/career's
   * `TransportType` enum ('HTML_PREVIEW', 'BOT_API', ...) — that mapping is
   * enforced at the persistence boundary (SocialMessageRepository), not here.
   */
  readonly transportType: string;
  readonly capability: TransportCapability;
  fetch(source: TransportSource, cursor?: TransportCursor): Promise<ProviderResult<TransportFetchResult>>;
  validate(candidate: SocialMessageCandidate): SocialMessageValidationError | null;
}
