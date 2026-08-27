import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });
import { prisma } from '@careeros/database';

const SEEKER_WS = '2a63b6e3-a48e-4dcb-a930-16da0d25d956';

async function main(): Promise<void> {
  // Telegram sources from today, check sourceUrl patterns
  const telegramToday = await prisma.vacancySource.findMany({
    where: { providerId: 'telegram', vacancy: { workspaceId: SEEKER_WS }, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    select: { sourceUrl: true, externalId: true },
  });
  const genericUrlCount = telegramToday.filter((s) => {
    const u = (s.sourceUrl ?? '').toLowerCase();
    return u === 'https://geekjob.ru' || /^https:\/\/t\.me\/[^/]+$/i.test(u);
  }).length;
  console.log(`Telegram sources (last 24h): ${telegramToday.length}, generic/non-specific sourceUrl: ${genericUrlCount}`);

  // Dedup check: title+company pairs appearing more than once in seeker workspace
  const vacancies = await prisma.vacancy.findMany({
    where: { workspaceId: SEEKER_WS },
    select: { id: true, title: true, companyId: true },
  });
  const key = (v: { title: string; companyId: string }) => `${v.title.trim().toLowerCase()}::${v.companyId}`;
  const counts = new Map<string, number>();
  for (const v of vacancies) counts.set(key(v), (counts.get(key(v)) ?? 0) + 1);
  const dupes = [...counts.values()].filter((c) => c > 1).length;
  console.log(`Total vacancies in seeker workspace: ${vacancies.length}, title+company groups with >1 Vacancy row: ${dupes}`);

  await prisma.$disconnect();
}
main();
