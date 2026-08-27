import type { SocialMessage } from '@careeros/career';
import { SocialPlatform, VacancySource } from '@careeros/career';
import type { MessageExtraction, ExtractedVacancyFields } from '@careeros/ai';
import { MessageExtractionStatus } from '@careeros/ai';
import type { RawJob, Logger } from '@careeros/providers';
import { SocialMessageMapper, DefaultNormalizationPipeline } from '@careeros/providers';
import type { SyncSchedulerService } from './sync-scheduler-service.js';

const LINKEDIN_FEED_SOURCE_PREFIX = 'linkedin-feed:';

/** Inverse of `sourceId: linkedin-feed:${workspaceId}` (social-message-ingest-routes.ts). */
export function parseLinkedInFeedWorkspaceId(sourceId: string): string | null {
  if (!sourceId.startsWith(LINKEDIN_FEED_SOURCE_PREFIX)) return null;
  const workspaceId = sourceId.slice(LINKEDIN_FEED_SOURCE_PREFIX.length);
  return workspaceId.length > 0 ? workspaceId : null;
}

/**
 * SocialMessage + its qualifying MessageExtraction -> RawJob, mirroring the V2
 * (extraction-driven) branch of TelegramFetcher.buildRawJob(), with one
 * deliberate divergence: Telegram's `postUrl` fallback (t.me/<channel>/<id>)
 * is always a real, resolvable permalink, but LinkedIn's SDUI feed markup
 * exposes no equivalent (confirmed live 2026-08-26 — a postId-derived
 * /feed/update/ URL 404s), so there is no safe last-resort URL to fall back
 * to here; `url` is left undefined rather than fabricated.
 *
 * `message.links` (real hrefs the extension read straight out of the DOM —
 * a Job Card's linkedin.com/jobs/view/ link sorted first, see extract.ts's
 * extractLinks()) is preferred over `fields.links` (the AI's own re-parse of
 * plain-text URLs in rawText, which can't see a hyperlinked anchor's href at
 * all when its visible text isn't the URL itself, and never sees a Job
 * Card's URL since that's a structural attachment, not post text).
 */
function buildRawJob(message: SocialMessage, fields: ExtractedVacancyFields): RawJob {
  return {
    sourceId: message.externalMessageId,
    title: fields.title || 'Untitled vacancy',
    description: message.rawText,
    companyName: fields.company ?? '',
    location: fields.city || fields.country || '',
    salary: fields.salaryMin != null || fields.salaryMax != null
      ? { from: fields.salaryMin ?? undefined, to: fields.salaryMax ?? undefined, currency: fields.currency ?? 'USD', period: 'monthly' }
      : undefined,
    experienceLevel: fields.seniority ?? undefined,
    technologies: [...new Set([...fields.technologies, ...fields.skills])],
    url: message.links[0] ?? fields.links[0],
    publishedAt: message.publishedAt,
    fetchedAt: new Date(),
    remote: fields.remoteType ? fields.remoteType.toLowerCase().includes('remote') : undefined,
    employmentType: fields.employmentType ?? undefined,
    extensions: { requirements: fields.requirements, responsibilities: fields.responsibilities },
  };
}

export interface LinkedInFeedDiscoveryResult {
  readonly created: boolean;
  readonly reason?: string;
}

/**
 * The LinkedIn-Feed-specific half of "SocialMessage -> VacancySource" — the
 * counterpart to what TelegramFetcher.buildRawJob() + SocialMessageMapper +
 * SocialMessageNormalizer + ProviderRegistry's periodic sync do for Telegram.
 * Deliberately NOT a ProviderRegistry/DefaultProviderJob provider: that model
 * assumes one workspace-agnostic job pool polled on a schedule (true for HH,
 * Greenhouse, Telegram's public channels, ...), but LinkedIn Feed content is
 * inherently per-workspace-private and arrives push-based from the extension.
 * Instead this is invoked directly from SocialMessagePipeline's onExtracted
 * hook (see container.ts), reusing the exact same confidence-gated
 * MessageExtraction -> Mapper -> DefaultNormalizationPipeline -> VacancySource
 * pipeline every other provider's NormalizedVacancy already goes through
 * (SyncSchedulerService.ingestVacancyForWorkspace), rather than a second
 * bespoke ingestion path.
 */
export class LinkedInFeedDiscoveryService {
  private readonly mapper = new SocialMessageMapper();
  private readonly normalizationPipeline = new DefaultNormalizationPipeline();

  constructor(
    private readonly syncScheduler: Pick<SyncSchedulerService, 'ingestVacancyForWorkspace'>,
    private readonly logger: Logger,
  ) {}

  async discoverFromMessage(message: SocialMessage, extraction: MessageExtraction): Promise<LinkedInFeedDiscoveryResult> {
    if (message.platform !== SocialPlatform.LINKEDIN) {
      return { created: false, reason: 'not-linkedin' };
    }

    // Same gate createTelegramExtractionLookup already applies before a
    // Telegram message reaches Vacancy sync: only a SUCCESS-status extraction
    // with at least a title or company qualifies. Everything else (a normal
    // post, a repost, an article, LOW_CONFIDENCE/SPAM/PARSE_ERROR/PROVIDER_ERROR)
    // stops here and never becomes a VacancySource.
    if (extraction.status !== MessageExtractionStatus.SUCCESS) {
      return { created: false, reason: `extraction-status-${extraction.status.toLowerCase()}` };
    }

    const fields = extraction.extractedFields;
    if (!fields.title && !fields.company) {
      return { created: false, reason: 'insufficient-fields' };
    }

    const workspaceId = parseLinkedInFeedWorkspaceId(message.sourceId);
    if (!workspaceId) {
      this.logger.warn('LinkedIn Feed discovery: unparseable sourceId, skipping', {
        operation: 'linkedin_feed.discovery',
        sourceId: message.sourceId,
      });
      return { created: false, reason: 'unparseable-source' };
    }

    const rawJob = buildRawJob(message, fields);
    const mapped = this.mapper.map(rawJob);
    const normalized = this.normalizationPipeline.normalize(VacancySource.LINKEDIN_FEED, mapped);

    const created = await this.syncScheduler.ingestVacancyForWorkspace(normalized, workspaceId);

    this.logger.info('LinkedIn Feed discovery completed', {
      operation: 'linkedin_feed.discovery',
      messageId: message.id,
      workspaceId,
      created,
    });

    return { created };
  }
}
