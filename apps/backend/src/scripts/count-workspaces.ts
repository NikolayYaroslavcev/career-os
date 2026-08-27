import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });
import { prisma } from '@careeros/database';

async function main(): Promise<void> {
  const count = await prisma.workspace.count();
  console.log('Total workspaces:', count);
  await prisma.$disconnect();
}
main();
