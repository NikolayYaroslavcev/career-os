import { Application as ApplicationEntity } from '@careeros/career';
import {
  createApplicationId,
  createUserId,
  createVacancyId,
  createRecruiterId,
  createResumeId,
} from '@careeros/career';
import type { ApplicationStatus } from '@careeros/career';

interface PrismaApplication {
  id: string;
  status: string;
  notes: string | null;
  startedAt: Date | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  vacancyId: string;
  matchResultId: string | null;
  recruiterId: string | null;
  resumeId: string | null;
}

interface ApplicationNoteJson {
  content: string;
  createdAt: string;
}

function parseNotes(raw: string | null): { content: string; createdAt: Date }[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as ApplicationNoteJson[];
    return parsed.map((note) => ({ content: note.content, createdAt: new Date(note.createdAt) }));
  } catch {
    return [{ content: raw, createdAt: new Date() }];
  }
}

export class ApplicationMapper {
  static toDomain(record: PrismaApplication): ApplicationEntity {
    const status = record.status.toLowerCase() as ApplicationStatus;

    return ApplicationEntity.reconstitute(createApplicationId(record.id), {
      userId: createUserId(record.userId),
      vacancyId: createVacancyId(record.vacancyId),
      matchResultId: record.matchResultId ?? undefined,
      resumeId: record.resumeId ? createResumeId(record.resumeId) : undefined,
      recruiterId: record.recruiterId ? createRecruiterId(record.recruiterId) : undefined,
      status,
      notes: parseNotes(record.notes),
      startedAt: record.startedAt ?? undefined,
      submittedAt: record.submittedAt ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(
    application: {
      id: string;
      status: string;
      notes: ReadonlyArray<{ content: string; createdAt: Date }>;
      startedAt: Date | undefined;
      submittedAt: Date | undefined;
      createdAt: Date;
      updatedAt: Date;
      userId: string;
      vacancyId: string;
      matchResultId?: string;
      recruiterId?: string;
      resumeId?: string;
    },
    workspaceId: string
  ): {
    id: string;
    status: 'SAVED' | 'STARTED' | 'SUBMITTED' | 'WAITING' | 'HR_INTERVIEW' | 'TECHNICAL_INTERVIEW' | 'FINAL_INTERVIEW' | 'OFFER' | 'REJECTED' | 'ARCHIVED';
    notes: string | null;
    startedAt: Date | undefined;
    submittedAt: Date | undefined;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    vacancyId: string;
    matchResultId: string | undefined;
    recruiterId: string | undefined;
    resumeId: string | undefined;
    workspaceId: string;
  } {
    return {
      id: application.id,
      status: application.status.toUpperCase() as 'SAVED' | 'STARTED' | 'SUBMITTED' | 'WAITING' | 'HR_INTERVIEW' | 'TECHNICAL_INTERVIEW' | 'FINAL_INTERVIEW' | 'OFFER' | 'REJECTED' | 'ARCHIVED',
      notes:
        application.notes.length > 0
          ? JSON.stringify(
              application.notes.map((note) => ({ content: note.content, createdAt: note.createdAt.toISOString() }))
            )
          : null,
      startedAt: application.startedAt,
      submittedAt: application.submittedAt,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      userId: application.userId,
      vacancyId: application.vacancyId,
      matchResultId: application.matchResultId,
      recruiterId: application.recruiterId,
      resumeId: application.resumeId,
      workspaceId,
    };
  }
}
