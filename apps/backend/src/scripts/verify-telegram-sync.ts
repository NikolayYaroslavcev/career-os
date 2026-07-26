import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import { loadConfig } from '@careeros/shared';
import { prisma } from '@careeros/database';
import { buildContainer } from '../container.js';

const WORKSPACE_ID = '836e9446-e242-4a46-85a3-eff2311413c6';

async function main(): Promise<void> {
  console.log('=== Telegram Provider Production Verification ===');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`TELEGRAM_CHANNELS env: ${process.env.TELEGRAM_CHANNELS}`);

  const config = loadConfig();
  const container = buildContainer(config);

  // 1. Provider registration
  console.log('\n--- Registration ---');
  let registered = true;
  try {
    const provider = container.providerRegistry.get('telegram');
    console.log('Registered provider info:', JSON.stringify(provider.info, null, 2));
    console.log('Capabilities:', JSON.stringify(provider.capabilities, null, 2));
  } catch (e) {
    registered = false;
    console.log('NOT REGISTERED:', e instanceof Error ? e.message : e);
  }

  // 2. Diagnostics snapshot
  console.log('\n--- Diagnostics snapshot (telegram) ---');
  const snapshot = container.providerDiagnostics.getSnapshot().find((s) => s.providerId === 'telegram');
  console.log(JSON.stringify(snapshot, null, 2));

  if (!registered) {
    console.log('Aborting: provider not registered.');
    await prisma.$disconnect();
    return;
  }

  // 3. Scheduler registration check (start + stop, just to prove it wires up)
  console.log('\n--- Scheduler ---');
  container.services.syncScheduler.startProvider('telegram', 15 * 60 * 1000, WORKSPACE_ID);
  const statusBeforeSync = container.services.syncScheduler.getStatus(WORKSPACE_ID, 'telegram');
  console.log('Status after startProvider:', JSON.stringify(statusBeforeSync));

  // Baseline DB counts
  const beforeVacancyCount = await prisma.vacancy.count();
  const beforeSourceCount = await prisma.vacancySource.count();
  const beforeTelegramSourceCount = await prisma.vacancySource.count({ where: { providerId: 'telegram' } });
  console.log(`\nBefore sync: Vacancy=${beforeVacancyCount} VacancySource=${beforeSourceCount} TelegramSource=${beforeTelegramSourceCount}`);

  // 4. Execute syncProvider("telegram")
  console.log('\n--- syncProvider("telegram") ---');
  const result = await container.services.syncScheduler.syncProvider('telegram', WORKSPACE_ID);
  console.log('Sync result:', JSON.stringify(result, null, 2));

  const statusAfterSync = container.services.syncScheduler.getStatus(WORKSPACE_ID, 'telegram');
  console.log('Status after sync:', JSON.stringify(statusAfterSync));

  container.services.syncScheduler.stopProvider('telegram');

  // 5. DB verification
  const afterVacancyCount = await prisma.vacancy.count();
  const afterSourceCount = await prisma.vacancySource.count();
  const afterTelegramSourceCount = await prisma.vacancySource.count({ where: { providerId: 'telegram' } });

  interface TelegramSourceRow {
    vacancyId: string;
    externalId: string;
    applyUrl: string | null;
    sourceUrl: string | null;
    isPrimary: boolean;
    vacancy: {
      title: string;
      location: string | null;
      remote: string;
      salaryMin: number | null;
      salaryMax: number | null;
      currency: string;
      metadata: unknown;
      company: { name: string };
    };
  }

  const telegramSourceRows: TelegramSourceRow[] = await prisma.vacancySource.findMany({
    where: { providerId: 'telegram' },
    include: { vacancy: { include: { company: true } } },
  });
  const distinctVacancyIds = new Set(telegramSourceRows.map((s) => s.vacancyId));

  console.log('\n--- DB State After Sync ---');
  console.log(`Vacancy total: ${beforeVacancyCount} -> ${afterVacancyCount} (+${afterVacancyCount - beforeVacancyCount})`);
  console.log(`VacancySource total: ${beforeSourceCount} -> ${afterSourceCount} (+${afterSourceCount - beforeSourceCount})`);
  console.log(`VacancySource providerId=telegram: ${beforeTelegramSourceCount} -> ${afterTelegramSourceCount} (+${afterTelegramSourceCount - beforeTelegramSourceCount})`);
  console.log(`Distinct Vacancy rows backed by a telegram source: ${distinctVacancyIds.size}`);

  console.log('\n--- Sample telegram-sourced vacancies (up to 15) ---');
  for (const row of telegramSourceRows.slice(0, 15)) {
    console.log(JSON.stringify({
      externalId: row.externalId,
      sourceUrl: row.sourceUrl,
      applyUrl: row.applyUrl,
      isPrimary: row.isPrimary,
      vacancyTitle: row.vacancy.title,
      companyName: row.vacancy.company?.name,
      location: row.vacancy.location,
      remote: row.vacancy.remote,
      salaryMin: row.vacancy.salaryMin,
      salaryMax: row.vacancy.salaryMax,
      currency: row.vacancy.currency,
      technologies: (row.vacancy.metadata as { technologies?: string[] } | null)?.technologies,
    }, null, 2));
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
