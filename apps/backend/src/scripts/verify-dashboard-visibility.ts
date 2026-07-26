import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import { PrismaVacancyRepository, PrismaVacancySourceRepository } from '@careeros/database';

async function main(): Promise<void> {
  const workspaceId = process.argv[2];
  if (!workspaceId) {
    console.error('Usage: tsx verify-dashboard-visibility.ts <workspaceId>');
    process.exit(1);
  }

  const vacancyRepo = new PrismaVacancyRepository();
  const sourceRepo = new PrismaVacancySourceRepository();

  // Same criteria shape the dashboard's vacancy list (GET /api/v1/vacancies) uses.
  const { vacancies, total } = await vacancyRepo.findMany({ workspaceId, sortBy: 'newest', sortOrder: 'desc', limit: 1000, offset: 0 });
  console.log(`GET /vacancies would return total=${total}, page size=${vacancies.length}`);

  let telegramCount = 0;
  for (const v of vacancies) {
    const sources = await sourceRepo.findByVacancyId(v.id);
    if (sources.some((s) => s.providerId === 'telegram')) {
      telegramCount++;
      if (telegramCount <= 3) {
        console.log('Sample dashboard-visible telegram vacancy:', JSON.stringify({
          id: v.id,
          title: v.title,
          sources: sources.map((s) => ({ providerId: s.providerId, externalId: s.externalId, isPrimary: s.isPrimary })),
        }));
      }
    }
  }
  console.log(`Telegram-sourced vacancies visible in first page of dashboard vacancy list: ${telegramCount}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
