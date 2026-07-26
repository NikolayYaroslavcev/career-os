import { describe, it, expect } from 'vitest';
import { FollowUp, createFollowUpId, createApplicationId, FollowUpStatus, FollowUpType } from '@careeros/career';
import { FollowUpMapper } from '../follow-up-mapper.js';

describe('FollowUpMapper', () => {
  it('round-trips a pending follow-up', () => {
    const followUp = FollowUp.create({
      id: createFollowUpId('11111111-1111-4111-8111-111111111111'),
      applicationId: createApplicationId('22222222-2222-4222-8222-222222222222'),
      scheduledAt: new Date(Date.now() + 86_400_000),
      message: 'Ping the recruiter',
    });

    const persisted = FollowUpMapper.toPersistence(followUp);
    expect(persisted.status).toBe('PENDING');
    expect(persisted.message).toBe('Ping the recruiter');
    expect(persisted.sentAt).toBeNull();

    const roundTripped = FollowUpMapper.toDomain(persisted);
    expect(roundTripped.status).toBe(FollowUpStatus.PENDING);
    expect(roundTripped.message).toBe('Ping the recruiter');
    expect(roundTripped.applicationId).toBe(followUp.applicationId);
  });

  it('round-trips a sent follow-up', () => {
    const followUp = FollowUp.create({
      id: createFollowUpId('33333333-3333-4333-8333-333333333333'),
      applicationId: createApplicationId('44444444-4444-4444-8444-444444444444'),
      scheduledAt: new Date(Date.now() + 86_400_000),
    });
    followUp.markSent();

    const persisted = FollowUpMapper.toPersistence(followUp);
    expect(persisted.status).toBe('SENT');
    expect(persisted.sentAt).toBeInstanceOf(Date);

    const roundTripped = FollowUpMapper.toDomain(persisted);
    expect(roundTripped.status).toBe(FollowUpStatus.SENT);
    expect(roundTripped.sentAt).toEqual(persisted.sentAt);
  });

  it('round-trips a null type as undefined, and a set type case-correctly', () => {
    const manual = FollowUp.create({
      id: createFollowUpId('55555555-5555-4555-8555-555555555555'),
      applicationId: createApplicationId('66666666-6666-4666-8666-666666666666'),
      scheduledAt: new Date(Date.now() + 86_400_000),
    });
    expect(FollowUpMapper.toPersistence(manual).type).toBeNull();
    expect(FollowUpMapper.toDomain(FollowUpMapper.toPersistence(manual)).type).toBeUndefined();

    const automatic = FollowUp.create({
      id: createFollowUpId('77777777-7777-4777-8777-777777777777'),
      applicationId: createApplicationId('88888888-8888-4888-8888-888888888888'),
      scheduledAt: new Date(Date.now() + 86_400_000),
      type: FollowUpType.INTERVIEW,
    });
    const persisted = FollowUpMapper.toPersistence(automatic);
    expect(persisted.type).toBe('INTERVIEW');
    expect(FollowUpMapper.toDomain(persisted).type).toBe(FollowUpType.INTERVIEW);
  });
});
