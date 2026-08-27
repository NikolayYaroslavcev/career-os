import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });
import { prisma } from '@careeros/database';

async function main(): Promise<void> {
  const workspaces = await prisma.workspace.findMany({
    select: {
      id: true, name: true, createdAt: true,
      _count: { select: { members: true, searchProfiles: true, jobs: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  for (const w of workspaces) {
    console.log(`${w.createdAt.toISOString()} | ${w.id} | "${w.name}" | members=${w._count.members} searchProfiles=${w._count.searchProfiles} jobs=${w._count.jobs}`);
  }
  console.log('TOTAL:', workspaces.length);
  await prisma.$disconnect();
}
main();
