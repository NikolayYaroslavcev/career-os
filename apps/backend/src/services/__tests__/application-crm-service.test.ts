import { describe, it, expect, beforeEach } from 'vitest';
import {
  ApplicationServiceImpl,
  ApplicationStatus,
  Recruiter,
  createRecruiterId,
  CommunicationType,
  CommunicationDirection,
  InterviewType,
} from '@careeros/career';
import type { ApplicationService } from '@careeros/career';
import {
  ApplicationCrmService,
  ApplicationNotFoundError,
  ApplicationNotAuthorizedError,
  InvalidStatusTransitionError,
  RecruiterNotAuthorizedError,
} from '../application-crm-service.js';
import { FollowUpService } from '../follow-up-service.js';
import {
  InMemoryApplicationRepository,
  InMemoryRecruiterRepository,
  InMemoryCommunicationRepository,
  InMemoryInterviewRepository,
  InMemoryFollowUpRepository,
  InMemoryVacancyRepository,
  InMemoryCompanyRepository,
} from '../../testing/in-memory-repositories.js';
import { ApplicationCreationService } from '../application-creation-service.js';

describe('ApplicationCrmService', () => {
  let applicationRepository: InMemoryApplicationRepository;
  let recruiterRepository: InMemoryRecruiterRepository;
  let communicationRepository: InMemoryCommunicationRepository;
  let interviewRepository: InMemoryInterviewRepository;
  let followUpRepository: InMemoryFollowUpRepository;
  let applicationService: ApplicationService;
  let followUpService: FollowUpService;
  let service: ApplicationCrmService;

  const userId = '11111111-1111-4111-8111-111111111111';
  const otherUserId = '99999999-9999-4999-8999-999999999999';
  const vacancyId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    applicationRepository = new InMemoryApplicationRepository();
    recruiterRepository = new InMemoryRecruiterRepository();
    communicationRepository = new InMemoryCommunicationRepository();
    interviewRepository = new InMemoryInterviewRepository();
    followUpRepository = new InMemoryFollowUpRepository();
    applicationService = new ApplicationServiceImpl(applicationRepository);
    followUpService = new FollowUpService(
      followUpRepository,
      applicationRepository,
      new InMemoryVacancyRepository(),
      new InMemoryCompanyRepository()
    );
    service = new ApplicationCrmService(
      applicationService,
      applicationRepository,
      recruiterRepository,
      communicationRepository,
      interviewRepository,
      followUpService
    );
  });

  async function createApplication(): ReturnType<ApplicationCreationService['createFromIds']> {
    const creation = new ApplicationCreationService(applicationService);
    return creation.createFromIds({ userId, vacancyId, workspaceId: 'workspace-1' });
  }

  it('lists only the requesting user applications, newest first', async () => {
    const first = await createApplication();
    await new Promise((r) => setTimeout(r, 2));
    const second = await createApplication();
    await new ApplicationCreationService(applicationService).createFromIds({
      userId: otherUserId,
      vacancyId,
      workspaceId: 'workspace-1',
    });

    const { applications, total } = await service.list(userId);
    expect(total).toBe(2);
    expect(applications.map((a) => a.id)).toEqual([second.id, first.id]);
  });

  it('paginates and filters by status', async () => {
    const app = await createApplication();
    await service.changeStatus(app.id, userId, ApplicationStatus.SUBMITTED);
    await createApplication();

    const applied = await service.list(userId, { status: ApplicationStatus.SUBMITTED });
    expect(applied.total).toBe(1);
    expect(applied.applications[0]?.id).toBe(app.id);
  });

  it('throws ApplicationNotFoundError for an unknown id', async () => {
    await expect(service.getOwned('does-not-exist', userId)).rejects.toThrow(ApplicationNotFoundError);
  });

  it('throws ApplicationNotAuthorizedError when the application belongs to another user', async () => {
    const app = await createApplication();
    await expect(service.getOwned(app.id, otherUserId)).rejects.toThrow(ApplicationNotAuthorizedError);
  });

  it('changes status through the domain entity and persists it', async () => {
    const app = await createApplication();
    const updated = await service.changeStatus(app.id, userId, ApplicationStatus.SUBMITTED);
    expect(updated.status).toBe(ApplicationStatus.SUBMITTED);

    const reloaded = await applicationRepository.findById(app.id);
    expect(reloaded?.status).toBe(ApplicationStatus.SUBMITTED);
  });

  it('wraps an invalid transition as InvalidStatusTransitionError', async () => {
    const app = await createApplication();
    await service.changeStatus(app.id, userId, ApplicationStatus.REJECTED);

    await expect(service.changeStatus(app.id, userId, ApplicationStatus.SUBMITTED)).rejects.toThrow(
      InvalidStatusTransitionError
    );
  });

  it('adds and persists notes', async () => {
    const app = await createApplication();
    await service.addNote(app.id, userId, 'Called recruiter');
    const updated = await service.addNote(app.id, userId, 'Sent follow-up email');

    expect(updated.notes.map((n) => n.content)).toEqual(['Called recruiter', 'Sent follow-up email']);
  });

  it('update() only touches notes and leaves the resumeId set at creation untouched', async () => {
    const resumeId = 'resume-abc';
    const creation = new ApplicationCreationService(applicationService);
    const app = await creation.createFromIds({ userId, vacancyId, resumeId, workspaceId: 'workspace-1' });
    expect(app.resumeId).toBe(resumeId);

    const updated = await service.update(app.id, userId, { notes: 'Sent follow-up email' });

    expect(updated.notes.map((n) => n.content)).toEqual(['Sent follow-up email']);
    expect(updated.resumeId).toBe(resumeId);

    const reloaded = await applicationRepository.findById(app.id);
    expect(reloaded?.resumeId).toBe(resumeId);
  });

  it('schedules, lists, snoozes, completes, and cancels follow-ups', async () => {
    const app = await createApplication();
    const future = new Date(Date.now() + 86_400_000);

    const scheduled = await service.scheduleFollowUp(app.id, userId, future, 'Ping recruiter');
    expect(scheduled.status).toBe('pending');
    expect(scheduled.message).toBe('Ping recruiter');

    const listed = await service.listFollowUps(app.id, userId);
    expect(listed.map((f) => f.id)).toEqual([scheduled.id]);

    const laterDate = new Date(Date.now() + 172_800_000);
    const snoozed = await service.snoozeFollowUp(scheduled.id, userId, laterDate);
    expect(snoozed.status).toBe('snoozed');
    expect(snoozed.scheduledAt).toEqual(laterDate);

    const second = await service.scheduleFollowUp(app.id, userId, future);
    const cancelled = await service.cancelFollowUp(second.id, userId);
    expect(cancelled.status).toBe('cancelled');

    const completed = await service.completeFollowUp(snoozed.id, userId);
    expect(completed.status).toBe('completed');
  });

  it('rejects follow-up actions on an application that belongs to another user', async () => {
    const app = await createApplication();
    const future = new Date(Date.now() + 86_400_000);

    await expect(service.scheduleFollowUp(app.id, otherUserId, future)).rejects.toThrow();
  });

  it('assigns a recruiter that belongs to the workspace', async () => {
    const app = await createApplication();
    const recruiter = Recruiter.create({ id: createRecruiterId('recruiter-1'), name: 'Jane Doe' });
    await recruiterRepository.save(recruiter, { workspaceId: 'workspace-1' });

    const updated = await service.assignRecruiter(app.id, userId, recruiter.id, 'workspace-1');
    expect(updated.recruiterId).toBe(recruiter.id);
  });

  it('rejects assigning a recruiter from a different workspace', async () => {
    const app = await createApplication();
    const recruiter = Recruiter.create({ id: createRecruiterId('recruiter-2'), name: 'John Smith' });
    await recruiterRepository.save(recruiter, { workspaceId: 'other-workspace' });

    await expect(
      service.assignRecruiter(app.id, userId, recruiter.id, 'workspace-1')
    ).rejects.toThrow(RecruiterNotAuthorizedError);
  });

  it('groups applications into a pipeline view by status with counts', async () => {
    const app1 = await createApplication();
    const app2 = await createApplication();
    await service.changeStatus(app2.id, userId, ApplicationStatus.SUBMITTED);

    const pipeline = await service.getPipeline(userId);
    const saved = pipeline.find((g) => g.status === ApplicationStatus.SAVED);
    const applied = pipeline.find((g) => g.status === ApplicationStatus.SUBMITTED);

    expect(saved?.count).toBe(1);
    expect(saved?.applications[0]?.id).toBe(app1.id);
    expect(applied?.count).toBe(1);
    expect(applied?.applications[0]?.id).toBe(app2.id);
  });

  it('logs and lists communications for an application', async () => {
    const app = await createApplication();
    await service.addCommunication(app.id, userId, {
      type: CommunicationType.EMAIL,
      direction: CommunicationDirection.OUTBOUND,
      subject: 'Intro',
    });

    const communications = await service.listCommunications(app.id, userId);
    expect(communications).toHaveLength(1);
    expect(communications[0]?.subject).toBe('Intro');
  });

  it('schedules and lists interviews for an application', async () => {
    const app = await createApplication();
    await service.scheduleInterview(app.id, userId, {
      type: InterviewType.TECHNICAL,
      scheduledAt: new Date(Date.now() + 86_400_000),
    });

    const interviews = await service.listInterviews(app.id, userId);
    expect(interviews).toHaveLength(1);
    expect(interviews[0]?.type).toBe(InterviewType.TECHNICAL);
  });

  describe('follow-up automation (EPIC follow-up automation)', () => {
    it('auto-schedules a FOLLOW_UP a few days out when the application is submitted', async () => {
      const app = await createApplication();
      await service.changeStatus(app.id, userId, ApplicationStatus.SUBMITTED);

      const followUps = await service.listFollowUps(app.id, userId);
      expect(followUps).toHaveLength(1);
      expect(followUps[0]?.type).toBe('follow_up');
      expect(followUps[0]?.status).toBe('pending');
      expect(followUps[0]?.scheduledAt.getTime()).toBeGreaterThan(Date.now() + 4 * 86_400_000);
    });

    it('auto-schedules a follow-up a few days after an interview round concludes', async () => {
      const app = await createApplication();
      await service.changeStatus(app.id, userId, ApplicationStatus.SUBMITTED);
      await service.changeStatus(app.id, userId, ApplicationStatus.WAITING);
      await service.changeStatus(app.id, userId, ApplicationStatus.HR_INTERVIEW);
      // Complete the submit-triggered follow-up so the interview-round one isn't deduped away.
      const afterSubmit = await service.listFollowUps(app.id, userId);
      expect(afterSubmit[0]).toBeDefined();
      await service.completeFollowUp(afterSubmit[0]?.id ?? '', userId);

      await service.changeStatus(app.id, userId, ApplicationStatus.TECHNICAL_INTERVIEW);

      const followUps = await service.listFollowUps(app.id, userId);
      const pending = followUps.filter((f) => f.status === 'pending');
      expect(pending).toHaveLength(1);
      expect(pending[0]?.type).toBe('follow_up');
    });

    it('does not stack a second automatic follow-up while one is still pending', async () => {
      const app = await createApplication();
      await service.changeStatus(app.id, userId, ApplicationStatus.SUBMITTED);
      await service.changeStatus(app.id, userId, ApplicationStatus.WAITING);
      await service.changeStatus(app.id, userId, ApplicationStatus.HR_INTERVIEW);
      await service.changeStatus(app.id, userId, ApplicationStatus.TECHNICAL_INTERVIEW);

      const followUps = await service.listFollowUps(app.id, userId);
      expect(followUps).toHaveLength(1);
    });

    it('cancels pending follow-ups when the application is rejected', async () => {
      const app = await createApplication();
      await service.changeStatus(app.id, userId, ApplicationStatus.SUBMITTED);
      await service.changeStatus(app.id, userId, ApplicationStatus.REJECTED);

      const followUps = await service.listFollowUps(app.id, userId);
      expect(followUps.every((f) => f.status === 'cancelled')).toBe(true);
    });

    it('creates no automatic follow-up when moving straight to offer', async () => {
      const app = await createApplication();
      await service.changeStatus(app.id, userId, ApplicationStatus.OFFER);

      expect(await service.listFollowUps(app.id, userId)).toHaveLength(0);
    });

    it('auto-schedules an INTERVIEW reminder 24h before a scheduled interview', async () => {
      const app = await createApplication();
      const interviewAt = new Date(Date.now() + 3 * 86_400_000);
      await service.scheduleInterview(app.id, userId, { type: InterviewType.TECHNICAL, scheduledAt: interviewAt });

      const followUps = await service.listFollowUps(app.id, userId);
      expect(followUps).toHaveLength(1);
      expect(followUps[0]?.type).toBe('interview');
      expect(followUps[0]?.scheduledAt.getTime()).toBe(interviewAt.getTime() - 24 * 60 * 60 * 1000);
    });

    it('skips the interview reminder when the interview is already less than 24h away', async () => {
      const app = await createApplication();
      const interviewAt = new Date(Date.now() + 3 * 60 * 60 * 1000);
      await service.scheduleInterview(app.id, userId, { type: InterviewType.TECHNICAL, scheduledAt: interviewAt });

      expect(await service.listFollowUps(app.id, userId)).toHaveLength(0);
    });
  });
});
