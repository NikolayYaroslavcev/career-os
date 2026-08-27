import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import { PrismaTelegramChannelRepository, prisma } from '@careeros/database';

// Vacancy-provider audit (2026-08-25): live sourceUrl sampling against
// VacancySource showed these 5 channels overwhelmingly produce unusable
// sourceUrls (personal Telegram-profile links, the channel's own alias, or
// unrelated domains) instead of a link to an actual vacancy — see the audit
// report for the per-channel percentages.
const CHANNELS_TO_DISABLE: Array<{ username: string; description: string }> = [
  {
    username: 'golangjob',
    description:
      'DISABLED (provider audit 2026-08-25): 100% of sampled sourceUrls are personal Telegram-profile links (e.g. t.me/dina_wm), not job pages. Previously removed 2026-07-31 for staleness, silently re-added 2026-08-02 — re-disabling.',
  },
  {
    username: 'yotolabqa',
    description:
      'DISABLED (provider audit 2026-08-25): 100% of sampled sourceUrls are a single repeating personal Telegram-profile link (t.me/anna_femininity) for the same "AQA Engineer" post — looks like single-advertiser spam, not a job feed.',
  },
  {
    username: 'devops_jobs_feed',
    description:
      'DISABLED (provider audit 2026-08-25): 100% of sampled recent sourceUrls are the channel\'s own alias (t.me/devops_jobs) repeating one vacancy, not a link to a specific posting.',
  },
  {
    username: 'datasciencejobs',
    description:
      'DISABLED (provider audit 2026-08-25): ~82.8% of sourceUrls are bad (unrelated domains, or extraction failures producing "Untitled vacancy").',
  },
  {
    username: 'workitkz',
    description:
      'DISABLED (provider audit 2026-08-25): ~69.9% of sourceUrls are bad, including unrelated generic sites (e.g. socket.io).',
  },
];

async function main(): Promise<void> {
  const repo = new PrismaTelegramChannelRepository();

  for (const { username, description } of CHANNELS_TO_DISABLE) {
    const existing = await repo.findByUsername(username);
    if (!existing) {
      console.log(`@${username} not found in DB, skipping`);
      continue;
    }
    if (!existing.enabled) {
      console.log(`@${username} already disabled, skipping`);
      continue;
    }
    await repo.update(existing.id, { enabled: false, description });
    console.log(`disabled @${username}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
