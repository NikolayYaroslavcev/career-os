import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  SearchProfile as SearchProfileEntity,
  createSearchProfileId,
  createUserId,
  ExperienceLevel,
  Location,
  Salary,
  Technology,
} from '@careeros/career';
import { integrationTestsEnabled } from './db-guard.js';

const runIf = integrationTestsEnabled() ? describe : describe.skip;

runIf('SearchProfile persistence (real Postgres)', () => {
  let prisma: import('@prisma/client').PrismaClient;
  let PrismaSearchProfileRepository: typeof import('../infrastructure/prisma-search-profile-repository.js').PrismaSearchProfileRepository;
  let workspaceId: string;
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../client.js'));
    ({ PrismaSearchProfileRepository } = await import('../infrastructure/prisma-search-profile-repository.js'));

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
    await prisma.workspace.delete({ where: { id: workspaceId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.user.delete({ where: { id: otherUserId } });
  });

  it('creates a search profile with locations/salary/technologies, reads it back, updates it, then deletes it', async () => {
    const repository = new PrismaSearchProfileRepository();

    const profile = SearchProfileEntity.create({
      id: createSearchProfileId(crypto.randomUUID()),
      userId: createUserId(userId),
      name: 'Remote Backend Roles',
      desiredPositions: ['Backend Engineer'],
      desiredTechnologies: [Technology.create('typescript', 'language')],
      experienceLevel: ExperienceLevel.SENIOR,
      desiredSalary: Salary.create(90000, 130000, 'USD', 'yearly'),
      desiredLocations: [Location.create({ country: 'Germany', workMode: 'remote', isRelocationPossible: false })],
      isRemoteOnly: true,
    });

    await repository.save(profile, { workspaceId });

    const found = await repository.findById(profile.id);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Remote Backend Roles');
    expect(found?.experienceLevel).toBe(ExperienceLevel.SENIOR);
    expect(found?.desiredSalary?.min).toBe(90000);
    expect(found?.desiredSalary?.max).toBe(130000);
    expect(found?.desiredTechnologies.map((t) => t.name)).toEqual(['typescript']);
    expect(found?.desiredLocations[0]?.country).toBe('Germany');
    expect(found?.isRemoteOnly).toBe(true);
    expect(found?.isActive).toBe(true);

    found!.updateName('Updated Search Name');
    found!.updateExperienceLevel(ExperienceLevel.LEAD);
    found!.deactivate();
    await repository.save(found!, { workspaceId });

    const updated = await repository.findById(profile.id);
    expect(updated?.name).toBe('Updated Search Name');
    expect(updated?.experienceLevel).toBe(ExperienceLevel.LEAD);
    expect(updated?.isActive).toBe(false);

    await repository.delete(profile.id);
    expect(await repository.exists(profile.id)).toBe(false);
  });

  it('scopes search profiles to their owner and resolves the active one', async () => {
    const repository = new PrismaSearchProfileRepository();

    const mine = SearchProfileEntity.create({
      id: createSearchProfileId(crypto.randomUUID()),
      userId: createUserId(userId),
      name: 'My Active Profile',
      experienceLevel: ExperienceLevel.MIDDLE,
    });
    await repository.save(mine, { workspaceId });

    const theirs = SearchProfileEntity.create({
      id: createSearchProfileId(crypto.randomUUID()),
      userId: createUserId(otherUserId),
      name: "Someone Else's Profile",
      experienceLevel: ExperienceLevel.MIDDLE,
    });
    await repository.save(theirs, { workspaceId });

    const myProfiles = await repository.findByUserId(createUserId(userId));
    expect(myProfiles.map((p) => p.id)).toContain(mine.id);
    expect(myProfiles.map((p) => p.id)).not.toContain(theirs.id);

    const active = await repository.findActiveByUserId(createUserId(userId));
    expect(active?.id).toBe(mine.id);

    await repository.delete(mine.id);
    await repository.delete(theirs.id);
  });

  it('allows multiple search profiles with the same name for one user (no DB-level dedup constraint)', async () => {
    const repository = new PrismaSearchProfileRepository();
    const sharedName = 'Duplicate Name Profile';

    const first = SearchProfileEntity.create({
      id: createSearchProfileId(crypto.randomUUID()),
      userId: createUserId(userId),
      name: sharedName,
      experienceLevel: ExperienceLevel.JUNIOR,
    });
    const second = SearchProfileEntity.create({
      id: createSearchProfileId(crypto.randomUUID()),
      userId: createUserId(userId),
      name: sharedName,
      experienceLevel: ExperienceLevel.SENIOR,
    });

    await repository.save(first, { workspaceId });
    await repository.save(second, { workspaceId });

    const mine = await repository.findByUserId(createUserId(userId));
    const duplicates = mine.filter((p) => p.name === sharedName);
    expect(duplicates).toHaveLength(2);

    await repository.delete(first.id);
    await repository.delete(second.id);
  });

  it('cascades away a search profile when its workspace is deleted', async () => {
    const repository = new PrismaSearchProfileRepository();
    const disposableWorkspace = await prisma.workspace.create({
      data: { name: `integration-disposable-${crypto.randomUUID()}` },
    });

    const profile = SearchProfileEntity.create({
      id: createSearchProfileId(crypto.randomUUID()),
      userId: createUserId(userId),
      name: 'Cascade Target Profile',
      experienceLevel: ExperienceLevel.MIDDLE,
    });
    await repository.save(profile, { workspaceId: disposableWorkspace.id });

    await prisma.workspace.delete({ where: { id: disposableWorkspace.id } });

    expect(await repository.exists(profile.id)).toBe(false);
  });
});
