import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { Interview, createInterviewId, createApplicationId, InterviewType } from '@careeros/career';
import { InterviewMapper } from '../interview-mapper.js';

describe('InterviewMapper', () => {
  it('round-trips a scheduled interview', () => {
    const interview = Interview.create({
      id: createInterviewId('11111111-1111-4111-8111-111111111111'),
      applicationId: createApplicationId('22222222-2222-4222-8222-222222222222'),
      type: InterviewType.TECHNICAL,
      scheduledAt: new Date('2026-08-01T10:00:00.000Z'),
      interviewerName: 'Alex',
    });

    const persisted = InterviewMapper.toPersistence(interview);
    expect(persisted.type).toBe('TECHNICAL');
    expect(persisted.feedback).toBe(Prisma.DbNull);

    // A real read from Prisma never returns the DbNull write sentinel, only actual null.
    const roundTripped = InterviewMapper.toDomain({ ...persisted, feedback: null });
    expect(roundTripped.type).toBe(InterviewType.TECHNICAL);
    expect(roundTripped.interviewerName).toBe('Alex');
    expect(roundTripped.isCompleted).toBe(false);
    expect(roundTripped.feedback).toBeUndefined();
  });

  it('round-trips a completed interview with feedback', () => {
    const interview = Interview.create({
      id: createInterviewId('33333333-3333-4333-8333-333333333333'),
      applicationId: createApplicationId('44444444-4444-4444-8444-444444444444'),
      type: InterviewType.FINAL,
      scheduledAt: new Date('2026-08-01T10:00:00.000Z'),
    });
    interview.complete({
      rating: 4,
      summary: 'Strong candidate',
      strengths: ['communication'],
      weaknesses: [],
      recommendation: 'hire',
    });

    const persisted = InterviewMapper.toPersistence(interview);
    expect(persisted.isCompleted).toBe(true);
    expect(persisted.feedback).toEqual({
      rating: 4,
      summary: 'Strong candidate',
      strengths: ['communication'],
      weaknesses: [],
      recommendation: 'hire',
    });

    const roundTripped = InterviewMapper.toDomain(persisted);
    expect(roundTripped.isCompleted).toBe(true);
    expect(roundTripped.feedback?.rating).toBe(4);
    expect(roundTripped.feedback?.recommendation).toBe('hire');
  });
});
