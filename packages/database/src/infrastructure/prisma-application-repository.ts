import type { ApplicationRepository, SaveApplicationOptions } from '@careeros/career';
import type { ApplicationId, UserId, VacancyId } from '@careeros/career';
import type { Application } from '@careeros/career';
import type { ApplicationStatus } from '@careeros/career';
import { prisma } from '../client.js';
import { ApplicationMapper } from '../mappers/application-mapper.js';

export class PrismaApplicationRepository implements ApplicationRepository {
  async findById(id: ApplicationId): Promise<Application | null> {
    const record = await prisma.application.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return ApplicationMapper.toDomain(record);
  }

  async findByUserId(userId: UserId): Promise<Application[]> {
    const records = await prisma.application.findMany({
      where: { userId },
    });

    return records.map(ApplicationMapper.toDomain);
  }

  async findByUserIdAndStatus(
    userId: UserId,
    status: ApplicationStatus
  ): Promise<Application[]> {
    const records = await prisma.application.findMany({
      where: {
        userId,
        status: status.toUpperCase() as 'SAVED' | 'STARTED' | 'SUBMITTED' | 'WAITING' | 'HR_INTERVIEW' | 'TECHNICAL_INTERVIEW' | 'FINAL_INTERVIEW' | 'OFFER' | 'REJECTED' | 'ARCHIVED',
      },
    });

    return records.map(ApplicationMapper.toDomain);
  }

  async findByVacancyId(vacancyId: VacancyId): Promise<Application[]> {
    const records = await prisma.application.findMany({
      where: { vacancyId },
    });

    return records.map(ApplicationMapper.toDomain);
  }

  async findByUserIdAndVacancyId(
    userId: UserId,
    vacancyId: VacancyId
  ): Promise<Application | null> {
    const record = await prisma.application.findFirst({
      where: {
        userId,
        vacancyId,
      },
    });

    if (!record) {
      return null;
    }

    return ApplicationMapper.toDomain(record);
  }

  async save(application: Application, options: SaveApplicationOptions = {}): Promise<void> {
    let workspaceId = options.workspaceId;

    if (!workspaceId) {
      const existing = await prisma.application.findUnique({
        where: { id: application.id },
        select: { workspaceId: true },
      });
      workspaceId = existing?.workspaceId;
    }

    if (!workspaceId) {
      throw new Error('workspaceId is required to save a new application');
    }

    const data = ApplicationMapper.toPersistence(application, workspaceId);

    await prisma.application.upsert({
      where: { id: application.id },
      create: data,
      update: data,
    });
  }

  async delete(id: ApplicationId): Promise<void> {
    await prisma.application.delete({
      where: { id },
    });
  }

  async exists(id: ApplicationId): Promise<boolean> {
    const count = await prisma.application.count({
      where: { id },
    });

    return count > 0;
  }
}
