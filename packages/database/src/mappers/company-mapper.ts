import type { Company } from '@careeros/career';
import { Company as CompanyEntity } from '@careeros/career';
import { createCompanyId } from '@careeros/career';
import { Url } from '@careeros/career';

interface PrismaCompany {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  size: string | null;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CompanyMapper {
  static toDomain(record: PrismaCompany): Company {
    return CompanyEntity.reconstitute(createCompanyId(record.id), {
      name: record.name,
      website: record.website ? Url.create(record.website) : undefined,
      logoUrl: record.logoUrl ? Url.create(record.logoUrl) : undefined,
      industry: record.industry ?? undefined,
      size: record.size ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(company: Company, workspaceId: string): {
    id: string;
    name: string;
    website: string | undefined;
    logoUrl: string | undefined;
    industry: string | undefined;
    size: string | undefined;
    createdAt: Date;
    updatedAt: Date;
    workspaceId: string;
  } {
    return {
      id: company.id,
      name: company.name,
      website: company.website?.value,
      logoUrl: company.logoUrl?.value,
      industry: company.industry,
      size: company.size,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      workspaceId,
    };
  }
}
