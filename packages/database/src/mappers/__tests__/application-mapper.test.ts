import { describe, it, expect } from 'vitest';
import { Application, ApplicationStatus, createUserId, createVacancyId, createApplicationId, createRecruiterId, createResumeId } from '@careeros/career';
import { ApplicationMapper } from '../application-mapper.js';

describe('ApplicationMapper', () => {
  it('round-trips multiple notes with their original timestamps through the persisted JSON column', () => {
    const app = Application.create({
      id: createApplicationId('11111111-1111-4111-8111-111111111111'),
      userId: createUserId('22222222-2222-4222-8222-222222222222'),
      vacancyId: createVacancyId('33333333-3333-4333-8333-333333333333'),
    });
    app.addNote('First note');
    app.addNote('Second note');

    const persisted = ApplicationMapper.toPersistence(app, 'workspace-1');
    expect(persisted.workspaceId).toBe('workspace-1');
    expect(persisted.notes).not.toBeNull();
    expect(JSON.parse(persisted.notes as string)).toHaveLength(2);

    const roundTripped = ApplicationMapper.toDomain({
      id: persisted.id,
      status: persisted.status,
      notes: persisted.notes,
      startedAt: persisted.startedAt ?? null,
      submittedAt: persisted.submittedAt ?? null,
      createdAt: persisted.createdAt,
      updatedAt: persisted.updatedAt,
      userId: persisted.userId,
      vacancyId: persisted.vacancyId,
      matchResultId: persisted.matchResultId ?? null,
      recruiterId: persisted.recruiterId ?? null,
      resumeId: persisted.resumeId ?? null,
    });

    expect(roundTripped.notes.map((n) => n.content)).toEqual(['First note', 'Second note']);
  });

  it('reads a legacy plain-string notes value as a single note', () => {
    const roundTripped = ApplicationMapper.toDomain({
      id: 'app-1',
      status: 'SAVED',
      notes: 'a note written before history existed',
      startedAt: null,
      submittedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'user-1',
      vacancyId: 'vacancy-1',
      matchResultId: null,
      recruiterId: null,
      resumeId: null,
    });

    expect(roundTripped.notes).toHaveLength(1);
    expect(roundTripped.notes[0]?.content).toBe('a note written before history existed');
  });

  it('carries the recruiterId through persistence and back', () => {
    const app = Application.create({
      id: createApplicationId('44444444-4444-4444-8444-444444444444'),
      userId: createUserId('55555555-5555-4555-8555-555555555555'),
      vacancyId: createVacancyId('66666666-6666-4666-8666-666666666666'),
    });
    app.assignRecruiter(createRecruiterId('77777777-7777-4777-8777-777777777777'));

    const persisted = ApplicationMapper.toPersistence(app, 'workspace-1');
    expect(persisted.recruiterId).toBe('77777777-7777-4777-8777-777777777777');

    const roundTripped = ApplicationMapper.toDomain({
      id: persisted.id,
      status: persisted.status,
      notes: persisted.notes,
      startedAt: persisted.startedAt ?? null,
      submittedAt: persisted.submittedAt ?? null,
      createdAt: persisted.createdAt,
      updatedAt: persisted.updatedAt,
      userId: persisted.userId,
      vacancyId: persisted.vacancyId,
      matchResultId: persisted.matchResultId ?? null,
      recruiterId: persisted.recruiterId ?? null,
      resumeId: persisted.resumeId ?? null,
    });

    expect(roundTripped.recruiterId).toBe('77777777-7777-4777-8777-777777777777');
  });

  it('carries the resumeId set at creation through persistence and back', () => {
    const resumeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const app = Application.create({
      id: createApplicationId('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
      userId: createUserId('dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
      vacancyId: createVacancyId('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
      resumeId: createResumeId(resumeId),
    });

    const persisted = ApplicationMapper.toPersistence(app, 'workspace-1');
    expect(persisted.resumeId).toBe(resumeId);

    const roundTripped = ApplicationMapper.toDomain({
      id: persisted.id,
      status: persisted.status,
      notes: persisted.notes,
      startedAt: persisted.startedAt ?? null,
      submittedAt: persisted.submittedAt ?? null,
      createdAt: persisted.createdAt,
      updatedAt: persisted.updatedAt,
      userId: persisted.userId,
      vacancyId: persisted.vacancyId,
      matchResultId: persisted.matchResultId ?? null,
      recruiterId: persisted.recruiterId ?? null,
      resumeId: persisted.resumeId ?? null,
    });

    expect(roundTripped.resumeId).toBe(resumeId);
  });

  it('leaves resumeId unset when no resume was assigned at creation', () => {
    const app = Application.create({
      id: createApplicationId('ffffffff-ffff-4fff-8fff-ffffffffffff'),
      userId: createUserId('11111111-2222-4333-8444-555555555555'),
      vacancyId: createVacancyId('66666666-7777-4888-8999-aaaaaaaaaaaa'),
    });

    const persisted = ApplicationMapper.toPersistence(app, 'workspace-1');
    expect(persisted.resumeId).toBeUndefined();
  });

  it('serializes status transitions to the uppercase Prisma enum shape', () => {
    const app = Application.create({
      id: createApplicationId('88888888-8888-4888-8888-888888888888'),
      userId: createUserId('99999999-9999-4999-8999-999999999999'),
      vacancyId: createVacancyId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    });
    app.changeStatus(ApplicationStatus.SUBMITTED);

    const persisted = ApplicationMapper.toPersistence(app, 'workspace-1');
    expect(persisted.status).toBe('SUBMITTED');
  });
});
