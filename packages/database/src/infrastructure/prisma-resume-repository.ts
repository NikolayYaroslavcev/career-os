import type { ResumeRepository, ResumeListCriteria } from '@careeros/career';
import type { ResumeId, UserId } from '@careeros/career';
import type { Resume, ResumeMetadata } from '@careeros/career';
import { ResumeVersionStatus } from '@careeros/career';
import { prisma } from '../client.js';
import { ResumeMapper } from '../mappers/resume-mapper.js';

const STATUS_TO_DB: Record<ResumeVersionStatus, 'DRAFT' | 'ACTIVE' | 'ARCHIVED'> = {
  [ResumeVersionStatus.DRAFT]: 'DRAFT',
  [ResumeVersionStatus.ACTIVE]: 'ACTIVE',
  [ResumeVersionStatus.ARCHIVED]: 'ARCHIVED',
};

export class PrismaResumeRepository implements ResumeRepository {
  async findById(id: ResumeId): Promise<Resume | null> {
    const record = await prisma.resume.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return ResumeMapper.toDomain(record);
  }

  async findByIds(ids: readonly ResumeId[]): Promise<Resume[]> {
    if (ids.length === 0) return [];

    const records = await prisma.resume.findMany({
      where: { id: { in: [...ids] } },
    });

    return records.map(ResumeMapper.toDomain);
  }

  async findByUserId(userId: UserId, criteria?: ResumeListCriteria): Promise<Resume[]> {
    const records = await prisma.resume.findMany({
      where: {
        userId,
        ...(criteria?.status && { status: STATUS_TO_DB[criteria.status] }),
        ...(criteria?.tag && { tags: { has: criteria.tag } }),
      },
    });

    return records.map(ResumeMapper.toDomain);
  }

  async findDefaultByUserId(userId: UserId): Promise<Resume | null> {
    const record = await prisma.resume.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return null;
    }

    return ResumeMapper.toDomain(record);
  }

  async save(resume: Resume, metadata?: ResumeMetadata): Promise<void> {
    const data = ResumeMapper.toPersistence(resume, metadata);

    await prisma.resume.upsert({
      where: { id: resume.id },
      create: data,
      update: data,
    });
  }

  async delete(id: ResumeId): Promise<void> {
    await prisma.resume.delete({
      where: { id },
    });
  }

  async exists(id: ResumeId): Promise<boolean> {
    const count = await prisma.resume.count({
      where: { id },
    });

    return count > 0;
  }
}
