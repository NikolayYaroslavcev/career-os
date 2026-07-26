import { SearchProfile as SearchProfileEntity } from '@careeros/career';
import { createSearchProfileId, createUserId } from '@careeros/career';
import { ExperienceLevel } from '@careeros/career';
import { Location } from '@careeros/career';
import { Salary } from '@careeros/career';
import { Technology } from '@careeros/career';

interface PersistedLocation {
  city?: string;
  country?: string;
  workMode: 'remote' | 'hybrid' | 'onsite';
  isRelocationPossible: boolean;
}

interface PrismaSearchProfile {
  id: string;
  name: string;
  desiredPositions: string[];
  desiredTechnologies: string[];
  experienceLevel: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  locations: unknown;
  isRemoteOnly: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export class SearchProfileMapper {
  static toDomain(record: PrismaSearchProfile): SearchProfileEntity {
    const salary =
      record.salaryMin !== null && record.salaryMax !== null
        ? Salary.create(
            record.salaryMin,
            record.salaryMax,
            (record.salaryCurrency ?? 'USD') as 'USD' | 'EUR' | 'GBP' | 'UAH' | 'RUB',
            (record.salaryPeriod ?? 'yearly') as 'monthly' | 'yearly' | 'hourly'
          )
        : undefined;

    const locations = (Array.isArray(record.locations) ? record.locations : []) as PersistedLocation[];

    return SearchProfileEntity.reconstitute(createSearchProfileId(record.id), {
      userId: createUserId(record.userId),
      name: record.name,
      desiredPositions: [...record.desiredPositions],
      desiredTechnologies: record.desiredTechnologies.map((name) => Technology.create(name, 'other')),
      experienceLevel: record.experienceLevel as ExperienceLevel,
      desiredSalary: salary,
      desiredLocations: locations.map((location) =>
        Location.create({
          city: location.city,
          country: location.country,
          workMode: location.workMode,
          isRelocationPossible: location.isRelocationPossible,
        })
      ),
      isRemoteOnly: record.isRemoteOnly,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(
    profile: {
      id: string;
      userId: string;
      name: string;
      desiredPositions: readonly string[];
      desiredTechnologies: readonly { name: string }[];
      experienceLevel: string;
      desiredSalary?: { min: number; max: number; currency: string; period: string };
      desiredLocations: readonly {
        city?: string;
        country?: string;
        workMode: string;
        isRelocationPossible: boolean;
      }[];
      isRemoteOnly: boolean;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
    workspaceId: string
  ): {
    id: string;
    name: string;
    desiredPositions: string[];
    desiredTechnologies: string[];
    experienceLevel: string;
    salaryMin: number | undefined;
    salaryMax: number | undefined;
    salaryCurrency: string | undefined;
    salaryPeriod: string | undefined;
    locations: { city: string | undefined; country: string | undefined; workMode: string; isRelocationPossible: boolean }[];
    isRemoteOnly: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    workspaceId: string;
  } {
    return {
      id: profile.id,
      name: profile.name,
      desiredPositions: [...profile.desiredPositions],
      desiredTechnologies: profile.desiredTechnologies.map((t) => t.name),
      experienceLevel: profile.experienceLevel,
      salaryMin: profile.desiredSalary?.min,
      salaryMax: profile.desiredSalary?.max,
      salaryCurrency: profile.desiredSalary?.currency,
      salaryPeriod: profile.desiredSalary?.period,
      locations: profile.desiredLocations.map((location) => ({
        city: location.city,
        country: location.country,
        workMode: location.workMode,
        isRelocationPossible: location.isRelocationPossible,
      })),
      isRemoteOnly: profile.isRemoteOnly,
      isActive: profile.isActive,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      userId: profile.userId,
      workspaceId,
    };
  }
}
