import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });
import { prisma } from '@careeros/database';

async function main(): Promise<void> {
  const messages = await prisma.socialMessage.findMany({
    where: { sourceId: 'hr_breakfast_emergency' },
    orderBy: { publishedAt: 'desc' },
    take: 10,
  });
  console.log(`SocialMessage rows for hr_breakfast_emergency: ${messages.length}`);
  for (const m of messages) {
    console.log(`- externalMessageId=${m.externalMessageId} publishedAt=${m.publishedAt.toISOString()} status=${m.processingStatus} text="${m.rawText.slice(0, 80).replace(/\n/g, ' ')}..."`);
  }

  if (messages.length > 0) {
    const ids = messages.map((m) => m.id);
    const extractions = await prisma.messageExtraction.findMany({
      where: { messageId: { in: ids } },
      orderBy: { createdAt: 'desc' },
    });
    console.log(`\nMessageExtraction rows: ${extractions.length}`);
    for (const e of extractions) {
      console.log(`- messageId=${e.messageId} status=${e.status} title="${e.title}" company="${e.company}" confidence=${e.deterministicConfidence}`);
    }
  }

  const sources = await prisma.vacancySource.findMany({
    where: { providerId: 'telegram', externalId: { startsWith: 'hr_breakfast_emergency:' } },
    take: 10,
  });
  console.log(`\nVacancySource rows (telegram, hr_breakfast_emergency): ${sources.length}`);
  for (const s of sources) {
    console.log(`- externalId=${s.externalId} sourceUrl=${s.sourceUrl} vacancyId=${s.vacancyId} workspaceId=${(s as any).workspaceId}`);
  }

  await prisma.$disconnect();
}
main();
