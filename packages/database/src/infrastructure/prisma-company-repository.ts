import type { CompanyRepository, SaveCompanyOptions } from '@careeros/career';
import type { CompanyId } from '@careeros/career';
import type { Company } from '@careeros/career';
import { prisma } from '../client.js';
import { CompanyMapper } from '../mappers/company-mapper.js';

export class PrismaCompanyRepository implements CompanyRepository {
  async findById(id: CompanyId): Promise<Company | null> {
    const record = await prisma.company.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return CompanyMapper.toDomain(record);
  }

  async findByIdForWorkspace(id: CompanyId, workspaceId: string): Promise<Company | null> {
    const record = await prisma.company.findFirst({ where: { id, workspaceId } });

    if (!record) {
      return null;
    }

    return CompanyMapper.toDomain(record);
  }

  async findByIds(ids: readonly CompanyId[]): Promise<Company[]> {
    if (ids.length === 0) return [];
    const records = await prisma.company.findMany({ where: { id: { in: [...ids] } } });
    return records.map(CompanyMapper.toDomain);
  }

  async findByName(name: string, workspaceId: string): Promise<Company | null> {
    const record = await prisma.company.findFirst({
      where: { name, workspaceId },
    });

    if (!record) {
      return null;
    }

    return CompanyMapper.toDomain(record);
  }

  async save(company: Company, options: SaveCompanyOptions): Promise<void> {
    const data = CompanyMapper.toPersistence(company, options.workspaceId);

    await prisma.company.upsert({
      where: { id: company.id },
      create: data,
      update: data,
    });
  }

  async delete(id: CompanyId): Promise<void> {
    await prisma.company.delete({
      where: { id },
    });
  }

  async exists(id: CompanyId): Promise<boolean> {
    const count = await prisma.company.count({
      where: { id },
    });

    return count > 0;
  }
}
