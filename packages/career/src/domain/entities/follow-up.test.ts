import { describe, it, expect } from 'vitest';
import { FollowUp } from './follow-up.js';
import { FollowUpStatus } from '../enums/follow-up-status.js';
import { FollowUpType } from '../enums/follow-up-type.js';
import { createFollowUpId, createApplicationId } from '../base/identifier.js';

describe('FollowUp', () => {
  const id = createFollowUpId('11111111-1111-4111-8111-111111111111');
  const applicationId = createApplicationId('22222222-2222-4222-8222-222222222222');
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  it('is created as pending with the given schedule and message', () => {
    const followUp = FollowUp.create({ id, applicationId, scheduledAt: future, message: '  Ping recruiter  ' });

    expect(followUp.status).toBe(FollowUpStatus.PENDING);
    expect(followUp.scheduledAt).toEqual(future);
    expect(followUp.message).toBe('Ping recruiter');
    expect(followUp.sentAt).toBeUndefined();
  });

  it('is undefined by default and settable for automatically scheduled follow-ups', () => {
    const manual = FollowUp.create({ id, applicationId, scheduledAt: future });
    expect(manual.type).toBeUndefined();

    const automatic = FollowUp.create({ id, applicationId, scheduledAt: future, type: FollowUpType.INTERVIEW });
    expect(automatic.type).toBe(FollowUpType.INTERVIEW);
  });

  it('throws when scheduled in the past', () => {
    const past = new Date(Date.now() - 1000);
    expect(() => FollowUp.create({ id, applicationId, scheduledAt: past })).toThrow(
      'Follow-up date must be in the future'
    );
  });

  it('is due once pending and the scheduled time has passed', () => {
    const followUp = FollowUp.create({ id, applicationId, scheduledAt: future });
    expect(followUp.isDue).toBe(false);

    const dueFollowUp = FollowUp.reconstitute(id, {
      applicationId,
      scheduledAt: new Date(Date.now() - 1000),
      status: FollowUpStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(dueFollowUp.isDue).toBe(true);
  });

  it('marks as sent and records sentAt', () => {
    const followUp = FollowUp.create({ id, applicationId, scheduledAt: future });
    followUp.markSent();

    expect(followUp.status).toBe(FollowUpStatus.SENT);
    expect(followUp.sentAt).toBeInstanceOf(Date);
  });

  it('completes a follow-up', () => {
    const followUp = FollowUp.create({ id, applicationId, scheduledAt: future });
    followUp.complete();
    expect(followUp.status).toBe(FollowUpStatus.COMPLETED);
  });

  it('snoozes to a new date and stays due-eligible', () => {
    const followUp = FollowUp.create({ id, applicationId, scheduledAt: future });
    const newDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    followUp.snooze(newDate);

    expect(followUp.status).toBe(FollowUpStatus.SNOOZED);
    expect(followUp.snoozedUntil).toEqual(newDate);
    expect(followUp.scheduledAt).toEqual(newDate);
  });

  it('rejects snoozing to a past date', () => {
    const followUp = FollowUp.create({ id, applicationId, scheduledAt: future });
    expect(() => followUp.snooze(new Date(Date.now() - 1000))).toThrow('Snooze date must be in the future');
  });

  it('cancels a follow-up', () => {
    const followUp = FollowUp.create({ id, applicationId, scheduledAt: future });
    followUp.cancel();
    expect(followUp.status).toBe(FollowUpStatus.CANCELLED);
  });

  it('rejects further changes once completed or cancelled', () => {
    const completed = FollowUp.create({ id, applicationId, scheduledAt: future });
    completed.complete();
    expect(() => completed.markSent()).toThrow('Cannot modify a follow-up that is already completed');

    const cancelled = FollowUp.create({ id, applicationId, scheduledAt: future });
    cancelled.cancel();
    expect(() => cancelled.snooze(new Date(Date.now() + 1000))).toThrow(
      'Cannot modify a follow-up that is already cancelled'
    );
  });
});
