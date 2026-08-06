import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { integrationTestsEnabled } from './db-guard.js';

const runIf = integrationTestsEnabled() ? describe : describe.skip;

// Cross-entity transaction-boundary coverage for the Core Domain (User, Workspace,
// Resume, SearchProfile, Application). Entity-local rollback behaviour (e.g.
// WorkspaceRepository.save's own $transaction) is covered next to that entity's
// suite; this file exercises multi-table atomicity that spans several of them.
runIf('Core Domain transaction boundaries (real Postgres)', () => {
  let prisma: import('@prisma/client').PrismaClient;
  let workspaceId: string;
  let userId: string;
  let vacancyId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../client.js'));

    const workspace = await prisma.workspace.create({ data: { name: `integration-test-${crypto.randomUUID()}` } });
    workspaceId = workspace.id;

    const user = await prisma.user.create({
      data: { email: `integration-${crypto.randomUUID()}@example.test`, passwordHash: 'x' },
    });
    userId = user.id;

    const company = await prisma.company.create({ data: { name: 'Integration Test Co', workspaceId } });
    const vacancy = await prisma.vacancy.create({
      data: { title: 'Platform Engineer', description: 'desc', requirements: [], workspaceId, companyId: company.id },
    });
    vacancyId = vacancy.id;
  });

  afterAll(async () => {
    await prisma.workspace.delete({ where: { id: workspaceId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it('commits an Application + Communication + Interview + FollowUp created atomically in one transaction', async () => {
    const applicationId = crypto.randomUUID();
    const communicationId = crypto.randomUUID();
    const interviewId = crypto.randomUUID();
    const followUpId = crypto.randomUUID();

    await prisma.$transaction(async (tx) => {
      await tx.application.create({
        data: { id: applicationId, userId, vacancyId, workspaceId, status: 'SAVED' },
      });
      await tx.communication.create({
        data: {
          id: communicationId,
          applicationId,
          type: 'EMAIL',
          direction: 'OUTBOUND',
          subject: 'Applied',
        },
      });
      await tx.interview.create({
        data: {
          id: interviewId,
          applicationId,
          type: 'HR',
          scheduledAt: new Date(Date.now() + 86_400_000),
          durationMinutes: 30,
        },
      });
      await tx.followUp.create({
        data: {
          id: followUpId,
          applicationId,
          scheduledAt: new Date(Date.now() + 3 * 86_400_000),
          status: 'PENDING',
        },
      });
    });

    expect(await prisma.application.findUnique({ where: { id: applicationId } })).not.toBeNull();
    expect(await prisma.communication.findUnique({ where: { id: communicationId } })).not.toBeNull();
    expect(await prisma.interview.findUnique({ where: { id: interviewId } })).not.toBeNull();
    expect(await prisma.followUp.findUnique({ where: { id: followUpId } })).not.toBeNull();

    await prisma.application.delete({ where: { id: applicationId } });
  });

  it('rolls back an Application and its children when a later step in the same transaction fails', async () => {
    const applicationId = crypto.randomUUID();
    const communicationId = crypto.randomUUID();

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.application.create({
          data: { id: applicationId, userId, vacancyId, workspaceId, status: 'SAVED' },
        });
        await tx.communication.create({
          data: {
            id: communicationId,
            applicationId,
            type: 'EMAIL',
            direction: 'OUTBOUND',
          },
        });
        // Violates Interview -> Application FK: aborts the whole transaction,
        // including the Application and Communication rows created above.
        await tx.interview.create({
          data: {
            id: crypto.randomUUID(),
            applicationId: crypto.randomUUID(),
            type: 'HR',
            scheduledAt: new Date(Date.now() + 86_400_000),
            durationMinutes: 30,
          },
        });
      })
    ).rejects.toThrow();

    expect(await prisma.application.findUnique({ where: { id: applicationId } })).toBeNull();
    expect(await prisma.communication.findUnique({ where: { id: communicationId } })).toBeNull();
  });

  it('rolls back a Resume + SearchProfile created together when the second insert violates a unique constraint', async () => {
    const resumeId = crypto.randomUUID();
    const searchProfileId = crypto.randomUUID();

    // Pre-existing profile whose id we'll collide with inside the transaction.
    await prisma.searchProfile.create({
      data: {
        id: searchProfileId,
        name: 'Existing Profile',
        desiredPositions: [],
        desiredTechnologies: [],
        experienceLevel: 'middle',
        workspaceId,
        userId,
      },
    });

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.resume.create({
          data: {
            id: resumeId,
            title: 'Transactional Resume',
            parsedData: {},
            workspaceId,
            userId,
          },
        });
        // Same id as the pre-existing profile above -> unique constraint
        // violation, which must roll back the Resume insert too.
        await tx.searchProfile.create({
          data: {
            id: searchProfileId,
            name: 'Colliding Profile',
            desiredPositions: [],
            desiredTechnologies: [],
            experienceLevel: 'senior',
            workspaceId,
            userId,
          },
        });
      })
    ).rejects.toThrow();

    expect(await prisma.resume.findUnique({ where: { id: resumeId } })).toBeNull();
    const survivingProfile = await prisma.searchProfile.findUnique({ where: { id: searchProfileId } });
    expect(survivingProfile?.name).toBe('Existing Profile');

    await prisma.searchProfile.delete({ where: { id: searchProfileId } });
  });

  it('rolls back a User + WorkspaceMember created together when the membership violates its unique constraint', async () => {
    const newUserId = crypto.randomUUID();
    const newUserEmail = `integration-txn-user-${crypto.randomUUID()}@example.test`;

    // Pre-existing membership for `userId` in `workspaceId`.
    await prisma.workspaceMember.create({ data: { userId, workspaceId, role: 'MEMBER' } });

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: { id: newUserId, email: newUserEmail, passwordHash: 'x' },
        });
        // Duplicate [userId, workspaceId] pair -> unique constraint violation,
        // which must roll back the User insert above as well.
        await tx.workspaceMember.create({ data: { userId, workspaceId, role: 'ADMIN' } });
      })
    ).rejects.toThrow();

    expect(await prisma.user.findUnique({ where: { id: newUserId } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { email: newUserEmail } })).toBeNull();

    await prisma.workspaceMember.deleteMany({ where: { userId, workspaceId } });
  });
});
