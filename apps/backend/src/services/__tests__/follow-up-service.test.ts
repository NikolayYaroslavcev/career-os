import { describe, it, expect, beforeEach } from 'vitest';
import {
  ApplicationServiceImpl,
  Vacancy,
  Company,
  createVacancyId,
  createCompanyId,
  FollowUpType,
  Location,
  ExperienceLevel,
} from '@careeros/career';
import type { ApplicationService } from '@careeros/career';
import {
  FollowUpService,
  FollowUpApplicationNotFoundError,
  FollowUpNotAuthorizedError,
  FollowUpNotFoundError,
} from '../follow-up-service.js';
import { ApplicationCreationService } from '../application-creation-service.js';
import {
  InMemoryApplicationRepository,
  InMemoryFollowUpRepository,
  InMemoryVacancyRepository,
  InMemoryCompanyRepository,
} from '../../testing/in-memory-repositories.js';

describe('FollowUpService', () => {
  let applicationRepository: InMemoryApplicationRepository;
  let followUpRepository: InMemoryFollowUpRepository;
  let vacancyRepository: InMemoryVacancyRepository;
  let companyRepository: InMemoryCompanyRepository;
  let applicationService: ApplicationService;
  let service: FollowUpService;

  const userId = '11111111-1111-4111-8111-111111111111';
  const otherUserId = '99999999-9999-4999-8999-999999999999';
  const vacancyId = createVacancyId('22222222-2222-4222-8222-222222222222');
  const companyId = createCompanyId('33333333-3333-4333-8333-333333333333');

  beforeEach(async () => {
    applicationRepository = new InMemoryApplicationRepository();
    followUpRepository = new InMemoryFollowUpRepository(applicationRepository);
    vacancyRepository = new InMemoryVacancyRepository();
    companyRepository = new InMemoryCompanyRepository();
    applicationService = new ApplicationServiceImpl(applicationRepository);
    service = new FollowUpService(followUpRepository, applicationRepository, vacancyRepository, companyRepository);

    await companyRepository.save(Company.create({ id: companyId, name: 'Acme Corp' }), { workspaceId: 'workspace-1' });
    await vacancyRepository.save(
      Vacancy.create({
        id: vacancyId,
        title: 'Senior Backend Engineer',
        description: 'desc',
        companyId,
        location: Location.create({ workMode: 'remote' }),
        experienceLevel: ExperienceLevel.SENIOR,
      }),
      { workspaceId: 'workspace-1' }
    );
  });

  async function createApplication(owner = userId): ReturnType<ApplicationCreationService['createFromIds']> {
    const creation = new ApplicationCreationService(applicationService);
    return creation.createFromIds({ userId: owner, vacancyId, workspaceId: 'workspace-1' });
  }

  it('schedules a follow-up with a caller-supplied message', async () => {
    const app = await createApplication();
    const future = new Date(Date.now() + 86_400_000);

    const followUp = await service.schedule(app.id, userId, future, 'Custom text');

    expect(followUp.message).toBe('Custom text');
    expect(followUp.scheduledAt).toEqual(future);
    expect(followUp.status).toBe('pending');
  });

  it('falls back to a default template built from the vacancy and company when no message is given', async () => {
    const app = await createApplication();
    const future = new Date(Date.now() + 86_400_000);

    const followUp = await service.schedule(app.id, userId, future);

    expect(followUp.message).toContain('Senior Backend Engineer');
    expect(followUp.message).toContain('Acme Corp');
  });

  it('rejects scheduling for an application owned by another user', async () => {
    const app = await createApplication();
    await expect(
      service.schedule(app.id, otherUserId, new Date(Date.now() + 86_400_000))
    ).rejects.toThrow(FollowUpNotAuthorizedError);
  });

  it('throws when the application does not exist', async () => {
    await expect(
      service.schedule('does-not-exist', userId, new Date(Date.now() + 86_400_000))
    ).rejects.toThrow(FollowUpApplicationNotFoundError);
  });

  it('lists follow-ups only for the owning user', async () => {
    const app = await createApplication();
    await service.schedule(app.id, userId, new Date(Date.now() + 86_400_000));

    await expect(service.listForApplication(app.id, otherUserId)).rejects.toThrow(FollowUpNotAuthorizedError);
    const listed = await service.listForApplication(app.id, userId);
    expect(listed).toHaveLength(1);
  });

  it('snoozes, completes, and cancels a follow-up, enforcing ownership', async () => {
    const app = await createApplication();
    const followUp = await service.schedule(app.id, userId, new Date(Date.now() + 86_400_000));

    await expect(service.snooze(followUp.id, otherUserId, new Date(Date.now() + 172_800_000))).rejects.toThrow(
      FollowUpNotAuthorizedError
    );

    const snoozed = await service.snooze(followUp.id, userId, new Date(Date.now() + 172_800_000));
    expect(snoozed.status).toBe('snoozed');

    const completed = await service.complete(followUp.id, userId);
    expect(completed.status).toBe('completed');
  });

  it('throws for an unknown follow-up id', async () => {
    await expect(service.complete('does-not-exist', userId)).rejects.toThrow(FollowUpNotFoundError);
  });

  it('finds due follow-ups regardless of owner', async () => {
    const app = await createApplication();
    const followUp = await service.schedule(app.id, userId, new Date(Date.now() + 1000));

    expect(await service.findDue(new Date())).toHaveLength(0);
    expect(await service.findDue(new Date(Date.now() + 2000))).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: followUp.id })])
    );
  });

  describe('scheduleAutomatic', () => {
    it('creates a typed follow-up without an ownership round-trip', async () => {
      const app = await createApplication();
      const future = new Date(Date.now() + 6 * 86_400_000);

      const followUp = await service.scheduleAutomatic(app, FollowUpType.FOLLOW_UP, future);

      expect(followUp).not.toBeNull();
      expect(followUp?.type).toBe(FollowUpType.FOLLOW_UP);
      expect(followUp?.scheduledAt).toEqual(future);
      expect(followUp?.message).toContain('Senior Backend Engineer');
    });

    it('no-ops when the target date has already passed', async () => {
      const app = await createApplication();
      const past = new Date(Date.now() - 1000);

      const followUp = await service.scheduleAutomatic(app, FollowUpType.FOLLOW_UP, past);

      expect(followUp).toBeNull();
      expect(await service.listForApplication(app.id, userId)).toHaveLength(0);
    });

    it('prevents duplicates: skips if a pending/snoozed follow-up of the same type already exists', async () => {
      const app = await createApplication();
      const first = await service.scheduleAutomatic(app, FollowUpType.FOLLOW_UP, new Date(Date.now() + 86_400_000));
      const second = await service.scheduleAutomatic(app, FollowUpType.FOLLOW_UP, new Date(Date.now() + 172_800_000));

      expect(first).not.toBeNull();
      expect(second).toBeNull();
      expect(await service.listForApplication(app.id, userId)).toHaveLength(1);
    });

    it('does not dedupe across different types', async () => {
      const app = await createApplication();
      await service.scheduleAutomatic(app, FollowUpType.FOLLOW_UP, new Date(Date.now() + 86_400_000));
      const interview = await service.scheduleAutomatic(app, FollowUpType.INTERVIEW, new Date(Date.now() + 172_800_000));

      expect(interview).not.toBeNull();
      expect(await service.listForApplication(app.id, userId)).toHaveLength(2);
    });

    it('allows scheduling again once the earlier one of the same type is resolved', async () => {
      const app = await createApplication();
      const first = await service.scheduleAutomatic(app, FollowUpType.FOLLOW_UP, new Date(Date.now() + 86_400_000));
      expect(first).not.toBeNull();
      await service.complete(first?.id ?? '', userId);

      const second = await service.scheduleAutomatic(app, FollowUpType.FOLLOW_UP, new Date(Date.now() + 172_800_000));
      expect(second).not.toBeNull();
    });
  });

  describe('cancelPendingForApplication', () => {
    it('cancels pending and snoozed follow-ups but leaves completed ones alone', async () => {
      const app = await createApplication();
      const pending = await service.schedule(app.id, userId, new Date(Date.now() + 86_400_000));
      const toSnooze = await service.schedule(app.id, userId, new Date(Date.now() + 172_800_000));
      const snoozed = await service.snooze(toSnooze.id, userId, new Date(Date.now() + 259_200_000));
      const toComplete = await service.schedule(app.id, userId, new Date(Date.now() + 345_600_000));
      const completed = await service.complete(toComplete.id, userId);

      await service.cancelPendingForApplication(app.id);

      const all = await service.listForApplication(app.id, userId);
      expect(all.find((f) => f.id === pending.id)?.status).toBe('cancelled');
      expect(all.find((f) => f.id === snoozed.id)?.status).toBe('cancelled');
      expect(all.find((f) => f.id === completed.id)?.status).toBe('completed');
    });
  });

  describe('listEnrichedForUser / findByUserId', () => {
    it('resolves vacancy title, company name, and days-since-applied across all of a user’s applications', async () => {
      const app = await createApplication();
      await service.schedule(app.id, userId, new Date(Date.now() + 86_400_000));
      const otherApp = await createApplication(otherUserId);
      await service.schedule(otherApp.id, otherUserId, new Date(Date.now() + 86_400_000));

      const mine = await service.findByUserId(userId);
      expect(mine).toHaveLength(1);

      const enriched = await service.listEnrichedForUser(userId);
      expect(enriched).toHaveLength(1);
      expect(enriched[0]).toMatchObject({
        vacancyTitle: 'Senior Backend Engineer',
        companyName: 'Acme Corp',
        applicationId: app.id,
      });
      expect(enriched[0]?.daysSinceApplied).toBeGreaterThanOrEqual(0);
    });
  });
});
