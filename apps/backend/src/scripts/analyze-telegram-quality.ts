import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import { prisma } from '@careeros/database';

async function main(): Promise<void> {
  console.log('=== Telegram Vacancy Quality Analysis ===\n');

  interface TelegramSourceRow {
    externalId: string;
    applyUrl: string | null;
    sourceUrl: string | null;
    vacancy: {
      title: string;
      description: string;
      salaryMin: number | null;
      salaryMax: number | null;
      metadata: unknown;
      company: { name: string };
    };
  }

  const sources: TelegramSourceRow[] = await prisma.vacancySource.findMany({
    where: { providerId: 'telegram' },
    include: {
      vacancy: {
        include: { company: true },
      },
    },
  });

  const total = sources.length;
  console.log(`Total Telegram sources: ${total}\n`);

  // 1. Missing company names
  const missingCompany = sources.filter(
    (s) => !s.vacancy.company?.name || s.vacancy.company.name === 'Unknown' || s.vacancy.company.name === ''
  );
  console.log(`1. Missing/Unknown company names: ${missingCompany.length} (${((missingCompany.length / total) * 100).toFixed(1)}%)`);
  const companySamples = missingCompany.slice(0, 5).map((s) => ({
    title: s.vacancy.title,
    company: s.vacancy.company?.name || '(null)',
    channel: s.externalId.split(':')[0],
  }));
  console.log('   Samples:', JSON.stringify(companySamples, null, 2));

  // 2. Missing apply URLs (using default post URL)
  const missingApplyUrl = sources.filter(
    (s) => !s.applyUrl || s.applyUrl.includes('t.me/') && !s.applyUrl.includes('t.me/s/')
  );
  console.log(`\n2. Missing apply URLs (using t.me post URL): ${missingApplyUrl.length} (${((missingApplyUrl.length / total) * 100).toFixed(1)}%)`);
  const urlSamples = missingApplyUrl.slice(0, 5).map((s) => ({
    title: s.vacancy.title,
    applyUrl: s.applyUrl,
    sourceUrl: s.sourceUrl,
  }));
  console.log('   Samples:', JSON.stringify(urlSamples, null, 2));

  // 3. Missing salaries
  const missingSalary = sources.filter(
    (s) => !s.vacancy.salaryMin && !s.vacancy.salaryMax
  );
  console.log(`\n3. Missing salary data: ${missingSalary.length} (${((missingSalary.length / total) * 100).toFixed(1)}%)`);
  const salarySamples = missingSalary.slice(0, 5).map((s) => ({
    title: s.vacancy.title,
    description: s.vacancy.description?.substring(0, 200),
  }));
  console.log('   Samples:', JSON.stringify(salarySamples, null, 2));

  // 4. Bad/generic titles
  const badTitles = sources.filter(
    (s) =>
      !s.vacancy.title ||
      s.vacancy.title === 'Untitled vacancy' ||
      s.vacancy.title.length < 5 ||
      s.vacancy.title === s.vacancy.title.toUpperCase()
  );
  console.log(`\n4. Bad/generic titles: ${badTitles.length} (${((badTitles.length / total) * 100).toFixed(1)}%)`);
  const titleSamples = badTitles.slice(0, 10).map((s) => ({
    title: s.vacancy.title,
    channel: s.externalId.split(':')[0],
  }));
  console.log('   Samples:', JSON.stringify(titleSamples, null, 2));

  // 5. Duplicate companies (normalization issue)
  const companyCounts = new Map<string, number>();
  for (const s of sources) {
    const name = s.vacancy.company?.name;
    if (name && name !== 'Unknown') {
      const normalized = name.toLowerCase().trim();
      companyCounts.set(normalized, (companyCounts.get(normalized) || 0) + 1);
    }
  }
  const duplicates = [...companyCounts.entries()]
    .filter(([_, count]) => count > 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  console.log(`\n5. Duplicate companies (>3 occurrences):`);
  for (const [name, count] of duplicates) {
    console.log(`   ${name}: ${count}`);
  }

  // 6. Technology extraction quality
  const withTech = sources.filter(
    (s) => {
      const meta = s.vacancy.metadata as { technologies?: string[] } | null;
      return meta?.technologies && meta.technologies.length > 0;
    }
  );
  const withoutTech = total - withTech.length;
  console.log(`\n6. Technology extraction:`);
  console.log(`   With technologies: ${withTech.length} (${((withTech.length / total) * 100).toFixed(1)}%)`);
  console.log(`   Without technologies: ${withoutTech} (${((withoutTech / total) * 100).toFixed(1)}%)`);

  // 7. Channel distribution
  const channelCounts = new Map<string, number>();
  for (const s of sources) {
    const channel = s.externalId.split(':')[0] ?? s.externalId;
    channelCounts.set(channel, (channelCounts.get(channel) || 0) + 1);
  }
  console.log(`\n7. Channel distribution:`);
  for (const [channel, count] of [...channelCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${channel}: ${count}`);
  }

  // 8. Sample raw descriptions to understand extraction patterns
  console.log(`\n8. Sample raw descriptions (for pattern analysis):`);
  const samples = sources.slice(0, 10).map((s) => ({
    channel: s.externalId.split(':')[0],
    title: s.vacancy.title,
    description: s.vacancy.description?.substring(0, 300),
  }));
  console.log(JSON.stringify(samples, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
