import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Resume as ResumeEntity, ResumeVersionStatus, createResumeId, createUserId } from '@careeros/career';
import { integrationTestsEnabled } from './db-guard.js';

const runIf = integrationTestsEnabled() ? describe : describe.skip;

runIf('Resume persistence (real Postgres)', () => {
  let prisma: import('@prisma/client').PrismaClient;
  let PrismaResumeRepository: typeof import('../infrastructure/prisma-resume-repository.js').PrismaResumeRepository;
  let workspaceId: string;
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../client.js'));
    ({ PrismaResumeRepository } = await import('../infrastructure/prisma-resume-repository.js'));

    const workspace = await prisma.workspace.create({ data: { name: `integration-test-${crypto.randomUUID()}` } });
    workspaceId = workspace.id;

    const user = await prisma.user.create({
      data: { email: `integration-${crypto.randomUUID()}@example.test`, passwordHash: 'x' },
    });
    userId = user.id;

    const otherUser = await prisma.user.create({
      data: { email: `integration-other-${crypto.randomUUID()}@example.test`, passwordHash: 'x' },
    });
    otherUserId = otherUser.id;
  });

  afterAll(async () => {
    // Cascades away every Resume created under this workspace.
    await prisma.workspace.delete({ where: { id: workspaceId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.user.delete({ where: { id: otherUserId } });
  });

  it('uploads (creates) a resume with file metadata, reads it back, updates it, then deletes it', async () => {
    const repository = new PrismaResumeRepository();

    const resume = ResumeEntity.create({
      id: createResumeId(crypto.randomUUID()),
      userId: createUserId(userId),
      title: 'Senior Backend Engineer',
      summary: 'Ten years of backend experience.',
    });

    await repository.save(resume, {
      workspaceId,
      fileName: 'resume.pdf',
      fileType: 'application/pdf',
      fileSize: 4096,
      originalFile: 'base64-original-content',
    });

    const found = await repository.findById(resume.id);
    expect(found).not.toBeNull();
    expect(found?.title).toBe('Senior Backend Engineer');
    expect(found?.summary).toBe('Ten years of backend experience.');
    expect(found?.status).toBe(ResumeVersionStatus.ACTIVE);

    resume.updateTitle('Staff Backend Engineer');
    resume.updateStatus(ResumeVersionStatus.ARCHIVED);
    await repository.save(resume, { workspaceId });

    const updated = await repository.findById(resume.id);
    expect(updated?.title).toBe('Staff Backend Engineer');
    expect(updated?.status).toBe(ResumeVersionStatus.ARCHIVED);

    await repository.delete(resume.id);
    expect(await repository.exists(resume.id)).toBe(false);
  });

  it('scopes resumes to their owner and supports multiple resumes with status/tag filters', async () => {
    const repository = new PrismaResumeRepository();

    const mine = ResumeEntity.create({
      id: createResumeId(crypto.randomUUID()),
      userId: createUserId(userId),
      title: 'My Draft Resume',
      status: ResumeVersionStatus.DRAFT,
      tags: ['backend'],
    });
    await repository.save(mine, { workspaceId });

    const theirs = ResumeEntity.create({
      id: createResumeId(crypto.randomUUID()),
      userId: createUserId(otherUserId),
      title: "Someone Else's Resume",
    });
    await repository.save(theirs, { workspaceId });

    const myResumes = await repository.findByUserId(createUserId(userId));
    expect(myResumes.map((r) => r.id)).toContain(mine.id);
    expect(myResumes.map((r) => r.id)).not.toContain(theirs.id);

    const draftsOnly = await repository.findByUserId(createUserId(userId), {
      status: ResumeVersionStatus.DRAFT,
    });
    expect(draftsOnly.map((r) => r.id)).toContain(mine.id);

    const byTag = await repository.findByUserId(createUserId(userId), { tag: 'backend' });
    expect(byTag.map((r) => r.id)).toContain(mine.id);

    await repository.delete(mine.id);
    await repository.delete(theirs.id);
  });

  it('resolves the latest resume version by most recent creation time', async () => {
    const repository = new PrismaResumeRepository();

    const older = ResumeEntity.create({
      id: createResumeId(crypto.randomUUID()),
      userId: createUserId(userId),
      title: 'Older Version',
    });
    await repository.save(older, { workspaceId });

    // Force a distinguishable createdAt ordering — repository.save() writes
    // whatever createdAt the domain entity carries, and both objects would
    // otherwise be created within the same millisecond in a fast test run.
    await prisma.resume.update({
      where: { id: older.id },
      data: { createdAt: new Date(Date.now() - 60_000) },
    });

    const newer = ResumeEntity.create({
      id: createResumeId(crypto.randomUUID()),
      userId: createUserId(userId),
      title: 'Newer Version',
    });
    await repository.save(newer, { workspaceId });

    const latest = await repository.findDefaultByUserId(createUserId(userId));
    expect(latest?.id).toBe(newer.id);

    await repository.delete(older.id);
    await repository.delete(newer.id);
  });

  it('cascades away a resume when its owning user is deleted', async () => {
    const repository = new PrismaResumeRepository();

    const disposableUser = await prisma.user.create({
      data: { email: `integration-disposable-${crypto.randomUUID()}@example.test`, passwordHash: 'x' },
    });

    const resume = ResumeEntity.create({
      id: createResumeId(crypto.randomUUID()),
      userId: createUserId(disposableUser.id),
      title: 'Cascade Target Resume',
    });
    await repository.save(resume, { workspaceId });

    await prisma.user.delete({ where: { id: disposableUser.id } });

    expect(await repository.exists(resume.id)).toBe(false);
  });
});
