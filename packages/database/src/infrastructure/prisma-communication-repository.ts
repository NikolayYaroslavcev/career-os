import type { CommunicationRepository } from '@careeros/career';
import type { CommunicationId, ApplicationId } from '@careeros/career';
import type { Communication } from '@careeros/career';
import { prisma } from '../client.js';
import { CommunicationMapper } from '../mappers/communication-mapper.js';

export class PrismaCommunicationRepository implements CommunicationRepository {
  async findById(id: CommunicationId): Promise<Communication | null> {
    const record = await prisma.communication.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return CommunicationMapper.toDomain(record);
  }

  async findByApplicationId(applicationId: ApplicationId): Promise<Communication[]> {
    const records = await prisma.communication.findMany({
      where: { applicationId },
      orderBy: { sentAt: 'desc' },
    });

    return records.map(CommunicationMapper.toDomain);
  }

  async save(communication: Communication): Promise<void> {
    const data = CommunicationMapper.toPersistence(communication);

    await prisma.communication.upsert({
      where: { id: communication.id },
      create: data,
      update: data,
    });
  }

  async delete(id: CommunicationId): Promise<void> {
    await prisma.communication.delete({
      where: { id },
    });
  }
}
