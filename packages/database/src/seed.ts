import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding database...');

  // Shared workspace used as a placeholder by mappers (Company, Vacancy, Resume)
  // that don't yet thread a real workspaceId through from the domain layer.
  const workspace = await prisma.workspace.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      name: 'Default Workspace',
    },
    update: {},
  });
  console.log(`Created workspace: ${workspace.id}`);

  // Development seed: SearchProfile + Resume for the MVP user
  if (process.env.NODE_ENV === 'development') {
    await seedDevData();
  }

  console.log('Seeding complete!');
}

async function seedDevData(): Promise<void> {
  const MVP_USER_ID = '4f59174a-9fe5-458f-84cc-e2d34536d27b';
  const MVP_WORKSPACE_ID = 'a52e1e0f-9d5b-4d08-98a4-1a92601677c0';

  const user = await prisma.user.findUnique({ where: { id: MVP_USER_ID } });
  if (!user) {
    console.log(`MVP user ${MVP_USER_ID} not found, skipping dev seed`);
    return;
  }

  const existingProfile = await prisma.searchProfile.findFirst({
    where: { userId: MVP_USER_ID, isActive: true },
  });

  if (!existingProfile) {
    await prisma.searchProfile.create({
      data: {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        userId: MVP_USER_ID,
        workspaceId: MVP_WORKSPACE_ID,
        name: 'Senior Backend Developer',
        desiredPositions: ['Senior Backend Developer', 'Full Stack Developer'],
        desiredTechnologies: ['TypeScript', 'Node.js', 'PostgreSQL', 'React'],
        experienceLevel: 'senior',
        salaryMin: 80000,
        salaryMax: 150000,
        salaryCurrency: 'USD',
        salaryPeriod: 'yearly',
        locations: [{ workMode: 'remote', isRelocationPossible: true }],
        isRemoteOnly: true,
        isActive: true,
      },
    });
    console.log('Created dev SearchProfile for MVP user');
  }

  const existingResume = await prisma.resume.findFirst({
    where: { userId: MVP_USER_ID },
  });

  if (!existingResume) {
    await prisma.resume.create({
      data: {
        id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        userId: MVP_USER_ID,
        workspaceId: MVP_WORKSPACE_ID,
        fileName: 'dev-resume.json',
        fileType: 'application/json',
        parsedData: {
          title: 'Senior Backend Developer',
          summary: 'Experienced backend developer with 5+ years building scalable APIs and microservices.',
          skills: [
            { name: 'API Design', level: 'expert', years: 5 },
            { name: 'Database Design', level: 'advanced', years: 4 },
          ],
          technologies: [
            { name: 'TypeScript', category: 'language' },
            { name: 'Node.js', category: 'framework' },
            { name: 'PostgreSQL', category: 'database' },
            { name: 'React', category: 'framework' },
          ],
          experience: [
            {
              company: 'Tech Corp',
              position: 'Senior Backend Developer',
              startDate: '2020-01-01',
              description: 'Built and maintained scalable backend services.',
              technologies: ['TypeScript', 'Node.js', 'PostgreSQL'],
            },
          ],
          education: [],
        },
      },
    });
    console.log('Created dev Resume for MVP user');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
