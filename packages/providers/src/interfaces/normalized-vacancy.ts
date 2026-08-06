import type { ExperienceLevel, EmploymentType, LocationInfo, SalaryInfo, RemoteInfo } from '../types/vacancy.js';

export interface NormalizedVacancy {
  readonly id: string;
  readonly source: string;
  readonly sourceId: string;
  readonly title: string;
  readonly description: string;
  readonly companyName: string;
  readonly companySourceId?: string;
  readonly companyUrl?: string;
  readonly location: LocationInfo;
  readonly salary?: SalaryInfo;
  readonly experienceLevel?: ExperienceLevel;
  readonly technologies: readonly string[];
  readonly url: string;
  readonly publishedAt: Date;
  readonly fetchedAt: Date;
  readonly remote: RemoteInfo;
  readonly employmentType?: EmploymentType;
  readonly normalizedAt: Date;
  readonly contentHash: string;
}
