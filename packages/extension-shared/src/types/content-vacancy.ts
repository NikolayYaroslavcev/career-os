export type ContentVacancyProvider =
  | 'linkedin'
  | 'hh'
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workday'
  | 'teamtailor'
  | 'smartrecruiters'
  | 'recruitee'
  | 'generic';

export interface ContentVacancySalary {
  readonly min?: number;
  readonly max?: number;
  readonly currency: string;
  readonly period: 'hourly' | 'monthly' | 'yearly';
}

export type ContentVacancyExperienceLevel =
  | 'intern'
  | 'junior'
  | 'middle'
  | 'senior'
  | 'lead'
  | 'principal';

export type ContentVacancyEmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'freelance'
  | 'internship';

export type ContentVacancyRemote = 'remote_only' | 'hybrid' | 'onsite' | 'unknown';

export interface ContentVacancy {
  provider: ContentVacancyProvider;
  externalId: string;
  title: string;
  company: string;
  location: string;
  salary?: ContentVacancySalary;
  experienceLevel?: ContentVacancyExperienceLevel;
  employmentType?: ContentVacancyEmploymentType;
  remote?: ContentVacancyRemote;
  technologies: string[];
  description: string;
  requirements: string[];
  url: string;
  publishedAt?: string;
  extractedAt: string;
  contentHash: string;
}

export interface ApplyEvent {
  provider: string;
  url: string;
  timestamp: string;
  method: 'click' | 'form_submit' | 'confirmation_page';
}

export interface VacancyStatus {
  saved: boolean;
  vacancyId?: string;
  applicationStatus?: string;
  matchPercentage?: number;
  companyWatched: boolean;
}
