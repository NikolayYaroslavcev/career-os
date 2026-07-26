import type { Prisma } from '@prisma/client';
import { Vacancy as VacancyEntity } from '@careeros/career';
import { createVacancyId, createCompanyId } from '@careeros/career';
import { Location } from '@careeros/career';
import { Salary } from '@careeros/career';
import { ExperienceLevel } from '@careeros/career';
import { Technology } from '@careeros/career';

interface PrismaVacancy {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  technologies: string[];
  experienceLevel: string | null;
  employmentType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
  location: string | null;
  remote: string;
  publishedAt: Date | null;
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  companyId: string;
  metadata: unknown;
}

interface VacancyMetadata {
  technologies?: string[];
}

function readTechnologies(metadata: unknown): string[] {
  if (metadata && typeof metadata === 'object' && Array.isArray((metadata as VacancyMetadata).technologies)) {
    return (metadata as VacancyMetadata).technologies as string[];
  }
  return [];
}

function mapExperienceLevel(level: string | null): ExperienceLevel {
  const known = Object.values(ExperienceLevel);
  if (level && known.includes(level as ExperienceLevel)) return level as ExperienceLevel;
  return ExperienceLevel.MIDDLE;
}

export class VacancyMapper {
  static toDomain(record: PrismaVacancy): VacancyEntity {
    const salary =
      record.salaryMin || record.salaryMax
        ? Salary.create(
            record.salaryMin ?? 0,
            record.salaryMax ?? record.salaryMin ?? 0,
            record.currency as 'USD' | 'EUR' | 'GBP' | 'UAH' | 'RUB',
            'yearly'
          )
        : undefined;

    const techNames = record.technologies.length > 0
      ? record.technologies
      : readTechnologies(record.metadata);

    return VacancyEntity.reconstitute(createVacancyId(record.id), {
      title: record.title,
      description: record.description,
      companyId: createCompanyId(record.companyId),
      location: Location.create({
        city: record.location ?? undefined,
        workMode: record.remote.toLowerCase() as 'remote' | 'hybrid' | 'onsite',
      }),
      salary,
      experienceLevel: mapExperienceLevel(record.experienceLevel),
      employmentType: record.employmentType ?? undefined,
      technologies: techNames.map((name) => Technology.create(name, 'other')),
      requirements: record.requirements,
      responsibilities: [],
      isActive: true,
      publishedAt: record.publishedAt ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(vacancy: {
    id: string;
    title: string;
    description: string;
    requirements: readonly string[];
    technologies: readonly { name: string }[];
    salary: { min: number; max: number; currency: string } | undefined;
    location: { city?: string; workMode: string };
    publishedAt: Date | undefined;
    createdAt: Date;
    updatedAt: Date;
    companyId: string;
    experienceLevel?: string;
    employmentType?: string;
  }, workspaceId: string): {
    id: string;
    title: string;
    description: string;
    requirements: string[];
    technologies: string[];
    experienceLevel: string | null;
    employmentType: string | null;
    salaryMin: number | undefined;
    salaryMax: number | undefined;
    currency: string;
    location: string | undefined;
    remote: 'ONSITE' | 'REMOTE' | 'HYBRID' | 'UNKNOWN';
    publishedAt: Date | undefined;
    fetchedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    companyId: string;
    metadata: Prisma.InputJsonValue;
    workspaceId: string;
  } {
    const techNames = vacancy.technologies.map((t) => t.name);
    return {
      id: vacancy.id,
      title: vacancy.title,
      description: vacancy.description,
      requirements: [...vacancy.requirements],
      technologies: techNames,
      experienceLevel: vacancy.experienceLevel ?? null,
      employmentType: vacancy.employmentType ?? null,
      salaryMin: vacancy.salary?.min,
      salaryMax: vacancy.salary?.max,
      currency: vacancy.salary?.currency ?? 'USD',
      location: vacancy.location.city,
      remote: vacancy.location.workMode.toUpperCase() as 'ONSITE' | 'REMOTE' | 'HYBRID' | 'UNKNOWN',
      publishedAt: vacancy.publishedAt,
      fetchedAt: new Date(),
      createdAt: vacancy.createdAt,
      updatedAt: vacancy.updatedAt,
      companyId: vacancy.companyId,
      metadata: { technologies: techNames } satisfies VacancyMetadata,
      workspaceId,
    };
  }
}
