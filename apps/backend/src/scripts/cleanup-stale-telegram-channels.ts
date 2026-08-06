// One-off cleanup: the TelegramChannel table turned out to already contain
// 52 rows from an unrelated prior dev/test session (all created within
// minutes of each other on 2026-07-26, names like `qa_test_channel`,
// `front_end_first`, `projvm_jobs` — not real curated channels). Removes
// everything outside the curated set before seeding, so the real sync in
// this task only touches the intended channels.
import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import { prisma } from '@careeros/database';

const CURATED_USERNAMES = [
  'remoteit', 'jobforjunior', 'geekjobs', 'workitkz', 'relocats', 'job_python',
  'datasciencejobs', 'fordevops', 'jobforqa', 'rabotafrontend', 'forfrontend',
  'remotegeekjob', 'findwork', 'yotolabqa', 'forproducts', 'foranalysts',
  'dev_connectablejobs', 'devs_it', 'myitjob', 'devops_jobs_feed', 'job_javadevs',
  'job_react', 'fordesigner', 'junior_designers', 'forruby', 'godevjob',
].map((u) => u.toLowerCase());

async function main(): Promise<void> {
  const all = await prisma.telegramChannel.findMany({ select: { id: true, username: true } });
  const stale = all.filter((c) => !CURATED_USERNAMES.includes(c.username.toLowerCase()));

  console.log(`Total channels: ${all.length}, curated: ${all.length - stale.length}, stale: ${stale.length}`);
  if (stale.length > 0) {
    const result = await prisma.telegramChannel.deleteMany({ where: { id: { in: stale.map((c) => c.id) } } });
    console.log(`Deleted ${result.count} stale channels: ${stale.map((c) => c.username).join(', ')}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
