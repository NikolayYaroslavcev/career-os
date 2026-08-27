import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });
import { prisma } from '@careeros/database';

async function main(): Promise<void> {
  const total = await prisma.workspace.count();
  console.log('Total workspaces:', total);

  const nonE2E = await prisma.workspace.findMany({
    where: { name: { not: { contains: "E2E" } } },
    select: { id: true, name: true, createdAt: true },
  });
  console.log('Non-E2E workspaces:', JSON.stringify(nonE2E, null, 2));

  const userCount = await prisma.user.count();
  console.log('Total users:', userCount);
  const seeker = await prisma.user.findFirst({ where: { email: 'seeker@careeros.test' }, select: { id: true, email: true, workspaces: { select: { workspaceId: true } } } });
  console.log('seeker@careeros.test:', JSON.stringify(seeker, null, 2));

  await prisma.$disconnect();
}
main();
