import type { ProviderInfo } from '../../interfaces/provider-info.js';
import type { ProviderCapabilities } from '../../interfaces/provider-capabilities.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import type { TransportManager } from '../../transport/transport-manager.js';
import { DefaultProviderJob } from '../../interfaces/default-provider-job.js';
import { TelegramFetcher } from './telegram-fetcher.js';
import { SocialMessageMapper } from './social-message-mapper.js';
import type { TelegramExtractionLookup } from './social-message-mapper.js';
import { SocialMessageNormalizer } from './social-message-normalizer.js';
import { TelegramSyncStrategy } from './telegram-sync-strategy.js';

// Provider category: COMMUNITY — a public, user-run channel feed rather than
// an official job board or ATS API. There's no `type` field on ProviderInfo
// (every other provider is either an ATS or a job board, so the distinction
// was never modeled) — recorded here as documentation instead of adding a
// codebase-wide field for a single provider.
export const TELEGRAM_PROVIDER_INFO: ProviderInfo = {
  id: 'telegram',
  name: 'Telegram',
  version: '1.0.0',
  supportedCountries: ['RU', 'BY', 'KZ', 'UA', 'GE', 'AM', 'AZ', 'KG', 'UZ', 'TJ', 'MD'],
  supportedLanguages: ['ru', 'en'],
  auth: { type: 'none', requiresApiKey: false, requiresOAuth: false, optional: false },
  supportsRemote: true,
  baseUrl: 'https://t.me',
  docsUrl: 'https://core.telegram.org/widgets/post',
};

export const TELEGRAM_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  // The `/s/` preview always returns its current window regardless of the
  // search criteria passed in — there is no server-side keyword/location
  // filter to hand off to — so these are honestly false rather than claimed
  // and silently ignored.
  search: { supported: true, maxResults: 200, supportsKeyword: false, supportsLocation: false, supportsTechnology: false },
  pagination: { strategy: 'none', maxPageSize: 200, defaultPageSize: 200 },
  // No deep pagination exists for channel history via the preview page, so
  // fullSync isn't meaningfully different from incremental — see
  // telegram-sync-strategy.ts. A short interval compensates for the shallow
  // (~20 message) window each sync can see per channel.
  sync: { incremental: true, fullSync: false, minSyncIntervalMs: 15 * 60 * 1000 },
  filtering: { experienceLevels: ['intern', 'junior', 'middle', 'senior', 'lead', 'principal'], salaryFilter: false, remoteFilter: false, technologyFilter: false, dateFilter: false },
  rateLimits: { perMinute: 30, providesHeaders: false, providesInfo: false },
  // Rule-based extraction from free-text posts — company/salary are
  // best-effort (often absent or unlabeled), so left false rather than
  // overclaimed, same reasoning as habr-career-provider.ts.
  characteristics: { avgResponseTimeMs: 1500, fullDescription: true, salaryData: false, companyDetails: false },
};

export interface TelegramProviderConfig {
  /** Bare channel usernames, no `@`/`t.me/` prefix (e.g. ["remoteit", "it_vacancy"]). */
  readonly channels: readonly string[];
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
  /** Dynamic channel provider. When provided, fetcher loads channels from DB
   *  at sync time instead of using the static `channels` array. */
  readonly channelProvider?: () => Promise<readonly string[]>;
  /**
   * Phase 2.5 (ADR-032 addendum): when provided, the fetcher routes message
   * fetching through TransportManager instead of scraping `t.me/s/<channel>`
   * directly. Must be a TransportManager with a 'telegram' PULL transport
   * registered (HtmlPreviewTransport) — see registerSocialMessageTransports()
   * in apps/backend/src/container.ts.
   */
  readonly transportManager?: TransportManager;
  /**
   * ADR-032 Phase 4/5 — passed straight through to TelegramFetcher. This is
   * the single seam that makes this the V2 provider: TelegramFetcher,
   * SocialMessageMapper, SocialMessageNormalizer, and TelegramSyncStrategy
   * below are otherwise identical to V1's wiring.
   */
  readonly extractionLookup?: TelegramExtractionLookup;
}

export function createTelegramProvider(config: TelegramProviderConfig): DefaultProviderJob {
  return new DefaultProviderJob(
    TELEGRAM_PROVIDER_INFO,
    TELEGRAM_PROVIDER_CAPABILITIES,
    new TelegramFetcher({
      channels: config.channels,
      logger: config.logger,
      metrics: config.metrics,
      tracer: config.tracer,
      channelProvider: config.channelProvider,
      transportManager: config.transportManager,
      extractionLookup: config.extractionLookup,
    }),
    new SocialMessageMapper(),
    new SocialMessageNormalizer(),
    new TelegramSyncStrategy(),
  );
}
