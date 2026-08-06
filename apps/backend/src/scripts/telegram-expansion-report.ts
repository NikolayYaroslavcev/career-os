import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import { prisma, PrismaTelegramChannelRepository } from '@careeros/database';
import { computeChannelQualityScore } from '../services/telegram-channel-stats-service.js';

async function main(): Promise<void> {
  const repo = new PrismaTelegramChannelRepository();
  const channels = await repo.findAll();

  const rows = channels.map((c) => {
    const s = c.stats;
    return {
      username: c.username,
      category: c.category ?? '-',
      totalMessages: s?.totalMessages ?? 0,
      skippedPrecheck: undefined as number | undefined,
      extracted: s?.vacanciesExtracted ?? 0,
      spamRate: s ? `${(s.spamRate * 100).toFixed(0)}%` : '-',
      duplicateRate: s ? `${(s.duplicateRate * 100).toFixed(0)}%` : '-',
      successRate: s ? `${(s.successRate * 100).toFixed(0)}%` : '-',
      avgConfidence: s ? s.avgConfidence.toFixed(0) : '-',
      broken: s?.brokenMessages ?? 0,
      qualityScore: s ? computeChannelQualityScore(s) : 0,
    };
  });

  // Pull raw per-status counts per channel for the "skipped by precheck" column (not on TelegramChannelStats' quick view above).
  const statusRows = await prisma.socialMessage.groupBy({
    by: ['sourceId', 'processingStatus'],
    where: { platform: 'TELEGRAM' },
    _count: { _all: true },
  });
  const skippedByChannel = new Map<string, number>();
  for (const r of statusRows) {
    if (r.processingStatus === 'SKIPPED_PRECHECK') skippedByChannel.set(r.sourceId, r._count._all);
  }
  for (const row of rows) row.skippedPrecheck = skippedByChannel.get(row.username) ?? 0;

  rows.sort((a, b) => b.qualityScore - a.qualityScore);

  console.log('\n=== Per-channel report (sorted by quality score) ===');
  console.log(
    'username'.padEnd(22), 'category'.padEnd(10), 'msgs'.padEnd(5), 'skip'.padEnd(5), 'extr'.padEnd(5),
    'spam%'.padEnd(6), 'dup%'.padEnd(6), 'succ%'.padEnd(6), 'conf'.padEnd(5), 'broken'.padEnd(7), 'quality'
  );
  for (const r of rows) {
    console.log(
      r.username.padEnd(22), r.category.padEnd(10), String(r.totalMessages).padEnd(5), String(r.skippedPrecheck).padEnd(5),
      String(r.extracted).padEnd(5), r.spamRate.padEnd(6), r.duplicateRate.padEnd(6), r.successRate.padEnd(6),
      r.avgConfidence.padEnd(5), String(r.broken).padEnd(7), r.qualityScore
    );
  }

  const totalMessages = rows.reduce((s, r) => s + r.totalMessages, 0);
  const totalExtracted = rows.reduce((s, r) => s + r.extracted, 0);
  const totalSkipped = rows.reduce((s, r) => s + (r.skippedPrecheck ?? 0), 0);

  const telegramSourceCount = await prisma.vacancySource.count({ where: { providerId: 'telegram' } });
  const telegramPrimaryCount = await prisma.vacancySource.count({ where: { providerId: 'telegram', isPrimary: true } });
  const distinctTelegramVacancies = await prisma.vacancySource.findMany({
    where: { providerId: 'telegram' },
    select: { vacancyId: true },
    distinct: ['vacancyId'],
  });
  const totalVacancies = await prisma.vacancy.count();
  const totalVacancySources = await prisma.vacancySource.count();

  console.log('\n=== Overall ===');
  console.log('Total telegram messages ingested (this run):', totalMessages);
  console.log('Skipped by precheck:', totalSkipped);
  console.log('Extracted (became candidate vacancies):', totalExtracted);
  console.log('Telegram VacancySource rows total:', telegramSourceCount);
  console.log('  primary (unique new vacancy):', telegramPrimaryCount);
  console.log('  non-primary (matched existing vacancy = duplicate):', telegramSourceCount - telegramPrimaryCount);
  console.log('Distinct vacancies with a telegram source:', distinctTelegramVacancies.length);
  console.log('Total vacancies in DB (all providers):', totalVacancies);
  console.log('Total vacancy sources in DB (all providers):', totalVacancySources);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
