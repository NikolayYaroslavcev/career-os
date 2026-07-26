import type { FollowUpRepository } from '@careeros/career';
import type { FollowUpId, ApplicationId, UserId } from '@careeros/career';
import type { FollowUp } from '@careeros/career';
import { prisma } from '../client.js';
import { FollowUpMapper } from '../mappers/follow-up-mapper.js';

export class PrismaFollowUpRepository implements FollowUpRepository {
  async findById(id: FollowUpId): Promise<FollowUp | null> {
    const record = await prisma.followUp.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return FollowUpMapper.toDomain(record);
  }

  async findByApplicationId(applicationId: ApplicationId): Promise<FollowUp[]> {
    const records = await prisma.followUp.findMany({
      where: { applicationId },
      orderBy: { scheduledAt: 'asc' },
    });

    return records.map(FollowUpMapper.toDomain);
  }

  async findByUserId(userId: UserId): Promise<FollowUp[]> {
    const records = await prisma.followUp.findMany({
      where: { application: { userId } },
      orderBy: { scheduledAt: 'asc' },
    });

    return records.map(FollowUpMapper.toDomain);
  }

  async findDue(before: Date): Promise<FollowUp[]> {
    const records = await prisma.followUp.findMany({
      where: {
        status: { in: ['PENDING', 'SNOOZED'] },
        scheduledAt: { lte: before },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return records.map(FollowUpMapper.toDomain);
  }

  async save(followUp: FollowUp): Promise<void> {
    const data = FollowUpMapper.toPersistence(followUp);

    await prisma.followUp.upsert({
      where: { id: followUp.id },
      create: data,
      update: data,
    });
  }

  async delete(id: FollowUpId): Promise<void> {
    await prisma.followUp.delete({
      where: { id },
    });
  }
}
