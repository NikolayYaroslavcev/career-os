import { createUserId } from '@careeros/career';
import type { CompanyRepository, NotificationHistoryRepository } from '@careeros/career';
import { Recommendation as RecommendationLabel } from '@careeros/ai';
import type { MetricsCollector } from '@careeros/providers';
import type { IntelligenceWorkflowService, IntelligenceWorkflowStats } from './intelligence-workflow-service.js';
import type { Recommendation } from './recommendation-service.js';
import { DigestBuilder, type Digest } from './digest-builder.js';

/** Only the slice of IntelligenceWorkflowService this feature needs — keeps tests decoupled from its full constructor and follows Interface Segregation. */
export type WorkflowRunner = Pick<IntelligenceWorkflowService, 'run'>;

const DEFAULT_TOP_N = 5;
const DEFAULT_VISIBLE_LABELS: readonly RecommendationLabel[] = [
  RecommendationLabel.STRONG_APPLY,
  RecommendationLabel.APPLY,
];
export const DIGEST_CHANNEL_TELEGRAM = 'telegram';

export interface MorningDigestParams {
  readonly userId: string;
  readonly searchProfileId?: string;
  readonly providerId?: string;
  /** How many recommendations to include, ranked by score. Defaults to 5. */
  readonly topN?: number;
  /** Which recommendation labels are digest-worthy. Defaults to Strong Apply + Apply. */
  readonly visibleLabels?: readonly RecommendationLabel[];
  /** Delivery channel used for duplicate-notification lookups. Defaults to 'telegram'. */
  readonly channel?: string;
}

export interface MorningDigestStats {
  readonly workflow: IntelligenceWorkflowStats;
  readonly totalRecommendations: number;
  readonly eligibleRecommendations: number;
  readonly newRecommendations: number;
  readonly includedRecommendations: number;
  readonly digestDurationMs: number;
}

export interface MorningDigestResult {
  readonly digest: Digest;
  readonly recommendations: readonly Recommendation[];
  readonly stats: MorningDigestStats;
}

/**
 * Orchestrates Scheduler -> Search Profile -> Provider Search -> AI Matching
 * -> Recommendation Ranking -> Digest Builder. Delegates all of that except
 * ranking/grouping to IntelligenceWorkflowService and DigestBuilder — this
 * class owns none of the search or AI logic, and never talks to Telegram.
 */
export class MorningDigestService {
  constructor(
    private readonly intelligenceWorkflowService: WorkflowRunner,
    private readonly notificationHistoryRepository: NotificationHistoryRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly digestBuilder: DigestBuilder,
    private readonly metrics: MetricsCollector
  ) {}

  async generate(params: MorningDigestParams): Promise<MorningDigestResult> {
    const startedAt = Date.now();
    const topN = params.topN ?? DEFAULT_TOP_N;
    const visibleLabels = params.visibleLabels ?? DEFAULT_VISIBLE_LABELS;
    const channel = params.channel ?? DIGEST_CHANNEL_TELEGRAM;
    const userId = createUserId(params.userId);

    // The digest is a scheduled background job, not a live browser request —
    // unlike /intelligence/search it can afford to wait for AI scoring, and
    // needs it: an empty digest with no scores would defeat the point.
    const workflowResult = await this.intelligenceWorkflowService.run({
      userId: params.userId,
      searchProfileId: params.searchProfileId,
      providerId: params.providerId,
      awaitAiMatching: true,
    });
    this.metrics.recordHistogram('careeros.digest.workflow_duration_ms', workflowResult.stats.totalDurationMs);

    const eligible = workflowResult.recommendations.filter((recommendation) =>
      visibleLabels.includes(recommendation.recommendation)
    );

    const unnotifiedIds = new Set(
      await this.notificationHistoryRepository.filterUnnotified(
        userId,
        eligible.map((recommendation) => recommendation.matchResultId),
        channel
      )
    );
    const fresh = eligible.filter((recommendation) => unnotifiedIds.has(recommendation.matchResultId));

    // Already sorted by score (IntelligenceWorkflowService -> RecommendationService.build), so ranking is a plain slice.
    const ranked = fresh.slice(0, topN);

    const companyNames = await this.resolveCompanyNames(ranked);

    const digest = this.digestBuilder.build({
      generatedAt: new Date(),
      newVacancyCount: workflowResult.stats.providerSearch.persisted,
      recommendations: ranked,
      companyNames,
    });

    const digestDurationMs = Date.now() - startedAt;
    this.metrics.recordHistogram('careeros.digest.generation_duration_ms', digestDurationMs);
    this.metrics.incrementCounter('careeros.digest.recommendation_count', ranked.length);

    return {
      digest,
      recommendations: ranked,
      stats: {
        workflow: workflowResult.stats,
        totalRecommendations: workflowResult.recommendations.length,
        eligibleRecommendations: eligible.length,
        newRecommendations: fresh.length,
        includedRecommendations: ranked.length,
        digestDurationMs,
      },
    };
  }

  private async resolveCompanyNames(recommendations: readonly Recommendation[]): Promise<ReadonlyMap<string, string>> {
    const uniqueCompanyIds = [...new Set(recommendations.map((recommendation) => recommendation.vacancy.companyId))];

    const entries = await Promise.all(
      uniqueCompanyIds.map(async (companyId) => {
        const company = await this.companyRepository.findById(companyId);
        return [companyId as string, company?.name ?? 'Unknown Company'] as const;
      })
    );

    return new Map(entries);
  }
}
