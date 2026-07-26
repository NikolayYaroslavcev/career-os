import type { InterviewRepository } from '@careeros/career';
import type { InterviewId, ApplicationId } from '@careeros/career';
import type { Interview } from '@careeros/career';
import { prisma } from '../client.js';
import { InterviewMapper } from '../mappers/interview-mapper.js';

export class PrismaInterviewRepository implements InterviewRepository {
  async findById(id: InterviewId): Promise<Interview | null> {
    const record = await prisma.interview.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return InterviewMapper.toDomain(record);
  }

  async findByApplicationId(applicationId: ApplicationId): Promise<Interview[]> {
    const records = await prisma.interview.findMany({
      where: { applicationId },
      orderBy: { scheduledAt: 'asc' },
    });

    return records.map(InterviewMapper.toDomain);
  }

  async findUpcomingByApplicationId(applicationId: ApplicationId): Promise<Interview[]> {
    const records = await prisma.interview.findMany({
      where: {
        applicationId,
        isCompleted: false,
        scheduledAt: { gt: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return records.map(InterviewMapper.toDomain);
  }

  async save(interview: Interview): Promise<void> {
    const data = InterviewMapper.toPersistence(interview);

    await prisma.interview.upsert({
      where: { id: interview.id },
      create: data,
      update: data,
    });
  }

  async delete(id: InterviewId): Promise<void> {
    await prisma.interview.delete({
      where: { id },
    });
  }

  async exists(id: InterviewId): Promise<boolean> {
    const count = await prisma.interview.count({
      where: { id },
    });

    return count > 0;
  }
}
