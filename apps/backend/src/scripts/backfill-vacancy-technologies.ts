/**
 * Backfill script: Extract technologies from existing vacancies that have empty technologies.
 *
 * Uses the shared TECH_KEYWORDS list to scan vacancy descriptions and requirements.
 * Does NOT overwrite existing non-empty technologies.
 *
 * Usage: npx tsx apps/backend/src/scripts/backfill-vacancy-technologies.ts
 */

import { prisma } from '@careeros/database';
import { extractTechnologiesFromText } from '@careeros/providers';

const BATCH_SIZE = 100;

async function backfill(): Promise<void> {
  console.log('Starting vacancy technologies backfill...');

  const totalCount = await prisma.vacancy.count();
  const emptyCount = await prisma.vacancy.count({
    where: { technologies: { equals: [] } },
  });

  console.log(`Total vacancies: ${totalCount}`);
  console.log(`Vacancies with empty technologies: ${emptyCount}`);

  if (emptyCount === 0) {
    console.log('No vacancies to backfill. Done.');
    return;
  }

  let updated = 0;
  let skipped = 0;
  let offset = 0;

  while (offset < emptyCount) {
    const vacancies = await prisma.vacancy.findMany({
      where: { technologies: { equals: [] } },
      take: BATCH_SIZE,
      skip: offset,
      select: {
        id: true,
        title: true,
        description: true,
        requirements: true,
        technologies: true,
      },
    });

    if (vacancies.length === 0) break;

    for (const vacancy of vacancies) {
      // Skip if already has technologies (race condition safety)
      if (vacancy.technologies.length > 0) {
        skipped++;
        continue;
      }

      // Extract technologies from title + description + requirements
      const text = [
        vacancy.title,
        vacancy.description,
        ...(vacancy.requirements || []),
      ].join(' ');

      const technologies = extractTechnologiesFromText(text);

      if (technologies.length > 0) {
        await prisma.vacancy.update({
          where: { id: vacancy.id },
          data: { technologies },
        });
        updated++;
      } else {
        skipped++;
      }
    }

    offset += BATCH_SIZE;

    if (updated % 100 === 0 && updated > 0) {
      console.log(`  Progress: ${updated} updated, ${skipped} skipped...`);
    }
  }

  console.log('\nBackfill complete:');
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);

  // Final stats
  const finalEmpty = await prisma.vacancy.count({
    where: { technologies: { equals: [] } },
  });
  const finalWithTech = await prisma.vacancy.count({
    where: { technologies: { isEmpty: false } },
  });

  console.log(`\nAfter backfill:`);
  console.log(`  Total vacancies: ${totalCount}`);
  console.log(`  With technologies: ${finalWithTech}`);
  console.log(`  Without technologies: ${finalEmpty}`);
}

backfill()
  .then(() => {
    console.log('\nDone.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  });
