import { describe, it, expect } from 'vitest';
import { Application } from './application.js';
import { ApplicationStatus } from '../enums/application-status.js';
import { createUserId, createVacancyId, createApplicationId, createRecruiterId, createResumeId } from '../base/identifier.js';

describe('Application', () => {
  const userId = createUserId('user-1');
  const vacancyId = createVacancyId('vacancy-1');
  const applicationId = createApplicationId('app-1');

  it('should create an application', () => {
    const app = Application.create({
      id: applicationId,
      userId,
      vacancyId,
    });

    expect(app.id).toBe(applicationId);
    expect(app.userId).toBe(userId);
    expect(app.vacancyId).toBe(vacancyId);
    expect(app.status).toBe(ApplicationStatus.SAVED);
    expect(app.isTerminal).toBe(false);
  });

  it('should create with domain events', () => {
    const app = Application.create({
      id: applicationId,
      userId,
      vacancyId,
    });

    const events = app.domainEvents;
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('ApplicationCreated');
  });

  it('should transition to STARTED', () => {
    const app = Application.create({
      id: applicationId,
      userId,
      vacancyId,
    });

    app.changeStatus(ApplicationStatus.STARTED);
    expect(app.status).toBe(ApplicationStatus.STARTED);
    expect(app.startedAt).toBeDefined();
  });

  it('should transition to SUBMITTED', () => {
    const app = Application.create({
      id: applicationId,
      userId,
      vacancyId,
    });

    app.changeStatus(ApplicationStatus.SUBMITTED);
    expect(app.status).toBe(ApplicationStatus.SUBMITTED);
    expect(app.submittedAt).toBeDefined();
  });

  it('should emit status changed event', () => {
    const app = Application.create({
      id: applicationId,
      userId,
      vacancyId,
    });

    app.clearDomainEvents();
    app.changeStatus(ApplicationStatus.SUBMITTED);

    const events = app.domainEvents;
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('ApplicationStatusChanged');
  });

  it('should not allow status change on terminal application', () => {
    const app = Application.create({
      id: applicationId,
      userId,
      vacancyId,
    });

    app.changeStatus(ApplicationStatus.REJECTED);
    expect(() => app.changeStatus(ApplicationStatus.SUBMITTED)).toThrow('Cannot change status of a terminal application');
  });

  it('should not allow same status change', () => {
    const app = Application.create({
      id: applicationId,
      userId,
      vacancyId,
    });

    expect(() => app.changeStatus(ApplicationStatus.SAVED)).toThrow('Cannot change to the same status');
  });

  it('should add notes', () => {
    const app = Application.create({
      id: applicationId,
      userId,
      vacancyId,
    });

    app.addNote('First note');
    app.addNote('Second note');

    expect(app.notes).toHaveLength(2);
    expect(app.notes[0]?.content).toBe('First note');
  });

  it('should throw on empty note', () => {
    const app = Application.create({
      id: applicationId,
      userId,
      vacancyId,
    });

    expect(() => app.addNote('')).toThrow('Note content cannot be empty');
  });

  it('should archive application', () => {
    const app = Application.create({
      id: applicationId,
      userId,
      vacancyId,
    });

    app.archive();
    expect(app.status).toBe(ApplicationStatus.ARCHIVED);
    expect(app.isTerminal).toBe(true);
  });

  it('should not allow skipping backwards to an earlier stage', () => {
    const app = Application.create({
      id: applicationId,
      userId,
      vacancyId,
    });

    app.changeStatus(ApplicationStatus.SUBMITTED);
    app.changeStatus(ApplicationStatus.WAITING);

    expect(() => app.changeStatus(ApplicationStatus.SAVED)).toThrow('Invalid status transition');
  });

  it('should allow moving to rejected from any non-terminal stage', () => {
    const app = Application.create({
      id: applicationId,
      userId,
      vacancyId,
    });

    app.changeStatus(ApplicationStatus.SUBMITTED);
    app.changeStatus(ApplicationStatus.REJECTED);

    expect(app.status).toBe(ApplicationStatus.REJECTED);
  });

  it('should assign and unassign a recruiter', () => {
    const app = Application.create({
      id: applicationId,
      userId,
      vacancyId,
    });
    const recruiterId = createRecruiterId('recruiter-1');

    app.assignRecruiter(recruiterId);
    expect(app.recruiterId).toBe(recruiterId);

    app.unassignRecruiter();
    expect(app.recruiterId).toBeUndefined();
  });

  it('should preserve full note history in order', () => {
    const app = Application.create({
      id: applicationId,
      userId,
      vacancyId,
    });

    app.addNote('First note');
    app.addNote('Second note');
    app.addNote('Third note');

    expect(app.notes.map((n) => n.content)).toEqual(['First note', 'Second note', 'Third note']);
  });

  it('sets resumeId at creation and never changes it afterwards', () => {
    const resumeId = createResumeId('resume-1');
    const app = Application.create({
      id: applicationId,
      userId,
      vacancyId,
      resumeId,
    });

    expect(app.resumeId).toBe(resumeId);

    app.addNote('a note');
    app.assignRecruiter(createRecruiterId('recruiter-1'));
    app.changeStatus(ApplicationStatus.SUBMITTED);

    expect(app.resumeId).toBe(resumeId);
  });

  it('leaves resumeId undefined when none is provided at creation', () => {
    const app = Application.create({
      id: applicationId,
      userId,
      vacancyId,
    });

    expect(app.resumeId).toBeUndefined();
  });

  it('has no method to reassign resumeId after creation', () => {
    const app = Application.create({
      id: applicationId,
      userId,
      vacancyId,
      resumeId: createResumeId('resume-1'),
    });

    expect((app as unknown as { assignResume?: unknown }).assignResume).toBeUndefined();
  });

  it('start() transitions to STARTED and sets startedAt', () => {
    const app = Application.create({
      id: applicationId,
      userId,
      vacancyId,
    });

    app.start();

    expect(app.status).toBe(ApplicationStatus.STARTED);
    expect(app.startedAt).toBeDefined();
  });

  it('submit() transitions to SUBMITTED and sets submittedAt', () => {
    const app = Application.create({
      id: applicationId,
      userId,
      vacancyId,
    });

    app.submit();

    expect(app.status).toBe(ApplicationStatus.SUBMITTED);
    expect(app.submittedAt).toBeDefined();
  });

  it('full lifecycle: SAVED -> STARTED -> SUBMITTED -> WAITING', () => {
    const app = Application.create({
      id: applicationId,
      userId,
      vacancyId,
    });

    app.start();
    expect(app.status).toBe(ApplicationStatus.STARTED);
    expect(app.startedAt).toBeDefined();

    app.submit();
    expect(app.status).toBe(ApplicationStatus.SUBMITTED);
    expect(app.submittedAt).toBeDefined();

    app.changeStatus(ApplicationStatus.WAITING);
    expect(app.status).toBe(ApplicationStatus.WAITING);
  });

  it('allows skipping from SAVED directly to SUBMITTED', () => {
    const app = Application.create({
      id: applicationId,
      userId,
      vacancyId,
    });

    app.submit();
    expect(app.status).toBe(ApplicationStatus.SUBMITTED);
    expect(app.submittedAt).toBeDefined();
  });
});
