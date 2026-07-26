import type { Recruiter } from '@careeros/career';
import { Recruiter as RecruiterEntity } from '@careeros/career';
import { createRecruiterId, createCompanyId, Email } from '@careeros/career';

interface PrismaRecruiter {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  companyId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class RecruiterMapper {
  static toDomain(record: PrismaRecruiter): Recruiter {
    return RecruiterEntity.reconstitute(createRecruiterId(record.id), {
      name: record.name,
      email: record.email ? Email.create(record.email) : undefined,
      phone: record.phone ?? undefined,
      linkedinUrl: record.linkedinUrl ?? undefined,
      notes: record.notes ?? undefined,
      companyId: record.companyId ? createCompanyId(record.companyId) : undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(recruiter: Recruiter, workspaceId: string): {
    id: string;
    name: string;
    email: string | undefined;
    phone: string | undefined;
    linkedinUrl: string | undefined;
    notes: string | undefined;
    companyId: string | undefined;
    createdAt: Date;
    updatedAt: Date;
    workspaceId: string;
  } {
    return {
      id: recruiter.id,
      name: recruiter.name,
      email: recruiter.email?.value,
      phone: recruiter.phone,
      linkedinUrl: recruiter.linkedinUrl,
      notes: recruiter.notes,
      companyId: recruiter.companyId,
      createdAt: recruiter.createdAt,
      updatedAt: recruiter.updatedAt,
      workspaceId,
    };
  }
}
