import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import { PrismaTelegramChannelRepository, prisma } from '@careeros/database';

const USERNAME = 'hr_breakfast_emergency';

async function main(): Promise<void> {
  const repo = new PrismaTelegramChannelRepository();
  const existing = await repo.findByUsername(USERNAME);
  if (!existing) {
    console.log(`@${USERNAME} not found in DB`);
    return;
  }
  await repo.update(existing.id, {
    enabled: false,
    description: 'BLOCKED: this is a Telegram group (10,574 members), not a channel. The /s/<username> public preview page the Telegram provider scrapes only exists for channels; groups 302-redirect to the plain info page with no message history. Would require bot-based group ingestion (new transport, no TELEGRAM_BOT_TOKEN configured) to support.',
  });
  console.log(`disabled @${USERNAME}`);
  await prisma.$disconnect();
}
main();
