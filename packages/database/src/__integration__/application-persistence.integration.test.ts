import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  Application as ApplicationEntity,
  Communication as CommunicationEntity,
  Interview as InterviewEntity,
  FollowUp as FollowUpEntity,
  ApplicationStatus,
  CommunicationType,
  CommunicationDirection,
  InterviewType,
  createApplicationId,
  createUserId,
  createVacancyId,
  createCommunicationId,
  createInterviewId,
  createFollowUpId,
} from '@careeros/career';
import { integrationTestsEnabled } from './db-guard.js';

const runIf = integrationTestsEnabled() ? describe : describe.skip;

runIf('Application persistence (real Postgres)', () => {
  let prisma: import('@prisma/client').PrismaClient;
  let PrismaApplicationRepository: typeof import('../infrastructure/prisma-application-repository.js').PrismaApplicationRepository;
  let PrismaCommunicationRepository: typeof import('../infrastructure/prisma-communication-repository.js').PrismaCommunicationRepository;
  let PrismaInterviewRepository: typeof import('../infrastructure/prisma-interview-repository.js').PrismaInterviewRepository;
  let PrismaFollowUpRepository: typeof import('../infrastructure/prisma-follow-up-repository.js').PrismaFollowUpRepository;
  let workspaceId: string;
  let userId: string;
  let vacancyId: string;
  let secondVacancyId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../client.js'));
    ({ PrismaApplicationRepository } = await import('../infrastructure/prisma-application-repository.js'));
    ({ PrismaCommunicationRepository } = await import('../infrastructure/prisma-communication-repository.js'));
    ({ PrismaInterviewRepository } = await import('../infrastructure/prisma-interview-repository.js'));
    ({ PrismaFollowUpRepository } = await import('../infrastructure/prisma-follow-up-repository.js'));

    const workspace = await prisma.workspace.create({ data: { name: `integration-test-${crypto.randomUUID()}` } });
    workspaceId = workspace.id;

    const user = await prisma.user.create({
      data: { email: `integration-${crypto.randomUUID()}@example.test`, passwordHash: 'x' },
    });
    userId = user.id;

    const company = await prisma.company.create({ data: { name: 'Integration Test Co', workspaceId } });
    const vacancy = await prisma.vacancy.create({
      data: { title: 'Backend Engineer', description: 'desc', requirements: [], workspaceId, companyId: company.id },
    });
    vacancyId = vacancy.id;

    const secondVacancy = await prisma.vacancy.create({
      data: { title: 'Frontend Engineer', description: 'desc', requirements: [], workspaceId, companyId: company.id },
    });
    secondVacancyId = secondVacancy.id;
  });

  afterAll(async () => {
    // Cascades away Company/Vacancy/Application (+ Communication/Interview/FollowUp) under this workspace.
    await prisma.workspace.delete({ where: { id: workspaceId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it('creates an application, transitions its status, and deletes it', async () => {
    const repository = new PrismaApplicationRepository();

    const application = ApplicationEntity.create({
      id: createApplicationId(crypto.randomUUID()),
      userId: createUserId(userId),
      vacancyId: createVacancyId(vacancyId),
    });

    await repository.save(application, { workspaceId });

    const found = await repository.findById(application.id);
    expect(found?.status).toBe(ApplicationStatus.SAVED);

    found!.start();
    await repository.save(found!, { workspaceId });
    const started = await repository.findById(application.id);
    expect(started?.status).toBe(ApplicationStatus.STARTED);
    expect(started?.startedAt).toBeInstanceOf(Date);

    started!.submit();
    await repository.save(started!, { workspaceId });
    const submitted = await repository.findById(application.id);
    expect(submitted?.status).toBe(ApplicationStatus.SUBMITTED);
    expect(submitted?.submittedAt).toBeInstanceOf(Date);

    await repository.delete(application.id);
    expect(await repository.exists(application.id)).toBe(false);
  });

  it('finds applications by vacancy relation, by user relation, and by user+status', async () => {
    const repository = new PrismaApplicationRepository();

    const application = ApplicationEntity.create({
      id: createApplicationId(crypto.randomUUID()),
      userId: createUserId(userId),
      vacancyId: createVacancyId(secondVacancyId),
    });
    await repository.save(application, { workspaceId });

    const byVacancy = await repository.findByVacancyId(createVacancyId(secondVacancyId));
    expect(byVacancy.map((a) => a.id)).toContain(application.id);

    const byUser = await repository.findByUserId(createUserId(userId));
    expect(byUser.map((a) => a.id)).toContain(application.id);

    const byUserAndStatus = await repository.findByUserIdAndStatus(createUserId(userId), ApplicationStatus.SAVED);
    expect(byUserAndStatus.map((a) => a.id)).toContain(application.id);

    const byUserAndVacancy = await repository.findByUserIdAndVacancyId(
      createUserId(userId),
      createVacancyId(secondVacancyId)
    );
    expect(byUserAndVacancy?.id).toBe(application.id);

    await repository.delete(application.id);
  });

  it('persists Communication, Interview, and FollowUp children scoped to the application', async () => {
    const applicationRepository = new PrismaApplicationRepository();
    const communicationRepository = new PrismaCommunicationRepository();
    const interviewRepository = new PrismaInterviewRepository();
    const followUpRepository = new PrismaFollowUpRepository();

    const application = ApplicationEntity.create({
      id: createApplicationId(crypto.randomUUID()),
      userId: createUserId(userId),
      vacancyId: createVacancyId(vacancyId),
    });
    await applicationRepository.save(application, { workspaceId });

    const communication = CommunicationEntity.create({
      id: createCommunicationId(crypto.randomUUID()),
      applicationId: application.id,
      type: CommunicationType.EMAIL,
      direction: CommunicationDirection.OUTBOUND,
      subject: 'Application submitted',
      content: 'Thank you for applying.',
    });
    await communicationRepository.save(communication);

    const interview = InterviewEntity.create({
      id: createInterviewId(crypto.randomUUID()),
      applicationId: application.id,
      type: InterviewType.TECHNICAL,
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      interviewerName: 'Jamie Reviewer',
    });
    await interviewRepository.save(interview);

    const followUp = FollowUpEntity.create({
      id: createFollowUpId(crypto.randomUUID()),
      applicationId: application.id,
      scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      message: 'Check in on status',
    });
    await followUpRepository.save(followUp);

    const communications = await communicationRepository.findByApplicationId(application.id);
    expect(communications.map((c) => c.id)).toEqual([communication.id]);

    const interviews = await interviewRepository.findByApplicationId(application.id);
    expect(interviews.map((i) => i.id)).toEqual([interview.id]);

    const upcoming = await interviewRepository.findUpcomingByApplicationId(application.id);
    expect(upcoming.map((i) => i.id)).toEqual([interview.id]);

    const followUps = await followUpRepository.findByApplicationId(application.id);
    expect(followUps.map((f) => f.id)).toEqual([followUp.id]);

    const followUpsByUser = await followUpRepository.findByUserId(createUserId(userId));
    expect(followUpsByUser.map((f) => f.id)).toContain(followUp.id);

    const due = await followUpRepository.findDue(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000));
    expect(due.map((f) => f.id)).toContain(followUp.id);

    // Deleting the application must cascade away every child row.
    await applicationRepository.delete(application.id);

    expect(await prisma.communication.findUnique({ where: { id: communication.id } })).toBeNull();
    expect(await interviewRepository.exists(interview.id)).toBe(false);
    expect(await prisma.followUp.findUnique({ where: { id: followUp.id } })).toBeNull();
  });

  it('rejects a second application for the same user + vacancy pair (unique constraint)', async () => {
    const applicationId = crypto.randomUUID();
    await prisma.application.create({
      data: { id: applicationId, userId, vacancyId, workspaceId, status: 'SAVED' },
    });

    await expect(
      prisma.application.create({
        data: { id: crypto.randomUUID(), userId, vacancyId, workspaceId, status: 'SAVED' },
      })
    ).rejects.toThrow();

    await prisma.application.delete({ where: { id: applicationId } });
  });
});
