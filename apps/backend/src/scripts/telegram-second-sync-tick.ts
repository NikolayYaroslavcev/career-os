// Vacancy creation lags one sync tick behind extraction by design (ADR-032
// Phase 4/5 — a message not yet extracted when search() runs simply isn't
// offered to Mapper/Normalizer that cycle, see telegram-fetcher.ts
// buildRawJob()). This session's first tick (via the running backend
// container) ingested + extracted all 26 channels' messages but produced no
// new VacancySource rows yet — this script runs a second `syncProvider`
// tick directly so those now-SUCCESS extractions get turned into Vacancy
// records, for accurate real-sync reporting.
import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import { loadConfig } from '@careeros/shared';
import { prisma } from '@careeros/database';
import { buildContainer } from '../container.js';

const WORKSPACE_ID = 'default';

async function main(): Promise<void> {
  const config = loadConfig();
  const container = buildContainer(config);

  console.log('Triggering second telegram sync tick...');
  const result = await container.services.syncScheduler.syncProvider('telegram', WORKSPACE_ID);
  console.log('Result:', JSON.stringify(result, null, 2));

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
