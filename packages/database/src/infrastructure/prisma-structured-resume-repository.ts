import type { StructuredResumeRepository } from '@careeros/career';
import type { ResumeId } from '@careeros/career';
import type { StructuredResume } from '@careeros/career';
import { prisma } from '../client.js';
import { StructuredResumeMapper } from '../mappers/structured-resume-mapper.js';

export class PrismaStructuredResumeRepository implements StructuredResumeRepository {
  async findByResumeId(resumeId: ResumeId): Promise<StructuredResume | null> {
    const record = await prisma.structuredResume.findUnique({
      where: { resumeId },
    });

    if (!record) {
      return null;
    }

    return StructuredResumeMapper.toDomain(record);
  }

  async upsert(structuredResume: StructuredResume): Promise<void> {
    const data = StructuredResumeMapper.toPersistence(structuredResume);

    await prisma.structuredResume.upsert({
      where: { resumeId: structuredResume.resumeId },
      create: data,
      update: data,
    });
  }
}
