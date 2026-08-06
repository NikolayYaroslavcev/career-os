import type { TailoredResume, TailoredResumeRepository } from '@careeros/ai';
import { prisma } from '../client.js';
import { TailoredResumeMapper } from '../mappers/tailored-resume-mapper.js';

export class PrismaTailoredResumeRepository implements TailoredResumeRepository {
  async save(tailoredResume: TailoredResume): Promise<void> {
    const data = TailoredResumeMapper.toPersistence(tailoredResume);

    await prisma.tailoredResume.upsert({
      where: { resumeId_vacancyId: { resumeId: data.resumeId, vacancyId: data.vacancyId } },
      create: data,
      update: data,
    });
  }

  async findById(id: string): Promise<TailoredResume | null> {
    const record = await prisma.tailoredResume.findUnique({ where: { id } });
    if (!record) return null;
    return TailoredResumeMapper.toDomain(record);
  }

  async findByResumeIdAndVacancyId(resumeId: string, vacancyId: string): Promise<TailoredResume | null> {
    const record = await prisma.tailoredResume.findUnique({
      where: { resumeId_vacancyId: { resumeId, vacancyId } },
    });
    if (!record) return null;
    return TailoredResumeMapper.toDomain(record);
  }
}
