import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });
import { prisma } from '@careeros/database';

const SEEKER_WS = '2a63b6e3-a48e-4dcb-a930-16da0d25d956';

async function main(): Promise<void> {
  for (const providerId of ['telegram', 'justjoin_it']) {
    const sources = await prisma.vacancySource.findMany({
      where: { providerId, vacancy: { workspaceId: SEEKER_WS } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { vacancy: { select: { title: true, company: { select: { name: true } } } } },
    });
    console.log(`\n=== ${providerId} — most recent VacancySource rows in seeker's workspace ===`);
    for (const s of sources) {
      console.log(`createdAt=${s.createdAt.toISOString()} externalId=${s.externalId} url=${s.sourceUrl} title="${s.vacancy?.title}" company="${s.vacancy?.company?.name}"`);
    }
    const total = await prisma.vacancySource.count({ where: { providerId, vacancy: { workspaceId: SEEKER_WS } } });
    console.log(`Total ${providerId} sources in seeker workspace: ${total}`);
  }
  await prisma.$disconnect();
}
main();
