import { describe, it, expect } from 'vitest';
import { Interview } from './interview.js';
import { InterviewType } from '../enums/interview-type.js';
import { createInterviewId, createApplicationId } from '../base/identifier.js';

describe('Interview', () => {
  const interviewId = createInterviewId('interview-1');
  const applicationId = createApplicationId('app-1');

  it('should create an interview', () => {
    const scheduledAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const interview = Interview.create({
      id: interviewId,
      applicationId,
      type: InterviewType.TECHNICAL,
      scheduledAt,
    });

    expect(interview.id).toBe(interviewId);
    expect(interview.applicationId).toBe(applicationId);
    expect(interview.type).toBe(InterviewType.TECHNICAL);
    expect(interview.scheduledAt).toBe(scheduledAt);
    expect(interview.isCompleted).toBe(false);
  });

  it('should create with default duration', () => {
    const interview = Interview.create({
      id: interviewId,
      applicationId,
      type: InterviewType.TECHNICAL,
      scheduledAt: new Date(),
    });

    expect(interview.durationMinutes).toBe(60);
  });

  it('should create with custom duration', () => {
    const interview = Interview.create({
      id: interviewId,
      applicationId,
      type: InterviewType.TECHNICAL,
      scheduledAt: new Date(),
      durationMinutes: 90,
    });

    expect(interview.durationMinutes).toBe(90);
  });

  it('should complete interview with feedback', () => {
    const interview = Interview.create({
      id: interviewId,
      applicationId,
      type: InterviewType.TECHNICAL,
      scheduledAt: new Date(),
    });

    interview.complete({
      rating: 4,
      summary: 'Good performance',
      strengths: ['Problem solving', 'Communication'],
      weaknesses: ['Needs more system design practice'],
      recommendation: 'hire',
    });

    expect(interview.isCompleted).toBe(true);
    expect(interview.feedback?.rating).toBe(4);
    expect(interview.feedback?.recommendation).toBe('hire');
  });

  it('should emit interview completed event', () => {
    const interview = Interview.create({
      id: interviewId,
      applicationId,
      type: InterviewType.TECHNICAL,
      scheduledAt: new Date(),
    });

    interview.clearDomainEvents();
    interview.complete({
      rating: 5,
      summary: 'Excellent',
      strengths: [],
      weaknesses: [],
      recommendation: 'hire',
    });

    const events = interview.domainEvents;
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('InterviewCompleted');
  });

  it('should not complete already completed interview', () => {
    const interview = Interview.create({
      id: interviewId,
      applicationId,
      type: InterviewType.TECHNICAL,
      scheduledAt: new Date(),
    });

    interview.complete({
      rating: 4,
      summary: 'Good',
      strengths: [],
      weaknesses: [],
      recommendation: 'hire',
    });

    expect(() =>
      interview.complete({
        rating: 5,
        summary: 'Great',
        strengths: [],
        weaknesses: [],
        recommendation: 'hire',
      })
    ).toThrow('Interview is already completed');
  });

  it('should throw on invalid rating', () => {
    const interview = Interview.create({
      id: interviewId,
      applicationId,
      type: InterviewType.TECHNICAL,
      scheduledAt: new Date(),
    });

    expect(() =>
      interview.complete({
        rating: 6,
        summary: 'Good',
        strengths: [],
        weaknesses: [],
        recommendation: 'hire',
      })
    ).toThrow('Rating must be between 1 and 5');
  });

  it('should reschedule interview', () => {
    const interview = Interview.create({
      id: interviewId,
      applicationId,
      type: InterviewType.TECHNICAL,
      scheduledAt: new Date(),
    });

    const newDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    interview.reschedule(newDate);

    expect(interview.scheduledAt).toBe(newDate);
  });

  it('should not reschedule completed interview', () => {
    const interview = Interview.create({
      id: interviewId,
      applicationId,
      type: InterviewType.TECHNICAL,
      scheduledAt: new Date(),
    });

    interview.complete({
      rating: 4,
      summary: 'Good',
      strengths: [],
      weaknesses: [],
      recommendation: 'hire',
    });

    expect(() => interview.reschedule(new Date())).toThrow('Cannot reschedule a completed interview');
  });
});
