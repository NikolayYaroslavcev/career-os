import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import { PrismaTelegramChannelRepository, prisma } from '@careeros/database';

const USERNAME = 'hr_breakfast_emergency';

async function main(): Promise<void> {
  const repo = new PrismaTelegramChannelRepository();

  const existing = await repo.findByUsername(USERNAME);
  if (existing) {
    console.log(`@${USERNAME} already in DB (enabled=${existing.enabled})`);
  } else {
    const created = await repo.create({ username: USERNAME, enabled: true, category: 'general' });
    console.log(`created @${created.username}`);
  }

  const enabled = await repo.findEnabledUsernames();
  console.log(`Enabled channels (${enabled.length}):`, enabled.join(', '));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
