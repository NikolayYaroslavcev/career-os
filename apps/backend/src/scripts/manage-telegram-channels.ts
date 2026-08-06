// One-off migration + expansion script: makes the TelegramChannel DB table
// (today empty — see resolveTelegramChannelSource() in container.ts, which
// currently falls back to the TELEGRAM_CHANNELS env var) the authoritative
// channel source, seeding it with the existing env-configured channels and
// the new Tier 1 batch in one idempotent run.
import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import { PrismaTelegramChannelRepository, prisma } from '@careeros/database';

// Previously live only via TELEGRAM_CHANNELS env fallback. `golangjob` is
// dropped here — investigate-telegram-channels.ts confirmed it's reachable
// but stale (no new posts in 1267 days as of this run), i.e. dead for
// practical ingestion purposes.
const EXISTING_CHANNELS = [
  'remoteit', 'jobforjunior', 'geekjobs', 'workitkz', 'Relocats', 'job_python',
  'datasciencejobs', 'fordevops', 'jobforqa', 'rabotafrontend', 'forfrontend',
];

const TIER_1_CHANNELS: Array<{ username: string; category: string }> = [
  { username: 'remotegeekjob', category: 'general' },
  { username: 'findwork', category: 'general' },
  { username: 'YotolabQA', category: 'qa' },
  { username: 'forproducts', category: 'product' },
  { username: 'foranalysts', category: 'analyst' },
  { username: 'dev_connectablejobs', category: 'general' },
  { username: 'devs_it', category: 'general' },
  { username: 'myitjob', category: 'general' },
  { username: 'devops_jobs_feed', category: 'devops' },
  { username: 'job_javadevs', category: 'java' },
  { username: 'job_react', category: 'frontend' },
  { username: 'fordesigner', category: 'design' },
  { username: 'junior_designers', category: 'design' },
  { username: 'forruby', category: 'ruby' },
  { username: 'godevjob', category: 'golang' },
];

async function main(): Promise<void> {
  const repo = new PrismaTelegramChannelRepository();

  console.log('=== Seeding existing env-configured channels ===');
  for (const username of EXISTING_CHANNELS) {
    const existing = await repo.findByUsername(username);
    if (existing) {
      console.log(`  skip @${username} (already in DB)`);
      continue;
    }
    const created = await repo.create({ username, enabled: true });
    console.log(`  created @${created.username}`);
  }

  console.log('\n=== Adding Tier 1 channels ===');
  for (const { username, category } of TIER_1_CHANNELS) {
    const existing = await repo.findByUsername(username);
    if (existing) {
      console.log(`  skip @${username} (already in DB)`);
      continue;
    }
    const created = await repo.create({ username, enabled: true, category });
    console.log(`  created @${created.username} [${category}]`);
  }

  const all = await repo.findAll();
  console.log(`\nTotal channels in DB: ${all.length} (${all.filter((c) => c.enabled).length} enabled)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
