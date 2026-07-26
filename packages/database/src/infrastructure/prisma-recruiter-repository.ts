import type { RecruiterRepository } from '@careeros/career';
import type { RecruiterId, CompanyId } from '@careeros/career';
import type { Recruiter } from '@careeros/career';
import { prisma } from '../client.js';
import { RecruiterMapper } from '../mappers/recruiter-mapper.js';

export class PrismaRecruiterRepository implements RecruiterRepository {
  async findById(id: RecruiterId): Promise<Recruiter | null> {
    const record = await prisma.recruiter.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return RecruiterMapper.toDomain(record);
  }

  async findByIdForWorkspace(id: RecruiterId, workspaceId: string): Promise<Recruiter | null> {
    const record = await prisma.recruiter.findFirst({
      where: { id, workspaceId },
    });

    if (!record) {
      return null;
    }

    return RecruiterMapper.toDomain(record);
  }

  async findByCompanyId(companyId: CompanyId): Promise<Recruiter[]> {
    const records = await prisma.recruiter.findMany({
      where: { companyId },
    });

    return records.map(RecruiterMapper.toDomain);
  }

  async findByWorkspaceId(workspaceId: string): Promise<Recruiter[]> {
    const records = await prisma.recruiter.findMany({
      where: { workspaceId },
    });

    return records.map(RecruiterMapper.toDomain);
  }

  async save(recruiter: Recruiter, options: { workspaceId?: string }): Promise<void> {
    let workspaceId = options.workspaceId;

    if (!workspaceId) {
      const existing = await prisma.recruiter.findUnique({
        where: { id: recruiter.id },
        select: { workspaceId: true },
      });
      workspaceId = existing?.workspaceId;
    }

    if (!workspaceId) {
      throw new Error('workspaceId is required to save a new recruiter');
    }

    const data = RecruiterMapper.toPersistence(recruiter, workspaceId);

    await prisma.recruiter.upsert({
      where: { id: recruiter.id },
      create: data,
      update: data,
    });
  }

  async delete(id: RecruiterId): Promise<void> {
    await prisma.recruiter.delete({
      where: { id },
    });
  }

  async exists(id: RecruiterId): Promise<boolean> {
    const count = await prisma.recruiter.count({
      where: { id },
    });

    return count > 0;
  }
}
