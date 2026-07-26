import type { Interview } from '@careeros/career';
import { Interview as InterviewEntity } from '@careeros/career';
import { createInterviewId, createApplicationId } from '@careeros/career';
import type { InterviewType } from '@careeros/career';
import { Prisma } from '@prisma/client';

interface InterviewFeedbackJson {
  rating: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: 'hire' | 'maybe' | 'no_hire';
}

interface PrismaInterview {
  id: string;
  type: string;
  scheduledAt: Date;
  durationMinutes: number;
  interviewerName: string | null;
  interviewerEmail: string | null;
  location: string | null;
  notes: string | null;
  isCompleted: boolean;
  feedback: unknown;
  applicationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class InterviewMapper {
  static toDomain(record: PrismaInterview): Interview {
    return InterviewEntity.reconstitute(createInterviewId(record.id), {
      applicationId: createApplicationId(record.applicationId),
      type: record.type.toLowerCase() as InterviewType,
      scheduledAt: record.scheduledAt,
      durationMinutes: record.durationMinutes,
      interviewerName: record.interviewerName ?? undefined,
      interviewerEmail: record.interviewerEmail ?? undefined,
      location: record.location ?? undefined,
      notes: record.notes ?? undefined,
      isCompleted: record.isCompleted,
      feedback: record.feedback ? (record.feedback as unknown as InterviewFeedbackJson) : undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(interview: Interview): {
    id: string;
    type: 'HR' | 'TECHNICAL' | 'SYSTEM_DESIGN' | 'BEHAVIORAL' | 'CODING' | 'CULTURAL' | 'FINAL';
    scheduledAt: Date;
    durationMinutes: number;
    interviewerName: string | null;
    interviewerEmail: string | null;
    location: string | null;
    notes: string | null;
    isCompleted: boolean;
    feedback: Prisma.InputJsonValue | typeof Prisma.DbNull;
    applicationId: string;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: interview.id,
      type: interview.type.toUpperCase() as
        | 'HR'
        | 'TECHNICAL'
        | 'SYSTEM_DESIGN'
        | 'BEHAVIORAL'
        | 'CODING'
        | 'CULTURAL'
        | 'FINAL',
      scheduledAt: interview.scheduledAt,
      durationMinutes: interview.durationMinutes,
      interviewerName: interview.interviewerName ?? null,
      interviewerEmail: interview.interviewerEmail ?? null,
      location: interview.location ?? null,
      notes: interview.notes ?? null,
      isCompleted: interview.isCompleted,
      feedback: interview.feedback
        ? (interview.feedback as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
      applicationId: interview.applicationId,
      createdAt: interview.createdAt,
      updatedAt: interview.updatedAt,
    };
  }
}
