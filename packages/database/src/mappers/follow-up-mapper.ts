import type { FollowUp } from '@careeros/career';
import { FollowUp as FollowUpEntity } from '@careeros/career';
import { createFollowUpId, createApplicationId } from '@careeros/career';
import type { FollowUpStatus, FollowUpType } from '@careeros/career';

interface PrismaFollowUp {
  id: string;
  scheduledAt: Date;
  status: string;
  message: string | null;
  sentAt: Date | null;
  snoozedUntil: Date | null;
  type: string | null;
  applicationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class FollowUpMapper {
  static toDomain(record: PrismaFollowUp): FollowUp {
    return FollowUpEntity.reconstitute(createFollowUpId(record.id), {
      applicationId: createApplicationId(record.applicationId),
      scheduledAt: record.scheduledAt,
      status: record.status.toLowerCase() as FollowUpStatus,
      message: record.message ?? undefined,
      sentAt: record.sentAt ?? undefined,
      snoozedUntil: record.snoozedUntil ?? undefined,
      type: (record.type?.toLowerCase() as FollowUpType | undefined) ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(followUp: FollowUp): {
    id: string;
    scheduledAt: Date;
    status: 'PENDING' | 'SENT' | 'COMPLETED' | 'SNOOZED' | 'CANCELLED';
    message: string | null;
    sentAt: Date | null;
    snoozedUntil: Date | null;
    type: 'FOLLOW_UP' | 'INTERVIEW' | 'REPLY_EXPECTED' | 'CUSTOM' | null;
    applicationId: string;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: followUp.id,
      scheduledAt: followUp.scheduledAt,
      status: followUp.status.toUpperCase() as 'PENDING' | 'SENT' | 'COMPLETED' | 'SNOOZED' | 'CANCELLED',
      message: followUp.message ?? null,
      sentAt: followUp.sentAt ?? null,
      snoozedUntil: followUp.snoozedUntil ?? null,
      type: (followUp.type?.toUpperCase() as 'FOLLOW_UP' | 'INTERVIEW' | 'REPLY_EXPECTED' | 'CUSTOM' | undefined) ?? null,
      applicationId: followUp.applicationId,
      createdAt: followUp.createdAt,
      updatedAt: followUp.updatedAt,
    };
  }
}
