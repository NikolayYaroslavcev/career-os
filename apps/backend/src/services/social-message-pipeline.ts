import type { SocialMessage, SocialMessageRepository, SocialPlatform } from '@careeros/career';
import { MessageProcessingStatus } from '@careeros/career';
import type { Logger, MetricsCollector } from '@careeros/providers';
import { runTelegramPrecheck } from '@careeros/providers';
import { MessageExtractionEngine, MessageExtractionStatus } from '@careeros/ai';

export interface SocialMessagePipelineResult {
  readonly processed: number;
  readonly skippedPrecheck: number;
  readonly extracted: number;
  readonly lowConfidence: number;
  readonly spam: number;
  readonly failed: number;
}

const PIPELINE_METRICS = {
  SKIPPED_PRECHECK: 'social_message.pipeline.skipped_precheck',
  PROCESSED: 'social_message.pipeline.processed',
  DURATION: 'social_message.pipeline.duration_ms',
} as const;

const EMPTY_RESULT: SocialMessagePipelineResult = { processed: 0, skippedPrecheck: 0, extracted: 0, lowConfidence: 0, spam: 0, failed: 0 };

function toSocialMessageStatus(status: MessageExtractionStatus): MessageProcessingStatus {
  switch (status) {
    case MessageExtractionStatus.SUCCESS:
      return MessageProcessingStatus.EXTRACTED;
    case MessageExtractionStatus.LOW_CONFIDENCE:
      return MessageProcessingStatus.LOW_CONFIDENCE;
    case MessageExtractionStatus.SPAM:
      return MessageProcessingStatus.SPAM;
    case MessageExtractionStatus.PARSE_ERROR:
    case MessageExtractionStatus.PROVIDER_ERROR:
      return MessageProcessingStatus.FAILED;
  }
}

/**
 * ADR-032 Phase 4/5 — the pending-message loop `MessageExtractionEngine`
 * (Phase 3) was built for but never wired to. Turns PENDING `SocialMessage`
 * rows into `MessageExtraction` rows, and nothing else: no Vacancy
 * normalization, no dedup, no persistence beyond `SocialMessage.processingStatus`
 * (that's the `SocialMessageNormalizer` + Mapper/Normalizer cutover, Phase 6+).
 *
 * Runs a cheap deterministic precheck (the same keyword gate V1's
 * TelegramFetcher already used, now shared via `runTelegramPrecheck`) before
 * calling the AI engine at all — messages that obviously aren't job posts are
 * marked SKIPPED_PRECHECK and never cost a token, which is most of this
 * pipeline's contribution to ADR's token-optimization goal.
 */
export class SocialMessagePipeline {
  constructor(
    private readonly socialMessageRepository: SocialMessageRepository,
    private readonly messageExtractionEngine: MessageExtractionEngine,
    private readonly logger: Logger,
    private readonly metrics: MetricsCollector,
  ) {}

  async processPendingBySource(platform: SocialPlatform, sourceId: string, limit = 50): Promise<SocialMessagePipelineResult> {
    const messages = await this.socialMessageRepository.findPendingBySource(platform, sourceId, limit);
    return this.processMessages(messages);
  }

  /** General sweep across all sources — a scheduled-job entry point independent of any one provider's sync cadence. */
  async processPending(limit = 100): Promise<SocialMessagePipelineResult> {
    const messages = await this.socialMessageRepository.findPending(limit);
    return this.processMessages(messages);
  }

  private async processMessages(messages: readonly SocialMessage[]): Promise<SocialMessagePipelineResult> {
    if (messages.length === 0) return EMPTY_RESULT;

    const startedAt = Date.now();
    let skippedPrecheck = 0;
    let extracted = 0;
    let lowConfidence = 0;
    let spam = 0;
    let failed = 0;

    for (const message of messages) {
      const precheck = runTelegramPrecheck(message.rawText);
      if (!precheck.accepted) {
        const reason = `${precheck.category}${precheck.ruleId ? `:${precheck.ruleId}` : ''}${precheck.matchedText ? ` (matched: "${precheck.matchedText}")` : ''}`;
        await this.socialMessageRepository.updateStatus(message.id, MessageProcessingStatus.SKIPPED_PRECHECK, reason);
        skippedPrecheck++;
        this.metrics.incrementCounter(PIPELINE_METRICS.SKIPPED_PRECHECK, 1, {
          platform: message.platform,
          sourceId: message.sourceId,
          category: precheck.category,
        });
        continue;
      }

      await this.socialMessageRepository.updateStatus(message.id, MessageProcessingStatus.EXTRACTING);

      try {
        const { extraction } = await this.messageExtractionEngine.extract(message);
        const nextStatus = toSocialMessageStatus(extraction.status);
        await this.socialMessageRepository.updateStatus(message.id, nextStatus, extraction.errorMessage ?? null);

        if (nextStatus === MessageProcessingStatus.EXTRACTED) extracted++;
        else if (nextStatus === MessageProcessingStatus.LOW_CONFIDENCE) lowConfidence++;
        else if (nextStatus === MessageProcessingStatus.SPAM) spam++;
        else failed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await this.socialMessageRepository.updateStatus(message.id, MessageProcessingStatus.FAILED, errorMessage);
        failed++;
        this.logger.error('SocialMessage pipeline extraction threw', error instanceof Error ? error : undefined, {
          operation: 'social_message.pipeline',
          messageId: message.id,
        });
      }
    }

    const durationMs = Date.now() - startedAt;
    const processed = messages.length;
    this.metrics.incrementCounter(PIPELINE_METRICS.PROCESSED, processed);
    this.metrics.recordHistogram(PIPELINE_METRICS.DURATION, durationMs);
    this.logger.info('SocialMessage pipeline batch completed', {
      operation: 'social_message.pipeline',
      processed,
      skippedPrecheck,
      extracted,
      lowConfidence,
      spam,
      failed,
      durationMs,
    });

    return { processed, skippedPrecheck, extracted, lowConfidence, spam, failed };
  }
}
