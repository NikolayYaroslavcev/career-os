import type { Communication } from '@careeros/career';
import { Communication as CommunicationEntity } from '@careeros/career';
import { createCommunicationId, createApplicationId } from '@careeros/career';
import type { CommunicationType, CommunicationDirection } from '@careeros/career';

interface PrismaCommunication {
  id: string;
  type: string;
  direction: string;
  content: string | null;
  subject: string | null;
  sentAt: Date;
  applicationId: string;
}

export class CommunicationMapper {
  static toDomain(record: PrismaCommunication): Communication {
    return CommunicationEntity.reconstitute(createCommunicationId(record.id), {
      applicationId: createApplicationId(record.applicationId),
      type: record.type.toLowerCase() as CommunicationType,
      direction: record.direction.toLowerCase() as CommunicationDirection,
      content: record.content ?? undefined,
      subject: record.subject ?? undefined,
      sentAt: record.sentAt,
    });
  }

  static toPersistence(communication: Communication): {
    id: string;
    type: 'EMAIL' | 'PHONE' | 'LINKEDIN' | 'TELEGRAM' | 'OTHER';
    direction: 'INBOUND' | 'OUTBOUND';
    content: string | null;
    subject: string | null;
    sentAt: Date;
    applicationId: string;
  } {
    return {
      id: communication.id,
      type: communication.type.toUpperCase() as 'EMAIL' | 'PHONE' | 'LINKEDIN' | 'TELEGRAM' | 'OTHER',
      direction: communication.direction.toUpperCase() as 'INBOUND' | 'OUTBOUND',
      content: communication.content ?? null,
      subject: communication.subject ?? null,
      sentAt: communication.sentAt,
      applicationId: communication.applicationId,
    };
  }
}
