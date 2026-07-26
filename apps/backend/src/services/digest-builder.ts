import { Recommendation as RecommendationLabel } from '@careeros/ai';
import type { Recommendation } from './recommendation-service.js';

const ALL_LABELS: readonly RecommendationLabel[] = [
  RecommendationLabel.STRONG_APPLY,
  RecommendationLabel.APPLY,
  RecommendationLabel.MAYBE,
  RecommendationLabel.SKIP,
];

const MAX_AGGREGATE_HIGHLIGHTS = 5;

export interface DigestRecommendationItem {
  readonly rank: number;
  readonly matchResultId: string;
  readonly vacancyTitle: string;
  readonly companyName: string;
  readonly score: number;
  readonly recommendation: RecommendationLabel;
  readonly reasons: readonly string[];
  readonly missingSkills: readonly string[];
  readonly vacancyUrl?: string;
}

/** One entry per possible recommendation label, so formatters can render every section without existence checks. */
export type DigestRecommendationGroups = Readonly<Record<RecommendationLabel, readonly DigestRecommendationItem[]>>;

/** Slim input for a due-soon FollowUp — the caller (MorningDigestService) resolves this from FollowUpService, not from scratch. */
export interface DigestBuilderFollowUpInput {
  readonly id: string;
  readonly applicationId: string;
  readonly type: string | undefined;
  readonly vacancyTitle: string;
  readonly companyName: string;
  readonly scheduledAt: Date;
  readonly daysSinceApplied: number | null;
}

export interface DigestFollowUpItem extends DigestBuilderFollowUpInput {
  readonly recommendedAction: string;
}

export interface Digest {
  readonly title: string;
  readonly generatedAt: Date;
  readonly summary: string;
  readonly newVacancyCount: number;
  readonly topRecommendations: readonly DigestRecommendationItem[];
  readonly groups: DigestRecommendationGroups;
  readonly strengths: readonly string[];
  readonly missingSkills: readonly string[];
  /** Applications overdue or due today for a follow-up nudge (EPIC follow-up automation), sorted soonest first. */
  readonly followUps: readonly DigestFollowUpItem[];
}

export interface DigestBuilderInput {
  readonly generatedAt: Date;
  readonly newVacancyCount: number;
  /** Already filtered, deduplicated, ranked and truncated to the desired Top N by the caller. */
  readonly recommendations: readonly Recommendation[];
  readonly companyNames: ReadonlyMap<string, string>;
  /** Overdue/due-today follow-ups for this user, already resolved by MorningDigestService via FollowUpService. Defaults to none. */
  readonly followUps?: readonly DigestBuilderFollowUpInput[];
}

/**
 * Shapes ranked recommendations into channel-agnostic digest content —
 * title, summary, ranked items, grouped-by-label sections, and aggregate
 * strengths/missing-skills. Produces plain data only; turning that into a
 * Telegram message, email, push payload, etc. is a formatter's job.
 */
export class DigestBuilder {
  build(input: DigestBuilderInput): Digest {
    const items = input.recommendations.map((recommendation, index) =>
      this.toDigestItem(recommendation, index, input.companyNames)
    );

    return {
      title: 'CareerOS Morning Digest',
      generatedAt: input.generatedAt,
      summary: this.buildSummary(input.newVacancyCount, items.length),
      newVacancyCount: input.newVacancyCount,
      topRecommendations: items,
      groups: this.groupByLabel(items),
      strengths: this.collectUnique(items, (item) => item.reasons),
      missingSkills: this.collectUnique(items, (item) => item.missingSkills),
      followUps: [...(input.followUps ?? [])]
        .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
        .map((item) => this.toFollowUpItem(item)),
    };
  }

  private toFollowUpItem(item: DigestBuilderFollowUpInput): DigestFollowUpItem {
    return {
      ...item,
      recommendedAction: item.type === 'interview' ? 'Prepare for your interview' : 'Send a follow-up message',
    };
  }

  private toDigestItem(
    recommendation: Recommendation,
    index: number,
    companyNames: ReadonlyMap<string, string>
  ): DigestRecommendationItem {
    return {
      rank: index + 1,
      matchResultId: recommendation.matchResultId,
      vacancyTitle: recommendation.vacancy.title,
      companyName: companyNames.get(recommendation.vacancy.companyId) ?? 'Unknown Company',
      score: recommendation.score,
      recommendation: recommendation.recommendation,
      reasons: recommendation.strengths,
      missingSkills: recommendation.missingSkills,
      vacancyUrl: undefined,
    };
  }

  private buildSummary(newVacancyCount: number, recommendedCount: number): string {
    return `${newVacancyCount} new vacancies found. ${recommendedCount} recommended for you today.`;
  }

  private groupByLabel(items: readonly DigestRecommendationItem[]): DigestRecommendationGroups {
    const groups = Object.fromEntries(ALL_LABELS.map((label) => [label, [] as DigestRecommendationItem[]])) as Record<
      RecommendationLabel,
      DigestRecommendationItem[]
    >;

    for (const item of items) {
      groups[item.recommendation].push(item);
    }

    return groups;
  }

  private collectUnique(
    items: readonly DigestRecommendationItem[],
    selector: (item: DigestRecommendationItem) => readonly string[]
  ): readonly string[] {
    const seen = new Set<string>();

    for (const item of items) {
      for (const value of selector(item)) {
        seen.add(value);
        if (seen.size >= MAX_AGGREGATE_HIGHLIGHTS) return [...seen];
      }
    }

    return [...seen];
  }
}
