import { Recommendation as RecommendationLabel } from '@careeros/ai';
import type { Digest, DigestRecommendationItem, DigestFollowUpItem } from './digest-builder.js';
import type { DigestFormatter } from './digest-formatter.js';

const LABEL_EMOJI: Record<RecommendationLabel, string> = {
  [RecommendationLabel.STRONG_APPLY]: '🔥',
  [RecommendationLabel.APPLY]: '✅',
  [RecommendationLabel.MAYBE]: '🤔',
  [RecommendationLabel.SKIP]: '⏭️',
};

/** Turns a Digest into the Markdown text CareerOS's Telegram bot delivers. Formatting only — no ranking or filtering decisions. */
export class TelegramDigestFormatter implements DigestFormatter<string> {
  format(digest: Digest): string {
    const lines: string[] = [];

    lines.push(`*${digest.title}*`);
    lines.push(this.formatDate(digest.generatedAt));
    lines.push('');
    lines.push(`New vacancies: ${digest.newVacancyCount}`);

    if (digest.followUps.length > 0) {
      lines.push('');
      lines.push(...this.formatFollowUps(digest.followUps));
    }

    lines.push('');

    if (digest.topRecommendations.length === 0) {
      lines.push('No new recommendations that clear the bar today — check back tomorrow.');
      return lines.join('\n');
    }

    lines.push('*Top recommendations:*');
    for (const item of digest.topRecommendations) {
      lines.push('');
      lines.push(this.formatItem(item));
    }

    return lines.join('\n');
  }

  private formatFollowUps(followUps: readonly DigestFollowUpItem[]): string[] {
    const lines: string[] = [`*Today you have ${followUps.length} follow-up${followUps.length === 1 ? '' : 's'}:*`];

    followUps.forEach((item, index) => {
      lines.push('');
      if (item.type === 'interview') {
        lines.push(`${index + 1}. 📅 Interview reminder — *${item.companyName}*`);
        lines.push(item.vacancyTitle);
      } else {
        lines.push(`${index + 1}. ⏰ *${item.companyName}* — ${item.vacancyTitle}`);
        if (item.daysSinceApplied !== null) {
          lines.push(`Applied ${item.daysSinceApplied} day${item.daysSinceApplied === 1 ? '' : 's'} ago`);
        }
        lines.push(`Recommended: ${item.recommendedAction}`);
      }
    });

    return lines;
  }

  private formatItem(item: DigestRecommendationItem): string {
    const lines = [
      `${item.rank}. ${LABEL_EMOJI[item.recommendation]} *${item.vacancyTitle}* — ${item.companyName}`,
      `${item.score}% match (${item.recommendation})`,
    ];

    if (item.reasons.length > 0) {
      lines.push(`Reasons: ${item.reasons.join(', ')}`);
    }

    if (item.missingSkills.length > 0) {
      lines.push(`Missing: ${item.missingSkills.join(', ')}`);
    }

    if (item.vacancyUrl) {
      lines.push(item.vacancyUrl);
    }

    return lines.join('\n');
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
