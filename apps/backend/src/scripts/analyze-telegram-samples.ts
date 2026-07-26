import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import { prisma } from '@careeros/database';

async function main(): Promise<void> {
  console.log('=== Telegram Sample Descriptions ===\n');

  // Get samples from different channels
  const channels = ['remoteit', 'jobforjunior', 'geekjobs', 'workitkz', 'job_python', 'datasciencejobs', 'fordevops', 'jobforqa'];

  for (const channel of channels) {
    const sources = await prisma.vacancySource.findMany({
      where: {
        providerId: 'telegram',
        externalId: { startsWith: `${channel}:` },
      },
      include: { vacancy: true },
      take: 3,
    });

    console.log(`\n--- ${channel} (${sources.length} samples) ---`);
    for (const s of sources) {
      console.log(`\nTitle: ${s.vacancy.title}`);
      console.log(`Apply URL: ${s.applyUrl || '(null)'}`);
      console.log(`Source URL: ${s.sourceUrl}`);
      console.log(`Description (first 400 chars):`);
      console.log(s.vacancy.description?.substring(0, 400));
      console.log('---');
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
