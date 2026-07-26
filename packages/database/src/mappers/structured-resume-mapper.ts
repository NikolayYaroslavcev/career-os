import {
  StructuredResume,
  createStructuredResumeId,
  createResumeId,
} from '@careeros/career';
import type {
  StructuredResumeExperience,
  StructuredResumeEducation,
  ExtractionStatus,
} from '@careeros/career';

interface PrismaStructuredResume {
  id: string;
  resumeId: string;
  sourceHash: string;
  extractionVersion: string;
  extractionModel: string | null;
  extractionStatus: string;
  failureReason: string | null;
  extractedAt: Date | null;
  summary: string | null;
  seniorityLevel: string | null;
  totalYearsOfExperience: number | null;
  skills: unknown;
  technologies: unknown;
  experience: unknown;
  education: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export class StructuredResumeMapper {
  static toDomain(record: PrismaStructuredResume): StructuredResume {
    return StructuredResume.reconstitute(createStructuredResumeId(record.id), {
      resumeId: createResumeId(record.resumeId),
      sourceHash: record.sourceHash,
      extractionVersion: record.extractionVersion,
      extractionModel: record.extractionModel ?? undefined,
      extractionStatus: record.extractionStatus as ExtractionStatus,
      failureReason: record.failureReason ?? undefined,
      extractedAt: record.extractedAt ?? undefined,
      summary: record.summary ?? undefined,
      seniorityLevel: record.seniorityLevel ?? undefined,
      totalYearsOfExperience: record.totalYearsOfExperience ?? undefined,
      skills: (record.skills as string[]) ?? [],
      technologies: (record.technologies as string[]) ?? [],
      experience: StructuredResumeMapper.parseExperience(record.experience),
      education: StructuredResumeMapper.parseEducation(record.education),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(entity: StructuredResume): {
    id: string;
    resumeId: string;
    sourceHash: string;
    extractionVersion: string;
    extractionModel: string | null;
    extractionStatus: ExtractionStatus;
    failureReason: string | null;
    extractedAt: Date | null;
    summary: string | null;
    seniorityLevel: string | null;
    totalYearsOfExperience: number | null;
    skills: object;
    technologies: object;
    experience: object;
    education: object;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: entity.id,
      resumeId: entity.resumeId,
      sourceHash: entity.sourceHash,
      extractionVersion: entity.extractionVersion,
      extractionModel: entity.extractionModel ?? null,
      extractionStatus: entity.extractionStatus,
      failureReason: entity.failureReason ?? null,
      extractedAt: entity.extractedAt ?? null,
      summary: entity.summary ?? null,
      seniorityLevel: entity.seniorityLevel ?? null,
      totalYearsOfExperience: entity.totalYearsOfExperience ?? null,
      skills: entity.skills as object,
      technologies: entity.technologies as object,
      experience: entity.experience as object,
      education: entity.education as object,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private static parseExperience(raw: unknown): StructuredResumeExperience[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => ({
      company: String(item.company ?? ''),
      position: String(item.position ?? ''),
      startDate: new Date(item.startDate),
      endDate: item.endDate ? new Date(item.endDate) : undefined,
      description: String(item.description ?? ''),
      technologies: Array.isArray(item.technologies)
        ? item.technologies.map(String)
        : [],
    }));
  }

  private static parseEducation(raw: unknown): StructuredResumeEducation[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => ({
      institution: String(item.institution ?? ''),
      degree: String(item.degree ?? ''),
      field: String(item.field ?? ''),
      startDate: new Date(item.startDate),
      endDate: item.endDate ? new Date(item.endDate) : undefined,
    }));
  }
}
