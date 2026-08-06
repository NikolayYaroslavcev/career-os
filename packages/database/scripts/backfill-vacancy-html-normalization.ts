#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import { computeVacancyTextUpdate, computeCompanyNameUpdate } from '../src/backfill/vacancy-html-normalization.js';

interface BackfillResult {
  vacanciesScanned: number;
  vacanciesUpdated: number;
  vacanciesSkipped: number;
  companiesScanned: number;
  companiesUpdated: number;
  companiesSkipped: number;
  errors: string[];
}

const BATCH_SIZE = 500;
const isDryRun = process.argv.includes('--dry-run');

async function backfillVacancies(prisma: PrismaClient, result: BackfillResult): Promise<void> {
  let cursor: string | undefined;

  for (;;) {
    const batch = await prisma.vacancy.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, title: true, description: true },
    });

    if (batch.length === 0) {
      break;
    }

    for (const vacancy of batch) {
      result.vacanciesScanned++;
      const update = computeVacancyTextUpdate(vacancy);

      if (!update) {
        result.vacanciesSkipped++;
        continue;
      }

      try {
        if (!isDryRun) {
          await prisma.vacancy.update({ where: { id: vacancy.id }, data: update });
        }
        result.vacanciesUpdated++;
        console.log(`  ${isDryRun ? '[dry-run] would update' : 'Updated'} vacancy ${vacancy.id} (${Object.keys(update).join(', ')})`);
      } catch (error) {
        const msg = `Failed to update vacancy ${vacancy.id}: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(msg);
        console.error(`  ${msg}`);
      }
    }

    const last = batch[batch.length - 1];
    cursor = last?.id;
    if (batch.length < BATCH_SIZE) {
      break;
    }
  }
}

async function backfillCompanies(prisma: PrismaClient, result: BackfillResult): Promise<void> {
  let cursor: string | undefined;

  for (;;) {
    const batch = await prisma.company.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, name: true },
    });

    if (batch.length === 0) {
      break;
    }

    for (const company of batch) {
      result.companiesScanned++;
      const normalizedName = computeCompanyNameUpdate(company.name);

      if (normalizedName === null) {
        result.companiesSkipped++;
        continue;
      }

      try {
        if (!isDryRun) {
          await prisma.company.update({ where: { id: company.id }, data: { name: normalizedName } });
        }
        result.companiesUpdated++;
        console.log(`  ${isDryRun ? '[dry-run] would update' : 'Updated'} company ${company.id}`);
      } catch (error) {
        const msg = `Failed to update company ${company.id}: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(msg);
        console.error(`  ${msg}`);
      }
    }

    const last = batch[batch.length - 1];
    cursor = last?.id;
    if (batch.length < BATCH_SIZE) {
      break;
    }
  }
}

async function main(): Promise<void> {
  console.log(`=== Vacancy HTML Normalization Backfill${isDryRun ? ' (dry-run)' : ''} ===\n`);

  const prisma = new PrismaClient();
  const result: BackfillResult = {
    vacanciesScanned: 0,
    vacanciesUpdated: 0,
    vacanciesSkipped: 0,
    companiesScanned: 0,
    companiesUpdated: 0,
    companiesSkipped: 0,
    errors: [],
  };

  try {
    await backfillVacancies(prisma, result);
    await backfillCompanies(prisma, result);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n=== Backfill Summary ===');
  console.log(`Vacancies scanned:  ${result.vacanciesScanned}`);
  console.log(`Vacancies updated:  ${result.vacanciesUpdated}`);
  console.log(`Vacancies skipped (already normalized): ${result.vacanciesSkipped}`);
  console.log(`Companies scanned:  ${result.companiesScanned}`);
  console.log(`Companies updated:  ${result.companiesUpdated}`);
  console.log(`Companies skipped (already normalized): ${result.companiesSkipped}`);

  if (result.errors.length > 0) {
    console.log(`\nErrors: ${result.errors.length}`);
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log(`\nBackfill ${isDryRun ? 'dry-run ' : ''}completed successfully.`);
}

main().catch((error) => {
  console.error('\nBackfill failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
