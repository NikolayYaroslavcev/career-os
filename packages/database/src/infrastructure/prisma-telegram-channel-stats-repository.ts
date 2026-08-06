import type { Prisma } from '@prisma/client';
import { prisma } from '../client.js';

export interface TelegramChannelStatsData {
  channelId: string;
  totalMessages: number;
  vacanciesExtracted: number;
  extractionRate: number;
  avgConfidence: number;
  spamRate: number;
  duplicateRate: number;
  avgSalaryMin: number | null;
  avgSalaryMax: number | null;
  avgSeniorityRank: number | null;
  avgTechnologiesCount: number;
  brokenMessages: number;
  processingErrors: number;
  successRate: number;
  topTechnologies: unknown;
  lastComputedAt: Date;
}

export type UpsertTelegramChannelStatsInput = Omit<TelegramChannelStatsData, 'channelId' | 'lastComputedAt'>;

const MESSAGE_STATUSES = ['PENDING', 'SKIPPED_PRECHECK', 'EXTRACTING', 'EXTRACTED', 'LOW_CONFIDENCE', 'SPAM', 'FAILED'] as const;
type MessageStatus = (typeof MESSAGE_STATUSES)[number];

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function getTechnologies(extractedFields: unknown): string[] {
  const fields = extractedFields as { technologies?: unknown } | null;
  if (!Array.isArray(fields?.technologies)) return [];
  return fields.technologies.filter((t): t is string => typeof t === 'string' && t.length > 0);
}

export class PrismaTelegramChannelStatsRepository {
  async upsert(channelId: string, data: UpsertTelegramChannelStatsInput): Promise<TelegramChannelStatsData> {
    const topTechnologies = data.topTechnologies as Prisma.InputJsonValue;
    return prisma.telegramChannelStats.upsert({
      where: { channelId },
      create: { channelId, ...data, topTechnologies, lastComputedAt: new Date() },
      update: { ...data, topTechnologies, lastComputedAt: new Date() },
    });
  }

  async findByChannelId(channelId: string): Promise<TelegramChannelStatsData | null> {
    return prisma.telegramChannelStats.findUnique({ where: { channelId } });
  }

  async findAll(): Promise<TelegramChannelStatsData[]> {
    return prisma.telegramChannelStats.findMany();
  }

  /**
   * Computes deterministic per-channel metrics straight from the existing
   * SocialMessage / MessageExtraction / VacancySource tables — no new
   * tracking, just aggregating what the V2 pipeline already writes. Kept in
   * this repository (rather than a backend service doing raw Prisma queries)
   * so the reporting/aggregation logic stays in the same layer as every
   * other Prisma-backed repository in this package.
   */
  async computeChannelMetrics(channelUsername: string): Promise<UpsertTelegramChannelStatsInput> {
    const [statusGroups, extractions, processingErrors, primarySources, totalSources] = await Promise.all([
      prisma.socialMessage.groupBy({
        by: ['processingStatus'],
        where: { platform: 'TELEGRAM', sourceId: channelUsername },
        _count: { _all: true },
      }),
      prisma.messageExtraction.findMany({
        where: { message: { platform: 'TELEGRAM', sourceId: channelUsername } },
        select: { status: true, deterministicConfidence: true, salaryMin: true, salaryMax: true, extractedFields: true },
      }),
      prisma.socialMessage.count({
        where: { platform: 'TELEGRAM', sourceId: channelUsername, processingError: { not: null } },
      }),
      prisma.vacancySource.count({
        where: { providerId: 'telegram', externalId: { startsWith: `${channelUsername}:` }, isPrimary: true },
      }),
      prisma.vacancySource.count({
        where: { providerId: 'telegram', externalId: { startsWith: `${channelUsername}:` } },
      }),
    ]);

    const counts = Object.fromEntries(MESSAGE_STATUSES.map((s) => [s, 0])) as Record<MessageStatus, number>;
    for (const group of statusGroups) {
      counts[group.processingStatus as MessageStatus] = group._count._all;
    }
    const totalMessages = MESSAGE_STATUSES.reduce((sum, s) => sum + counts[s], 0);
    const attempted = counts.EXTRACTED + counts.LOW_CONFIDENCE + counts.SPAM + counts.FAILED;

    const successExtractions = extractions.filter((e) => e.status === 'SUCCESS');
    const technologyTally = new Map<string, number>();
    for (const e of successExtractions) {
      for (const tech of getTechnologies(e.extractedFields)) {
        technologyTally.set(tech, (technologyTally.get(tech) ?? 0) + 1);
      }
    }
    const topTechnologies = [...technologyTally.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([technology, count]) => ({ technology, count }));

    return {
      totalMessages,
      vacanciesExtracted: counts.EXTRACTED,
      extractionRate: totalMessages > 0 ? counts.EXTRACTED / totalMessages : 0,
      avgConfidence: average(extractions.map((e) => e.deterministicConfidence)) ?? 0,
      spamRate: totalMessages > 0 ? counts.SPAM / totalMessages : 0,
      // Share of this channel's VacancySource rows that matched an already-existing
      // canonical Vacancy (isPrimary=false) rather than creating a new one —
      // how often this channel is reposting content another source already surfaced.
      duplicateRate: totalSources > 0 ? (totalSources - primarySources) / totalSources : 0,
      avgSalaryMin: average(extractions.map((e) => e.salaryMin).filter((v): v is number => v != null)),
      avgSalaryMax: average(extractions.map((e) => e.salaryMax).filter((v): v is number => v != null)),
      // No deterministic numeric seniority-rank mapping exists elsewhere in the
      // codebase (seniority is a free-text label) — left unset rather than
      // inventing a new ranking scheme for this alone.
      avgSeniorityRank: null,
      avgTechnologiesCount: average(successExtractions.map((e) => getTechnologies(e.extractedFields).length)) ?? 0,
      brokenMessages: counts.FAILED,
      processingErrors,
      // Share of AI-attempted messages (i.e. past the deterministic precheck)
      // that resulted in a usable extraction — distinct from extractionRate,
      // which is measured against every message including precheck-skipped ones.
      successRate: attempted > 0 ? counts.EXTRACTED / attempted : 0,
      topTechnologies,
    };
  }
}
