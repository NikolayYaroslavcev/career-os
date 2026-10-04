import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });
import { prisma } from '@careeros/database';

async function main(): Promise<void> {
  const totalVacancies = await prisma.vacancy.count();
  const totalSources = await prisma.vacancySource.count();
  console.log('Total Vacancy rows (all workspaces):', totalVacancies);
  console.log('Total VacancySource rows:', totalSources);
  await prisma.$disconnect();
}
main();
